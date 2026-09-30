// Pure functions only. No DOM, no storage. Every number can be traced to a rule below.
// A language model can replace parseRequest for messy emails and drawings without touching the rest.

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const round2 = (x) => Math.round(x * 100) / 100;
export const sortDims = (d) => [...d].sort((x, y) => x - y);
export const daysBetween = (isoA, isoB) => Math.round((new Date(isoB) - new Date(isoA)) / 86400000);

/* ---------- Uncertainty widths, shared by drivers and gap messages ---------- */
export const WIDTH = {
  qty: [0.15, 0.3],
  material: [0.15, 0.35],
  dims: [0.15, 0.3],
  tol: [0.03, 0.14],
  tolVague: [0.03, 0.12],
  complexity: [0.05, 0.1],
  finish: [0.02, 0.05],
  rush: [0.0, 0.08],
  routeFit: [0.02, 0.06],
  thinHistory: [0.05, 0.12]
};
const pctText = (w) => `${Math.round(w[0] * 100)} to ${Math.round(w[1] * 100)} percent`;

/* ---------- Step 1: read the request ---------- */
const none = () => ({ value: null, evidence: "", assumed: false });

export function parseRequest(raw, materials, finishes) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const low = text.toLowerCase().replace(/stainless\s+steel/g, "stainless");
  const out = {
    qty: none(),
    material: { ...none(), candidates: [] },
    dims: { ...none(), round: false },
    tol: { ...none(), vague: false },
    finish: none(),
    weeks: { ...none(), rush: false },
    complexity: { value: 2, evidence: "", assumed: true },
    flags: { itar: false, certs: false, fai: false },
    hints: { holes: false, threads: false, pockets: false, bends: null, sheet: false, turned: false, cast: false }
  };
  if (!text) return out;

  // Quantity
  const NOUN = "(?:pcs\\.?|pieces?|parts?|units?|ea\\b|each|brackets?|shafts?|enclosures?|housings?|fittings?|pins?|plates?|covers?|panels?|blocks?|spacers?|flanges?|bushings?|gears?|caps?|clamps?)";
  let q = text.match(/(?:qty|quantity)\s*(?:of|:|=)?\s*(\d[\d,]*)/i);
  let qTxt = q ? q[0] : "";
  if (!q) {
    q = text.match(new RegExp("(?:^|[^\\d.,])(\\d[\\d,]*)\\s+(?:[a-z0-9\\-]+\\s+){0,3}?" + NOUN + "\\b", "i"));
    if (q) qTxt = q[0].trim();
  }
  if (q) {
    const n = parseInt(q[1].replace(/,/g, ""), 10);
    if (n >= 1 && n <= 1000000) {
      out.qty.value = n;
      out.qty.evidence = qTxt;
    }
  }

  // Material, with conflict detection across families
  const specific = [];
  const generic = [];
  for (const m of materials) {
    for (const k of m.keywords) if (new RegExp("\\b" + k + "\\b", "i").test(low)) specific.push(m);
    for (const k of m.generic) if (new RegExp("\\b" + k + "\\b", "i").test(low)) generic.push(m);
  }
  const uniq = (arr) => [...new Map(arr.map((m) => [m.id, m])).values()];
  const S = uniq(specific);
  const G = uniq(generic).filter((g) => !S.some((s) => s.family === g.family));
  const fams = new Set([...S, ...G].map((m) => m.family));
  const cands = [...S, ...G.filter((g, i, a) => a.findIndex((x) => x.family === g.family) === i)];
  out.material.candidates = cands.map((m) => m.id);
  if (fams.size === 1 && (S.length === 1 || (S.length === 0 && G.length >= 1))) {
    const pick = S.length === 1 ? S[0] : G[0];
    out.material.value = pick.id;
    const kw = [...pick.keywords, ...pick.generic].find((k) => new RegExp("\\b" + k + "\\b", "i").test(low));
    out.material.evidence = kw || pick.name;
  } else if (cands.length > 1) {
    out.material.evidence = cands.map((m) => m.name).join(" or ");
  }

  // Dimensions
  const N = "(\\d*\\.?\\d+)";
  const U = '(?:\\s*(?:in(?:ch(?:es)?)?\\b|"|mm\\b))?';
  const three = text.match(new RegExp(N + U + "\\s*(?:x|by|\u00d7)\\s*" + N + U + "\\s*(?:x|by|\u00d7)\\s*" + N + '(\\s*(?:in(?:ch(?:es)?)?\\b|"|mm\\b))?', "i"));
  const dia = text.match(/(\d*\.?\d+)\s*(?:in(?:ch(?:es)?)?|"|mm)?\s*(?:dia(?:meter)?\b|od\b)/i);
  const len = text.match(/(\d*\.?\d+)\s*(?:in(?:ch(?:es)?)?|"|mm)?\s*(?:long\b|length\b|lg\b)/i);
  if (three) {
    const mm = /mm\b/i.test(three[0]);
    const f = mm ? 1 / 25.4 : 1;
    out.dims.value = [parseFloat(three[1]) * f, parseFloat(three[2]) * f, parseFloat(three[3]) * f].map((v) => Math.round(v * 1000) / 1000);
    out.dims.evidence = three[0].trim();
  } else if (dia && len) {
    const mm = /mm\b/i.test(dia[0] + len[0]);
    const f = mm ? 1 / 25.4 : 1;
    const d = parseFloat(dia[1]) * f;
    out.dims.value = [d, d, parseFloat(len[1]) * f].map((v) => Math.round(v * 1000) / 1000);
    out.dims.round = true;
    out.dims.evidence = `${dia[0].trim()}, ${len[0].trim()}`;
  }

  // Tolerance
  const t = text.match(/(?:\u00b1|\+\s*\/\s*-|\+-|plus or minus)\s*(\d*\.\d+|\d+)\s*(mm|in|inch)?/i);
  const t2 = text.match(/toleranc\w*\s*(?:of|is|:)?\s*(?:\u00b1|\+\/-)?\s*(\.\d+)/i);
  if (t) {
    let v = parseFloat(t[1]);
    if (t[2] && t[2].toLowerCase() === "mm") v /= 25.4;
    if (v > 0 && v < 1) {
      out.tol.value = Math.round(v * 10000) / 10000;
      out.tol.evidence = t[0].trim();
    }
  } else if (t2) {
    out.tol.value = parseFloat(t2[1]);
    out.tol.evidence = t2[0].trim();
  } else {
    const v = text.match(/tight\s+toleranc\w*|toleranc\w*\s+(?:is|are)?\s*tight|precision/i);
    if (v) {
      out.tol.value = 0.001;
      out.tol.vague = true;
      out.tol.evidence = v[0];
    }
  }

  // Finish
  for (const f of finishes) {
    const hit = f.keywords.find((k) => low.includes(k));
    if (hit) {
      out.finish.value = f.id;
      out.finish.evidence = hit;
      break;
    }
  }

  // Delivery
  const wk = text.match(/(\d+)\s*(?:weeks?|wks?)\b/i);
  const dy = text.match(/(\d+)\s*(?:business\s+)?days?\b/i);
  if (wk) {
    out.weeks.value = parseInt(wk[1], 10);
    out.weeks.evidence = wk[0];
  } else if (dy) {
    out.weeks.value = Math.max(0.5, Math.round((parseInt(dy[1], 10) / 7) * 10) / 10);
    out.weeks.evidence = dy[0];
  }
  if (/asap|rush|urgent|expedit/i.test(text)) out.weeks.rush = true;

  // Flags and hints
  out.flags.itar = /\bITAR\b|export[- ]controlled|\bCUI\b/i.test(text);
  out.flags.certs = /\bcerts?\b|certification|certificate|\bCoC\b/i.test(text);
  out.flags.fai = /first article|\bFAI\b/i.test(text);
  out.hints.holes = /\bholes?\b|drill/i.test(text);
  out.hints.threads = /thread|tapped|\btap\b/i.test(text);
  out.hints.pockets = /pocket|cavity|\bslots?\b/i.test(text);
  const b = text.match(/(\d+)\s*bends?/i);
  out.hints.bends = b ? parseInt(b[1], 10) : null;
  out.hints.sheet = /sheet metal|flat (?:blank|pattern)|laser|\bbent\b|\bbends?\b/i.test(text);
  out.hints.turned = /shaft|\bpins?\b|turned|lathe|diameter|\bdia\b/i.test(text);
  out.hints.cast = /\bcast(?:ing|ings)?\b|forging/i.test(text);

  const feat = ["holes", "threads", "pockets"].filter((k) => out.hints[k]).length;
  if (feat > 0) {
    out.complexity.value = clamp(1 + feat, 1, 3);
    out.complexity.assumed = false;
    out.complexity.evidence = ["holes", "threads", "pockets"].filter((k) => out.hints[k]).join(", ");
  }
  return out;
}

/* ---------- Step 2: turn fields into inputs, with visible assumptions ---------- */
export function resolveInputs(f, materials, finishes) {
  const assumed = {};
  let qty = f.qty.value;
  if (qty == null) { qty = 100; assumed.qty = true; }
  let mat = materials.find((m) => m.id === f.material.value);
  if (!mat) { mat = materials[0]; assumed.material = true; }
  let dims = f.dims.value;
  if (!dims) { dims = [4, 3, 1]; assumed.dims = true; }
  let tol = f.tol.value;
  if (tol == null) { tol = 0.005; assumed.tol = true; }
  else if (f.tol.vague) assumed.tolVague = true;
  const finish = finishes.find((x) => x.id === f.finish.value) || finishes.find((x) => x.id === "none");
  if (f.finish.value == null) assumed.finish = true;
  if (f.complexity.assumed) assumed.complexity = true;
  const rush = !!f.weeks.rush;
  const weeks = f.weeks.value != null ? f.weeks.value : rush ? 2 : null;
  return {
    qty, mat, dims, tol, finish, weeks, rush, assumed,
    round: !!f.dims.round,
    complexity: f.complexity.value,
    certs: f.flags.certs,
    fai: f.flags.fai,
    hints: f.hints
  };
}

/* ---------- Step 3: gaps, conflicts and the question to send ---------- */
export function findGaps(f, materials) {
  const gaps = [];
  if (f.qty.value == null) gaps.push({ id: "qty", severity: "high", title: "Quantity is missing", question: "How many pieces do you need, and do you expect repeat orders?", effect: `Setup cost per part depends on quantity. Until it is confirmed the range is widened by ${pctText(WIDTH.qty)}.` });
  if (f.material.value == null) {
    if (f.material.candidates.length > 1) {
      const names = f.material.candidates.map((id) => materials.find((m) => m.id === id).name).join(" and ");
      gaps.push({ id: "material", severity: "high", title: "Conflicting materials", question: `The request mentions ${names}. Which one should we quote, or should we quote both?`, effect: `Materials can differ in cost by a wide margin. The range is widened by ${pctText(WIDTH.material)} until one is chosen.` });
    } else {
      gaps.push({ id: "material", severity: "high", title: "Material is missing", question: "Which material and alloy should we quote?", effect: `Material sets both raw cost and machining time. The range is widened by ${pctText(WIDTH.material)}.` });
    }
  }
  if (!f.dims.value) gaps.push({ id: "dims", severity: "high", title: "Size is missing", question: "Can you send the overall size (length, width, height) or the print?", effect: `Stock size and cycle time follow from the part size. The range is widened by ${pctText(WIDTH.dims)}.` });
  if (f.tol.value == null) gaps.push({ id: "tol", severity: "medium", title: "Tolerance is not stated", question: "What tolerance applies, and which features are critical?", effect: `A standard tolerance is assumed. Tighter callouts raise cost. The range is widened by ${pctText(WIDTH.tol)}.` });
  else if (f.tol.vague) gaps.push({ id: "tolVague", severity: "medium", title: "Tolerance is described, not specified", question: "Can you give the tolerance as a number for the critical features?", effect: `A tight tolerance of 0.001 in is assumed. The range is widened by ${pctText(WIDTH.tolVague)}.` });
  if (f.finish.value == null) gaps.push({ id: "finish", severity: "low", title: "No finish mentioned", question: "Is any finish or outside processing required?", effect: `Assumed none. Outside services vary, so the range is widened by ${pctText(WIDTH.finish)} if one is added later.` });
  if (f.weeks.value == null && !f.weeks.rush) gaps.push({ id: "weeks", severity: "low", title: "No delivery date", question: "When do you need the parts, and is a partial shipment acceptable?", effect: "Lead time is shown for each route, but it cannot be checked against a date." });
  if (f.complexity.assumed) gaps.push({ id: "complexity", severity: "low", title: "Feature detail is unknown", question: "Can you send the print or list the holes, threads and pockets?", effect: `Medium complexity is assumed. The range is widened by ${pctText(WIDTH.complexity)}.` });
  if (f.flags.itar) gaps.push({ id: "itar", severity: "flag", title: "Export controlled marking found", question: "", effect: "Handle files and suppliers under your export control procedure before sharing anything outside the shop." });
  if (f.flags.certs) gaps.push({ id: "certs", severity: "info", title: "Material certificates requested", question: "", effect: "A certification and inspection cost per lot is included in the estimate." });
  if (f.flags.fai) gaps.push({ id: "fai", severity: "info", title: "First article inspection requested", question: "", effect: "A first article inspection cost is included in the estimate." });
  return gaps;
}

export function draftCustomerEmail(gaps) {
  const qs = gaps.filter((g) => g.question);
  if (!qs.length) return "";
  const lines = qs.map((g, i) => `${i + 1}. ${g.question}`).join("\n");
  return `Subject: A few questions before we quote\n\nHello,\n\nThanks for the request. To give you an accurate price, could you confirm the following?\n\n${lines}\n\nOnce we have these we can turn the quote around quickly.\n\nThank you,\n[Your name]`;
}

/* ---------- Step 4: routes and cost ---------- */
const toleranceFactor = (t) => (t <= 0.0005 ? 2.8 : t <= 0.001 ? 2.2 : t <= 0.002 ? 1.6 : t <= 0.005 ? 1.25 : t <= 0.01 ? 1.05 : 1.0);
const scrapFor = (mat, tol, route) => clamp((route === "sheet" ? 0.06 : 0.03) + (mat.machinability - 1) * 0.02 + (tol <= 0.001 ? 0.04 : tol <= 0.002 ? 0.02 : 0), 0.02, 0.15);
const finishCost = (inp) => inp.finish.perPart + inp.finish.lot / inp.qty;
const inspectCost = (inp) => (inp.tol <= 0.002 ? 0.9 : inp.tol <= 0.005 ? 0.35 : 0.15) + (inp.certs ? 45 / inp.qty : 0) + (inp.fai ? 120 / inp.qty : 0);

function assemble(inp, shop, o) {
  const machine = (o.cycleMin / 60) * o.rate;
  const labor = (o.cycleMin / 60) * shop.laborRate * 0.5;
  const setup = (o.setupHrs * (o.rate + shop.laborRate)) / inp.qty;
  const overhead = (machine + labor + setup) * (shop.overhead - 1);
  const tooling = o.tooling ? o.tooling / inp.qty : 0;
  const finish = finishCost(inp);
  const inspect = inspectCost(inp);
  const total = o.material + machine + labor + setup + overhead + tooling + finish + inspect;
  return { material: o.material, machine, labor, setup, overhead, tooling, finish, inspect, total, cycleMin: o.cycleMin, scrap: o.scrap };
}

export function costRoute(route, inp, ctx) {
  const shop = ctx.shop;
  const cm = ctx.cycleMult == null ? 1 : ctx.cycleMult;
  const [a, b, c] = sortDims(inp.dims);
  const mat = inp.mat;
  const tolF = toleranceFactor(inp.tol);
  const cx = inp.complexity;
  const scrap = scrapFor(mat, inp.tol, route);
  if (route === "mill") {
    const stock = (c + 0.25) * (b + 0.25) * (a + 0.125);
    const removal = stock * (0.35 + 0.1 * cx);
    const cycleMin = (1.5 + removal * 0.22 * mat.machinability + cx * 1.2) * tolF * cm;
    return assemble(inp, shop, { material: stock * mat.density * mat.pricePerLb * (1 + scrap), cycleMin, setupHrs: 1.0 + 0.4 * cx, rate: shop.machineRates.mill, scrap });
  }
  if (route === "turn") {
    const D = Math.max(a, b);
    const stock = (Math.PI / 4) * (D + 0.125) ** 2 * (c + 0.25);
    const part = (Math.PI / 4) * D * D * c * (1 - (0.25 * cx) / 3);
    const removal = stock - part;
    const cycleMin = (1.2 + removal * 0.3 * mat.machinability + cx * 1.0) * tolF * cm;
    return assemble(inp, shop, { material: stock * mat.density * mat.pricePerLb * (1 + scrap), cycleMin, setupHrs: 0.8 + 0.3 * cx, rate: shop.machineRates.turn, scrap });
  }
  if (route === "sheet") {
    const blank = b * c;
    const matCost = blank * a * mat.density * mat.pricePerLb * (1 + 0.18 + scrap);
    const perimeter = 2 * (b + c) + (inp.hints.holes ? 12 : 0);
    const speed = a <= 0.06 ? 200 : a <= 0.125 ? 120 : 60;
    const bends = inp.hints.bends != null ? inp.hints.bends : 2;
    const cycleMin = (perimeter / speed + 0.4 + bends * 0.35) * Math.min(tolF, 1.3) * cm;
    return assemble(inp, shop, { material: matCost, cycleMin, setupHrs: 0.6 + 0.15 * bends, rate: shop.machineRates.sheet, scrap });
  }
  if (route === "cast") {
    const weight = a * b * c * 0.45 * mat.density;
    const cycleMin = (3 + cx * 1.5) * tolF * 0.6 * cm;
    return assemble(inp, shop, { material: weight * mat.castPerLb * (1 + scrap), cycleMin, setupHrs: 1.5, rate: shop.machineRates.cast, scrap, tooling: 1800 + 120 * c });
  }
  return null;
}

const leadDays = (inp, cycleMin, route) => {
  const prod = Math.ceil((inp.qty * cycleMin) / 60 / 7.5);
  return 3 + inp.mat.leadDays + prod + inp.finish.days + (route === "cast" ? 35 : 0);
};

const ROUTE_NAMES = { mill: "CNC mill from bar or plate", turn: "CNC turn on a lathe", sheet: "Laser cut and bend", cast: "Cast, then finish machine" };

export function evaluateRoutes(inp, ctx) {
  const [a, b, c] = sortDims(inp.dims);
  const needDays = inp.weeks != null ? inp.weeks * 7 : null;
  const list = [];
  for (const id of ["mill", "turn", "sheet", "cast"]) {
    let applicable = true;
    let fit = 0.5;
    const reasons = [];
    if (id === "mill") {
      const round = inp.round || (b / a <= 1.2 && c / b >= 1.5);
      const sheetLike = a <= 0.1 && b >= 2;
      fit = round ? 0.4 : sheetLike ? 0.3 : 0.8;
      reasons.push(round ? "Round part. A lathe is usually faster." : sheetLike ? "Thin flat part. Cutting sheet is usually cheaper." : "Prismatic part suits milling.");
    }
    if (id === "turn") {
      const roundish = b / a <= 1.2 && c / b >= 1.2;
      applicable = roundish;
      fit = inp.round || inp.hints.turned ? 0.9 : 0.5;
      reasons.push(applicable ? "Round cross section suits a lathe." : "Part is not round, so a lathe does not apply.");
    }
    if (id === "sheet") {
      applicable = a <= 0.25 && b >= 1 && c >= 2 && inp.mat.sheet;
      fit = inp.hints.sheet ? 0.9 : 0.6;
      reasons.push(applicable ? "Thin, flat part in a sheet material." : !inp.mat.sheet ? "This material is not stocked as sheet." : "Part is too thick or too small for sheet work.");
      if (applicable && inp.tol < 0.005) { fit -= 0.3; reasons.push("Tolerance is tighter than bending holds."); }
    }
    if (id === "cast") {
      applicable = inp.qty >= 300 && inp.mat.castable && c <= 24;
      fit = inp.qty >= 1000 ? 0.85 : 0.55;
      reasons.push(applicable ? "Volume can pay back the tooling." : inp.qty < 300 ? "Quantity is too low to pay back tooling." : "Material is not castable in this shop.");
    }
    if (!applicable) { list.push({ id, name: ROUTE_NAMES[id], applicable, fit: 0, reasons, cost: null }); continue; }
    const cost = costRoute(id, inp, ctx);
    const lead = leadDays(inp, cost.cycleMin, id);
    const meets = needDays == null || lead <= needDays;
    if (!meets) reasons.push(`Lead time of ${lead} days misses the ${Math.round(needDays)} day need.`);
    list.push({ id, name: ROUTE_NAMES[id], applicable, fit: clamp(fit, 0, 1), reasons, cost, lead, meets });
  }
  return list;
}

export function recommend(routes) {
  const ok = routes.filter((r) => r.applicable && r.fit >= 0.5);
  const pool = ok.length ? ok : routes.filter((r) => r.applicable);
  if (!pool.length) return routes[0];
  const meeting = pool.filter((r) => r.meets);
  if (meeting.length) return meeting.reduce((x, y) => (y.cost.total < x.cost.total ? y : x));
  return pool.reduce((x, y) => (y.lead < x.lead ? y : x));
}

/* ---------- Step 5: comparable past jobs and calibration ---------- */
const logRatio = (x, y) => Math.abs(Math.log(x / y));

export function findComparables(inp, routeId, history, materials) {
  const rows = history.map((h) => {
    const hm = materials.find((m) => m.id === h.materialId);
    const matScore = h.materialId === inp.mat.id ? 1 : hm && hm.family === inp.mat.family ? 0.6 : 0;
    const routeScore = h.route === routeId ? 1 : 0;
    const qtyScore = 1 - Math.min(1, logRatio(h.qty, inp.qty) / Math.log(8));
    const tolScore = 1 - Math.min(1, Math.abs(Math.log10(h.tol / inp.tol)));
    const volA = h.dims[0] * h.dims[1] * h.dims[2];
    const volB = inp.dims[0] * inp.dims[1] * inp.dims[2];
    const sizeScore = 1 - Math.min(1, logRatio(Math.max(volA, 1e-6), Math.max(volB, 1e-6)) / Math.log(20));
    const finScore = h.finishId === inp.finish.id ? 1 : 0;
    const score = 0.3 * matScore + 0.25 * routeScore + 0.2 * qtyScore + 0.15 * tolScore + 0.05 * sizeScore + 0.05 * finScore;
    const diffs = [];
    if (h.materialId !== inp.mat.id) diffs.push(hm && hm.family === inp.mat.family ? `Different alloy (${hm.name})` : `Different material (${hm ? hm.name : h.materialId})`);
    if (h.route !== routeId) diffs.push(`Different process (${ROUTE_NAMES[h.route] || h.route})`);
    const qr = h.qty / inp.qty;
    if (qr >= 1.5 || qr <= 1 / 1.5) diffs.push(`Quantity was ${h.qty.toLocaleString("en-US")}, not ${inp.qty.toLocaleString("en-US")}`);
    if (h.tol / inp.tol >= 1.5 || h.tol / inp.tol <= 1 / 1.5) diffs.push(`Tolerance was ${h.tol}, not ${inp.tol}`);
    if (h.finishId !== inp.finish.id) diffs.push("Different finish");
    return { ...h, score, diffs, label: score >= 0.8 ? "High" : score >= 0.6 ? "Medium" : "Low" };
  });
  return rows.sort((x, y) => y.score - x.score).slice(0, 4);
}

export function calibrate(comps) {
  const usable = comps.filter((c) => c.score >= 0.6 && c.actual != null && c.modelCost > 0);
  if (usable.length < 2) return { multiplier: 1, n: usable.length, spread: null, applied: false };
  const w = usable.reduce((s, c) => s + c.score, 0);
  const mean = usable.reduce((s, c) => s + (c.score * c.actual) / c.modelCost, 0) / w;
  const varc = usable.reduce((s, c) => s + c.score * ((c.actual / c.modelCost - mean) ** 2), 0) / w;
  return { multiplier: clamp(mean, 0.85, 1.35), n: usable.length, spread: Math.sqrt(varc), applied: true };
}

/* ---------- Step 6: uncertainty ---------- */
export function buildDrivers(inp, f, sel, calib, ctx) {
  const d = [];
  const push = (id, label, detail, w, fix) => d.push({ id, label, detail, down: w[0], up: w[1], fix });
  const A = inp.assumed;
  if (A.qty) push("qty", "Quantity assumed", "Setup cost per part depends on the real quantity.", WIDTH.qty, "Confirm quantity");
  if (A.material) push("material", f.material.candidates.length > 1 ? "Materials in conflict" : "Material assumed", "Raw cost and cycle time both depend on the alloy.", WIDTH.material, "Choose a material");
  if (A.dims) push("dims", "Size assumed", "Stock size and machining time follow from the size.", WIDTH.dims, "Enter the size");
  if (A.tol) push("tol", "Tolerance not stated", "A standard tolerance is assumed. A tighter one adds cost.", WIDTH.tol, "Confirm tolerance");
  if (A.tolVague) push("tolVague", "Tolerance is not a number", "A tight tolerance is assumed until a value is given.", WIDTH.tolVague, "Enter the tolerance");
  if (A.complexity) push("complexity", "Feature detail unknown", "Medium complexity is assumed without a print.", WIDTH.complexity, "Set complexity");
  if (inp.finish.id !== "none") push("finish", "Outside processing not confirmed", "Finish vendors change price and lead time.", WIDTH.finish, "Get a vendor quote");
  if (inp.rush) push("rush", "Rush delivery", "Overtime or expediting may be needed.", WIDTH.rush, "Confirm real date");
  if (sel.fit < 0.7) push("routeFit", "Route is not the best fit", "This route works but is not the natural choice for this part.", WIDTH.routeFit, "Compare routes");
  const age = ctx.today && inp.mat.checkedAt ? daysBetween(inp.mat.checkedAt, ctx.today) : 0;
  if (age > 45) push("price", `Material price is ${age} days old`, "Old prices can be well off the market.", [0.02, 0.1], "Refresh price");
  else if (age > 14) push("price", `Material price is ${age} days old`, "Prices may have moved since the last check.", [0.01, 0.05], "Refresh price");
  if (!calib.applied) push("history", "Few close past jobs", "There is not enough similar history to correct the model.", WIDTH.thinHistory, "Log more outcomes");
  else if (calib.spread != null && calib.spread > 0.03) push("spread", `Past jobs disagree by about ${Math.round(calib.spread * 100)} percent`, "Similar jobs did not cost the same.", [calib.spread, calib.spread * 1.2], "");
  return d;
}

export function combineDrivers(drivers) {
  const down = Math.sqrt(drivers.reduce((s, x) => s + x.down * x.down, 0));
  const up = Math.sqrt(drivers.reduce((s, x) => s + x.up * x.up, 0));
  return { down: clamp(down, 0.02, 0.45), up: clamp(up, 0.03, 0.9) };
}

/* ---------- Full pipeline ---------- */
export function runPipeline(fields, ctx) {
  const inp = resolveInputs(fields, ctx.materials, ctx.finishes);
  const ruleMult = (ctx.rules || []).filter((r) => r.materialId === inp.mat.id).reduce((m, r) => m * r.multiplier, 1);
  const adj = 1 + (ctx.adjPct || 0) / 100;
  const cctx = { shop: ctx.shop, cycleMult: ruleMult * adj };
  const routes = evaluateRoutes(inp, cctx);
  const rec = recommend(routes);
  const chosen = routes.find((r) => r.id === ctx.routeId && r.applicable) || rec;
  const comps = findComparables(inp, chosen.id, ctx.history, ctx.materials);
  const calib = calibrate(comps);
  const likely = chosen.cost.total * calib.multiplier;
  const drivers = buildDrivers(inp, fields, chosen, calib, ctx);
  const w = combineDrivers(drivers);
  const contrib = drivers.map((x) => ({ ...x, weight: Math.max(x.down, x.up) })).sort((x, y) => y.weight - x.weight);
  const gaps = findGaps(fields, ctx.materials);
  return {
    inp, routes, recommendedId: rec.id, chosen, comps, calib, ruleMult,
    cost: { likely, low: likely * (1 - w.down), high: likely * (1 + w.up), downPct: w.down, upPct: w.up, breakdown: chosen.cost },
    drivers: contrib, gaps,
    lead: chosen.lead,
    needDays: inp.weeks != null ? inp.weeks * 7 : null
  };
}

/* ---------- Step 7: price, win chance and expected profit ---------- */
export function makeWinCurve(history) {
  const pts = history.filter((h) => h.price && h.costBasis).map((h) => ({ m: h.price / h.costBasis, w: h.won ? 1 : 0 }));
  const prior = (m) => 1 / (1 + Math.exp((m - 1.38) / 0.07));
  return (m) => {
    let sw = 0, sy = 0;
    for (const p of pts) {
      const k = Math.exp(-0.5 * ((m - p.m) / 0.05) ** 2);
      sw += k;
      sy += k * p.w;
    }
    const pw = 0.8;
    return clamp((sy + pw * prior(m)) / (sw + pw), 0.03, 0.97);
  };
}

export const REL = { new: 0, repeat: -0.03, strategic: -0.05 };
export const SENS = { sensitive: 0.05, neutral: 0, value: -0.05 };
export const CAP = { low: 0.05, normal: 0, high: -0.05 };

export function pricePlan(cost, pc, history, shop, qty) {
  const costExp = cost.likely + 0.3 * (cost.high - cost.likely);
  const delta = SENS[pc.sensitivity] + REL[pc.relationship];
  const bonus = CAP[pc.capacity] * costExp;
  const floor = costExp / (1 - shop.minMargin);
  const curve = makeWinCurve(history);
  const grid = [];
  for (let i = 0; i <= 90; i++) {
    const price = costExp * (1.0 + i * 0.01);
    const p = curve(price / cost.likely + delta);
    const e = p * (price - costExp + bonus) * qty;
    grid.push({ price, p, e, ok: price >= floor });
  }
  const valid = grid.filter((g) => g.ok);
  const best = valid.reduce((x, y) => (y.e > x.e ? y : x), valid[0]);
  const near = valid.filter((g) => g.e >= 0.93 * best.e);
  return {
    grid, costExp, floor, suggested: best.price, pWin: best.p, expectedProfit: best.e,
    bandLow: Math.min(...near.map((g) => g.price)), bandHigh: Math.max(...near.map((g) => g.price)),
    margin: (best.price - cost.likely) / best.price,
    curve, delta
  };
}

/* ---------- Learning loop ---------- */
export function hydrateHistory(raw, materials, finishes, shop) {
  return raw.map((j) => {
    const inp = {
      qty: j.qty, mat: materials.find((m) => m.id === j.materialId), dims: j.dims, tol: j.tol,
      finish: finishes.find((f) => f.id === j.finishId), complexity: j.complexity, round: j.route === "turn",
      certs: false, fai: false, hints: { holes: false, bends: null }
    };
    const modelCost = costRoute(j.route, inp, { shop, cycleMult: 1 }).total;
    const actual = round2(modelCost * j.actualFactor);
    return { id: j.id, name: j.name, materialId: j.materialId, qty: j.qty, dims: j.dims, tol: j.tol, finishId: j.finishId, route: j.route, complexity: j.complexity, modelCost, actual, costBasis: actual, price: round2(actual * j.markup), won: j.won, source: "sample" };
  });
}

export function suggestRules(quotes) {
  const groups = new Map();
  for (const q of quotes) {
    if (!q.adjPct || !q.reasonTag || q.reasonTag === "other" || q.reasonTag === "customer") continue;
    const key = `${q.materialId}|${q.reasonTag}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const out = [];
  for (const [key, arr] of groups) {
    if (arr.length < 2) continue;
    const [materialId, tag] = key.split("|");
    const avg = arr.reduce((s, q) => s + q.adjPct, 0) / arr.length;
    out.push({ materialId, tag, count: arr.length, adjPct: Math.round(avg * 10) / 10, multiplier: Math.round((1 + avg / 100) * 1000) / 1000 });
  }
  return out;
}
