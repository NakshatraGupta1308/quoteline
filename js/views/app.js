import { SAMPLES, FINISHES, REASON_TAGS } from "../data.js";
import { parseRequest, runPipeline, pricePlan, draftCustomerEmail } from "../engine.js";
import * as db from "../store.js";
import { esc, money, money0, pct, num, $, $$, keepFocus, rangeBar, toast, copyText } from "../ui.js";

const COMPLEXITY = ["Simple", "Moderate", "Complex"];
const SEV = { high: "Needed", medium: "Confirm", low: "Optional", flag: "Handling", info: "Included" };

const fresh = () => ({
  text: "", sampleId: null, fields: null, adjPct: 0, reasonTag: "slower", note: "", routeId: null,
  pc: { relationship: "new", sensitivity: "neutral", capacity: "normal" }, finalPrice: null, R: null, plan: null
});
let S = fresh();
let root = null;

export function renderApp(el, sampleId) {
  root = el;
  root.innerHTML = skeleton();
  bindStatic();
  renderSettings();
  if (sampleId && SAMPLES.some((s) => s.id === sampleId) && S.sampleId !== sampleId) loadSample(sampleId);
  else if (S.fields) {
    $("#req-text", root).value = S.text;
    showSections();
    renderFields();
    syncStaticControls();
    update();
  }
}

/* ---------- Skeleton ---------- */
function skeleton() {
  return `
  <div class="wrap">
    <header class="app-head">
      <h1>Quote workspace</h1>
      <p class="lead">Paste a customer request. Quoteline reads it, flags what is missing, compares ways to make the part, and shows a cost range with reasons.</p>
    </header>
    <div class="app-grid">
      <div class="col-main">
        <section class="card" id="s-request" aria-labelledby="h-request">
          <h2 id="h-request"><span class="step-no">1</span> Customer request</h2>
          <p class="hint">Paste an email or RFQ text, or start from a sample.</p>
          <div class="samples" role="group" aria-label="Sample requests">
            ${SAMPLES.map((s) => `<button type="button" class="sample-btn" data-sample="${s.id}" aria-pressed="false">${esc(s.label)}</button>`).join("")}
          </div>
          <label for="req-text" class="sr">Request text</label>
          <textarea id="req-text" rows="7" placeholder="Example: We need 250 pcs of a bracket, 6061 aluminum, about 4 x 3 x 1 in, anodized, in 5 weeks."></textarea>
          <div class="row" style="margin-top:14px">
            <button type="button" class="btn btn-primary" id="btn-read">Read request</button>
            <button type="button" class="btn" id="btn-clear">Start over</button>
          </div>
        </section>

        <section class="card" id="s-fields" aria-labelledby="h-fields" hidden>
          <h2 id="h-fields"><span class="step-no">2</span> What was understood</h2>
          <p class="hint">Fix anything that is wrong. Every change recalculates the quote and the range.</p>
          <div class="field-grid" id="fields-form"></div>
          <div id="gaps-out"></div>
        </section>

        <section class="card" id="s-routes" aria-labelledby="h-routes" hidden>
          <h2 id="h-routes"><span class="step-no">3</span> Ways to make it</h2>
          <p class="hint">Cost depends on how the part is made. Pick a route to see the estimate for it. Route costs use the base model. The estimate below adds what your past jobs show.</p>
          <div id="routes-out" class="routes"></div>
        </section>

        <section class="card" id="s-cost" aria-labelledby="h-cost" hidden>
          <h2 id="h-cost"><span class="step-no">4</span> Cost and uncertainty</h2>
          <p class="hint">A range with named reasons, not a single number.</p>
          <div class="override">
            <div class="field"><label for="ov-adj">Cycle time adjustment (%)</label><input type="number" id="ov-adj" step="1" min="-50" max="100" value="0"></div>
            <div class="field"><label for="ov-tag">Reason</label><select id="ov-tag">${REASON_TAGS.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</select></div>
            <div class="field"><label for="ov-note">Note</label><input type="text" id="ov-note" placeholder="Optional"></div>
          </div>
          <div id="cost-out"></div>
        </section>

        <section class="card" id="s-price" aria-labelledby="h-price" hidden>
          <h2 id="h-price"><span class="step-no">5</span> Price</h2>
          <p class="hint">Cost is one input. The price also depends on how busy the shop is, who the customer is, and how likely a quote is to win.</p>
          <div class="price-controls">
            <div class="field"><label for="pc-rel">Customer</label><select id="pc-rel"><option value="new">New customer</option><option value="repeat">Repeat customer</option><option value="strategic">Strategic account</option></select></div>
            <div class="field"><label for="pc-sens">Buying style</label><select id="pc-sens"><option value="sensitive">Price sensitive</option><option value="neutral" selected>Balanced</option><option value="value">Values quality and speed</option></select></div>
            <div class="field"><label for="pc-cap">Shop capacity</label><select id="pc-cap"><option value="low">Open capacity, want the work</option><option value="normal" selected>Normal load</option><option value="high">Full, be selective</option></select></div>
          </div>
          <div id="price-out"></div>
        </section>

        <section class="card" id="s-approve" aria-labelledby="h-approve" hidden>
          <h2 id="h-approve"><span class="step-no">6</span> Review and approve</h2>
          <p class="hint">Nothing leaves the shop until you approve it. Your adjustments and reasons are saved so the next quote can use them.</p>
          <div class="grid-2">
            <div class="field"><label for="f-final">Price per part</label><input type="number" id="f-final" step="0.01" min="0"></div>
            <div id="approve-out"></div>
          </div>
          <div class="row" style="margin-top:18px">
            <button type="button" class="btn btn-primary btn-lg" id="btn-approve">Approve and save quote</button>
            <button type="button" class="btn" id="btn-suggested">Use suggested price</button>
            <button type="button" class="btn" id="btn-copy-quote">Copy quote text</button>
          </div>
        </section>
      </div>

      <aside class="col-side" aria-label="Quote summary">
        <div id="summary"></div>
        <details class="settings" id="settings"><summary>Shop settings</summary><div class="inner" id="settings-in"></div></details>
        <p class="notice">This build reads requests and prices parts with transparent rules you can inspect. A language model can replace the reading step for messy emails and drawings. Sample data is illustrative.</p>
      </aside>
    </div>
  </div>`;
}

function showSections() {
  ["s-fields", "s-routes", "s-cost", "s-price", "s-approve"].forEach((id) => { $("#" + id, root).hidden = false; });
}

/* ---------- Static events ---------- */
function bindStatic() {
  $$(".sample-btn", root).forEach((b) => b.addEventListener("click", () => loadSample(b.dataset.sample)));
  $("#btn-read", root).addEventListener("click", () => {
    const t = $("#req-text", root).value.trim();
    if (!t) { toast("Paste a customer request first."); return; }
    S.sampleId = null;
    loadText(t);
  });
  $("#btn-clear", root).addEventListener("click", () => { S = fresh(); renderApp(root); window.scrollTo({ top: 0 }); });

  $("#fields-form", root).addEventListener("input", onFieldInput);
  $("#fields-form", root).addEventListener("change", onFieldInput);

  $("#routes-out", root).addEventListener("click", (e) => {
    const b = e.target.closest("[data-route]");
    if (!b || b.disabled) return;
    S.routeId = b.dataset.route;
    update();
  });

  $("#ov-adj", root).addEventListener("input", (e) => { S.adjPct = Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 0; update(); });
  $("#ov-tag", root).addEventListener("change", (e) => { S.reasonTag = e.target.value; });
  $("#ov-note", root).addEventListener("input", (e) => { S.note = e.target.value; });

  $("#pc-rel", root).addEventListener("change", (e) => { S.pc.relationship = e.target.value; update(); });
  $("#pc-sens", root).addEventListener("change", (e) => { S.pc.sensitivity = e.target.value; update(); });
  $("#pc-cap", root).addEventListener("change", (e) => { S.pc.capacity = e.target.value; update(); });

  $("#f-final", root).addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    S.finalPrice = Number.isFinite(v) && v > 0 ? v : null;
    renderApprove();
    renderSummary();
  });
  $("#btn-suggested", root).addEventListener("click", () => { S.finalPrice = null; setFinalInput(); renderApprove(); renderSummary(); });
  $("#btn-approve", root).addEventListener("click", approve);
  $("#btn-copy-quote", root).addEventListener("click", () => copyText(quoteText()).then(() => toast("Quote text copied.")));

  $("#gaps-out", root).addEventListener("click", (e) => {
    if (e.target.closest("#btn-copy-email")) copyText(draftCustomerEmail(S.R.gaps)).then(() => toast("Message copied."));
  });
  $("#summary", root).addEventListener("click", (e) => {
    if (e.target.closest("#btn-jump")) $("#s-approve", root).scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function syncStaticControls() {
  $("#ov-adj", root).value = S.adjPct;
  $("#ov-tag", root).value = S.reasonTag;
  $("#ov-note", root).value = S.note;
  $("#pc-rel", root).value = S.pc.relationship;
  $("#pc-sens", root).value = S.pc.sensitivity;
  $("#pc-cap", root).value = S.pc.capacity;
  $$(".sample-btn", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sample === S.sampleId)));
}

/* ---------- Load and edit ---------- */
function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) return;
  S.sampleId = id;
  $("#req-text", root).value = s.text;
  loadText(s.text);
}

function loadText(text) {
  const ctx = db.getCtx();
  S.text = text;
  S.fields = parseRequest(text, ctx.materials, ctx.finishes);
  S.routeId = null;
  S.finalPrice = null;
  S.adjPct = 0;
  S.note = "";
  showSections();
  renderFields();
  syncStaticControls();
  update();
  $("#s-fields", root).scrollIntoView({ behavior: "smooth", block: "start" });
}

function ev(x) {
  return x.evidence ? `<span class="ev">Read from: &ldquo;${esc(x.evidence)}&rdquo;</span>` : `<span class="ev assumed">Not found in the request</span>`;
}

function renderFields() {
  const f = S.fields;
  const mats = db.getMaterials();
  const d = f.dims.value || ["", "", ""];
  const cx = f.complexity.value;
  $("#fields-form", root).innerHTML = `
    <div class="field"><label for="f-qty">Quantity</label><input type="number" id="f-qty" min="1" step="1" value="${f.qty.value == null ? "" : f.qty.value}">${ev(f.qty)}</div>
    <div class="field"><label for="f-material">Material</label>
      <select id="f-material"><option value="">${f.material.candidates.length > 1 ? "Conflict, choose one" : "Not set"}</option>${mats.map((m) => `<option value="${m.id}" ${f.material.value === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>${ev(f.material)}</div>
    <div class="field"><label for="f-finish">Finish</label>
      <select id="f-finish"><option value="">Not stated</option>${FINISHES.map((x) => `<option value="${x.id}" ${f.finish.value === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>${ev(f.finish)}</div>
    <div class="field span-3"><label for="f-d0">Size in inches (length, width, height)</label>
      <div class="dims3"><input type="number" id="f-d0" min="0" step="0.001" value="${d[0]}" aria-label="Length"><input type="number" id="f-d1" min="0" step="0.001" value="${d[1]}" aria-label="Width"><input type="number" id="f-d2" min="0" step="0.001" value="${d[2]}" aria-label="Height"></div>${ev(f.dims)}</div>
    <div class="field"><label for="f-tol">Tolerance (inches, plus or minus)</label><input type="number" id="f-tol" min="0" step="0.0005" value="${f.tol.value == null ? "" : f.tol.value}">${ev(f.tol)}</div>
    <div class="field"><label for="f-weeks">Needed in (weeks)</label><input type="number" id="f-weeks" min="0" step="0.5" value="${f.weeks.value == null ? "" : f.weeks.value}">${ev(f.weeks)}</div>
    <div class="field"><label for="f-complexity">Feature complexity: <span id="f-complexity-out">${COMPLEXITY[cx - 1]}</span></label><input type="range" id="f-complexity" min="1" max="3" step="1" value="${cx}"><span class="ev ${f.complexity.assumed ? "assumed" : ""}">${f.complexity.assumed ? "Assumed, no features listed" : "Read from: " + esc(f.complexity.evidence)}</span></div>
    <div class="field span-3"><div class="row" style="gap:28px">
      <label class="check"><input type="checkbox" id="f-rush" ${f.weeks.rush ? "checked" : ""}> Rush requested</label>
      <label class="check"><input type="checkbox" id="f-certs" ${f.flags.certs ? "checked" : ""}> Material certificates</label>
      <label class="check"><input type="checkbox" id="f-fai" ${f.flags.fai ? "checked" : ""}> First article inspection</label>
    </div></div>`;
}

function onFieldInput(e) {
  const t = e.target;
  const f = S.fields;
  if (!f || !t.id) return;
  const numOrNull = (v) => (v === "" || !Number.isFinite(parseFloat(v)) ? null : parseFloat(v));
  switch (t.id) {
    case "f-qty": { const v = numOrNull(t.value); f.qty.value = v == null ? null : Math.max(1, Math.round(v)); break; }
    case "f-material": f.material.value = t.value || null; break;
    case "f-finish": f.finish.value = t.value || null; break;
    case "f-d0": case "f-d1": case "f-d2": {
      const v = [0, 1, 2].map((i) => parseFloat($("#f-d" + i, root).value));
      f.dims.value = v.every((x) => x > 0) ? v : null;
      break;
    }
    case "f-tol": { const v = numOrNull(t.value); f.tol.value = v != null && v > 0 ? v : null; f.tol.vague = false; break; }
    case "f-weeks": f.weeks.value = numOrNull(t.value); break;
    case "f-complexity": f.complexity.value = parseInt(t.value, 10); f.complexity.assumed = false; $("#f-complexity-out", root).textContent = COMPLEXITY[f.complexity.value - 1]; break;
    case "f-rush": f.weeks.rush = t.checked; break;
    case "f-certs": f.flags.certs = t.checked; break;
    case "f-fai": f.flags.fai = t.checked; break;
    default: return;
  }
  update();
}

/* ---------- Recalculate and render outputs ---------- */
function update() {
  if (!S.fields) return;
  const ctx = db.getCtx({ adjPct: S.adjPct, routeId: S.routeId });
  S.R = runPipeline(S.fields, ctx);
  S.plan = pricePlan(S.R.cost, S.pc, ctx.history, ctx.shop, S.R.inp.qty);
  setFinalInput();
  renderGaps();
  renderRoutes();
  renderCost();
  renderPrice();
  renderApprove();
  renderSummary();
}

function setFinalInput() {
  const input = $("#f-final", root);
  if (S.finalPrice == null && S.plan) input.value = S.plan.suggested.toFixed(2);
}
const finalPrice = () => (S.finalPrice != null ? S.finalPrice : S.plan.suggested);

function renderGaps() {
  const g = S.R.gaps;
  const email = draftCustomerEmail(g);
  const html = g.length
    ? `<div class="gaps" role="list" aria-label="Open questions">${g.map((x) => `<div class="gap ${x.severity}" role="listitem"><div class="sev">${SEV[x.severity]}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.effect)}</p></div></div>`).join("")}</div>`
    : `<p class="notice" style="margin-top:22px">Nothing is missing or in conflict.</p>`;
  const mail = email ? `<div class="sub">Draft message to the customer</div><pre class="email">${esc(email)}</pre><div class="row" style="margin-top:10px"><button type="button" class="btn btn-sm" id="btn-copy-email" data-key="copy-email">Copy message</button></div>` : "";
  keepFocus($("#gaps-out", root), () => { $("#gaps-out", root).innerHTML = html + mail; });
}

function renderRoutes() {
  const R = S.R;
  const html = R.routes.map((r) => {
    if (!r.applicable) return `<button type="button" class="route" disabled data-key="route-${r.id}"><span class="r-name">${esc(r.name)}</span><span>Not a fit</span><span class="small">${esc(r.reasons[0])}</span></button>`;
    const on = r.id === R.chosen.id;
    const tags = (r.id === R.recommendedId ? `<span class="tag">Recommended</span>` : "");
    const miss = r.meets ? "" : `<span class="warn small">Lead time misses the date</span>`;
    return `<button type="button" class="route" data-route="${r.id}" data-key="route-${r.id}" aria-pressed="${on}">
      ${tags}<span class="r-name">${esc(r.name)}</span>
      <span class="r-cost">${money(r.cost.total)} <span class="small muted">per part</span></span>
      <span class="small">Lead time about ${r.lead} days, fit ${Math.round(r.fit * 100)} percent, scrap ${pct(r.cost.scrap)}</span>
      <span class="small muted">${esc(r.reasons[0])}</span>${miss}</button>`;
  }).join("");
  keepFocus($("#routes-out", root), () => { $("#routes-out", root).innerHTML = html; });
}

function renderCost() {
  const R = S.R, c = R.cost, b = c.breakdown, qty = R.inp.qty;
  const lines = [["Material", b.material], ["Machine time", b.machine], ["Labor", b.labor], ["Setup, spread over the quantity", b.setup], ["Overhead", b.overhead]];
  if (b.tooling > 0) lines.push(["Tooling, spread over the quantity", b.tooling]);
  lines.push(["Finish and outside processing", b.finish], ["Inspection and certificates", b.inspect]);
  const adj = c.likely - b.total;
  if (R.calib.applied) lines.push([`Adjustment from ${R.calib.n} close past jobs`, adj]);
  const rows = lines.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${money(v)}</td><td class="num">${money0(v * qty)}</td></tr>`).join("");
  const maxW = Math.max(...R.drivers.map((d) => d.weight), 0.01);
  const drivers = R.drivers.length
    ? R.drivers.slice(0, 6).map((d) => `<div class="driver"><div><b>${esc(d.label)}</b><span class="d">${esc(d.detail)}</span>${d.fix ? `<div class="fix">${esc(d.fix)}</div>` : ""}</div><div class="meter" aria-hidden="true"><i style="width:${Math.round((d.weight / maxW) * 100)}%"></i></div></div>`).join("")
    : `<p class="notice">No open uncertainty. The range is as tight as the model allows.</p>`;
  const comps = R.comps.map((k) => `<tr><td><b>${esc(k.id)}</b> ${esc(k.name)}${k.source === "logged" ? " (yours)" : ""}</td><td class="match-${k.label}">${k.label}</td><td>${k.diffs.length ? esc(k.diffs.join(". ")) : "Same material, process and similar quantity"}</td><td class="num">${k.actual != null ? money(k.actual) : "n/a"}</td><td>${k.won ? "Won" : "Lost"}</td></tr>`).join("");
  const calibNote = R.calib.applied
    ? `Past jobs like this one ran ${Math.abs(Math.round((R.calib.multiplier - 1) * 100))} percent ${R.calib.multiplier >= 1 ? "over" : "under"} the base model, so the estimate is adjusted by that much.`
    : `Fewer than two close past jobs have a recorded actual cost, so the model is not adjusted and the range stays wider.`;
  const rule = R.ruleMult !== 1 ? `<p class="notice" style="margin-bottom:12px">A shop rule is applied: cycle time is multiplied by ${R.ruleMult.toFixed(2)} for ${esc(R.inp.mat.name)}.</p>` : "";
  const dl = R.needDays != null ? `${R.lead} days, against ${Math.round(R.needDays)} needed` : `${R.lead} days`;
  const scaleLo = c.low * 0.9, scaleHi = c.high * 1.08;
  $("#cost-out", root).innerHTML = `
    <div class="cost-top"><div><div class="muted small">Estimated cost per part</div><div class="big">${money(c.low)} to ${money(c.high)}</div><div class="muted small">Likely ${money(c.likely)} on ${num(qty)} pieces, ${money0(c.likely * qty)} in total. Lead time about ${dl}.</div></div></div>
    ${rangeBar(c.low, c.likely, c.high, scaleLo, scaleHi)}
    ${rule}
    <div class="sub">What widens the range</div>${drivers}
    <div class="sub">Where the money goes</div>
    <div class="table-scroll"><table class="tbl"><thead><tr><th>Item</th><th class="num">Per part</th><th class="num">For ${num(qty)}</th></tr></thead><tbody>${rows}<tr><td><b>Likely cost</b></td><td class="num"><b>${money(c.likely)}</b></td><td class="num"><b>${money0(c.likely * qty)}</b></td></tr></tbody></table></div>
    <p class="small muted" style="margin-top:8px">Cycle time is about ${b.cycleMin.toFixed(1)} minutes per part on the selected route.</p>
    <div class="sub">Comparable past jobs</div>
    <p class="small muted" style="margin-bottom:8px">${calibNote}</p>
    <div class="table-scroll"><table class="tbl"><thead><tr><th>Past job</th><th>Match</th><th>What is different</th><th class="num">Actual cost</th><th>Result</th></tr></thead><tbody>${comps}</tbody></table></div>`;
}

function chartSVG(plan, cost, fp) {
  const W = 680, H = 270, p = { l: 48, r: 52, t: 16, b: 40 };
  const g = plan.grid;
  const x0 = g[0].price, x1 = g[g.length - 1].price;
  const X = (v) => p.l + ((v - x0) / (x1 - x0)) * (W - p.l - p.r);
  const Yp = (v) => p.t + (1 - v) * (H - p.t - p.b);
  const eMax = Math.max(...g.map((q) => q.e), 1);
  const Ye = (v) => p.t + (1 - Math.max(v, 0) / eMax) * (H - p.t - p.b);
  const line = (fy) => g.map((q, i) => `${i ? "L" : "M"}${X(q.price).toFixed(1)},${fy(q).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => x0 + t * (x1 - x0));
  const best = g.reduce((a, q) => (q.e > a.e ? q : a), g[0]);
  const inR = (v) => v >= x0 && v <= x1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart of win chance and expected profit by price. Suggested price ${money(plan.suggested)}, band ${money(plan.bandLow)} to ${money(plan.bandHigh)}.">
    <rect x="${X(plan.bandLow).toFixed(1)}" y="${p.t}" width="${Math.max(2, X(plan.bandHigh) - X(plan.bandLow)).toFixed(1)}" height="${H - p.t - p.b}" fill="#F0B79A" opacity="0.55"/>
    ${[0, 0.5, 1].map((t) => `<line x1="${p.l}" x2="${W - p.r}" y1="${Yp(t).toFixed(1)}" y2="${Yp(t).toFixed(1)}" stroke="#DDD7C8"/><text x="${p.l - 8}" y="${(Yp(t) + 4).toFixed(1)}" text-anchor="end">${Math.round(t * 100)}%</text>`).join("")}
    ${plan.floor >= x0 && plan.floor <= x1 ? `<line x1="${X(plan.floor).toFixed(1)}" x2="${X(plan.floor).toFixed(1)}" y1="${p.t}" y2="${H - p.b}" stroke="#5A5F58" stroke-dasharray="4 4"/><text x="${(X(plan.floor) + 4).toFixed(1)}" y="${p.t + 12}">Margin floor</text>` : ""}
    <path d="${line((q) => Yp(q.p))}" fill="none" stroke="#B4431A" stroke-width="3"/>
    <path d="${line((q) => Ye(q.e))}" fill="none" stroke="#1F3A2E" stroke-width="3"/>
    <circle cx="${X(best.price).toFixed(1)}" cy="${Ye(best.e).toFixed(1)}" r="6" fill="#1F3A2E"/>
    ${inR(fp) ? `<line x1="${X(fp).toFixed(1)}" x2="${X(fp).toFixed(1)}" y1="${p.t}" y2="${H - p.b}" stroke="#1B1F1C" stroke-width="2"/>` : ""}
    ${ticks.map((v) => `<text x="${X(v).toFixed(1)}" y="${H - 16}" text-anchor="middle">${money0(v)}</text>`).join("")}
    <text x="${W - p.r + 8}" y="${p.t + 10}">Profit</text>
  </svg>`;
}

function renderPrice() {
  const R = S.R, plan = S.plan, fp = finalPrice();
  $("#price-out", root).innerHTML = `
    ${chartSVG(plan, R.cost, fp)}
    <div class="legend"><span><i style="background:#B4431A"></i>Chance of winning</span><span><i style="background:#1F3A2E"></i>Expected profit</span><span><i style="background:#F0B79A;height:10px"></i>Suggested band</span><span><i style="background:#1B1F1C"></i>Your price</span></div>
    <div class="stats">
      <div class="stat"><b>${money(plan.suggested)}</b><span>Suggested price per part</span></div>
      <div class="stat"><b>${money(plan.bandLow)} to ${money(plan.bandHigh)}</b><span>Band within 7 percent of best expected profit</span></div>
      <div class="stat"><b>${pct(plan.pWin)}</b><span>Estimated chance of winning at the suggested price</span></div>
    </div>
    <p class="small muted" style="margin-top:14px">The curve comes from ${db.getHistory().length} past quotes with a recorded result, blended with a cautious default. Expected profit assumes the cost risk is partly realized (30 percent of the way from likely to high). Sample history is illustrative. Replace it by logging your own outcomes.</p>`;
}

function renderApprove() {
  const R = S.R, plan = S.plan, fp = finalPrice(), qty = R.inp.qty;
  const p = plan.curve(fp / R.cost.likely + plan.delta);
  const margin = (fp - R.cost.likely) / fp;
  const below = fp < plan.floor;
  $("#approve-out", root).innerHTML = `
    <div class="stats" style="margin-top:0;grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="stat"><b>${money0(fp * qty)}</b><span>Order total at this price</span></div>
      <div class="stat"><b>${pct(margin)}</b><span>Margin on the likely cost</span></div>
      <div class="stat"><b>${pct(p)}</b><span>Estimated chance of winning</span></div>
      <div class="stat"><b>${money0(p * (fp - plan.costExp) * qty)}</b><span>Expected profit</span></div>
    </div>
    ${below ? `<p class="small" style="color:var(--accent);font-weight:600;margin-top:10px">This price is below your minimum margin of ${pct(db.getShop().minMargin)}. Raise it or approve knowingly.</p>` : ""}`;
}

function renderSummary() {
  const R = S.R, c = R.cost, plan = S.plan, fp = finalPrice();
  const open = R.gaps.filter((g) => ["high", "medium", "low"].includes(g.severity)).length;
  const flags = R.gaps.filter((g) => g.severity === "flag");
  const lead = R.needDays != null ? `About ${R.lead} days. Needed in ${Math.round(R.needDays)}.` : `About ${R.lead} days.`;
  const late = R.needDays != null && R.lead > R.needDays;
  $("#summary", root).innerHTML = `<div class="summary">
    <div><div class="s-lab">Cost per part</div><div class="s-big">${money(c.low)} to ${money(c.high)}</div></div>
    ${rangeBar(c.low, c.likely, c.high, c.low * 0.9, c.high * 1.08)}
    <hr>
    <div><div class="s-lab">Price per part</div><div class="s-big">${money(fp)}</div><div class="s-lab">Band ${money(plan.bandLow)} to ${money(plan.bandHigh)}</div></div>
    <hr>
    <div><div class="s-lab">Lead time on ${esc(R.chosen.name.toLowerCase())}</div><div>${lead}</div></div>
    <div>${open ? `<span class="badge warn">${open} open question${open === 1 ? "" : "s"}</span>` : `<span class="badge">No open questions</span>`}${late ? `<span class="badge warn">Misses the date</span>` : ""}${flags.map(() => `<span class="badge warn">Export control flag</span>`).join("")}${R.calib.applied ? `<span class="badge">Adjusted by ${R.calib.n} past jobs</span>` : `<span class="badge warn">Thin history</span>`}</div>
    <button type="button" class="btn btn-primary" id="btn-jump" style="border-color:#F0B79A">Review and approve</button>
  </div>`;
}

/* ---------- Approve and copy ---------- */
function titleFromText() {
  const first = (S.text || "").split(/\n/).map((s) => s.trim()).find(Boolean) || "Quote";
  return first.length > 64 ? first.slice(0, 61) + "..." : first;
}

function approve() {
  if (!S.R) return;
  const R = S.R, fp = finalPrice();
  const q = {
    id: "Q-" + Date.now().toString(36).toUpperCase(),
    ts: new Date().toISOString(),
    title: titleFromText(),
    qty: R.inp.qty, materialId: R.inp.mat.id, materialName: R.inp.mat.name, finishId: R.inp.finish.id,
    dims: R.inp.dims, tol: R.inp.tol, complexity: R.inp.complexity,
    route: R.chosen.id, routeName: R.chosen.name,
    modelCost: R.chosen.cost.total, costLikely: R.cost.likely, costLow: R.cost.low, costHigh: R.cost.high,
    price: Math.round(fp * 100) / 100, markup: fp / R.cost.likely,
    adjPct: S.adjPct || 0, reasonTag: S.adjPct ? S.reasonTag : null, note: S.note || "",
    outcome: null, actual: null
  };
  db.addQuote(q);
  toast("Saved to the quote log.");
}

function quoteText() {
  const R = S.R, fp = finalPrice();
  const open = R.gaps.filter((g) => ["high", "medium", "low"].includes(g.severity));
  const lines = [
    `Quote: ${titleFromText()}`,
    `Quantity: ${num(R.inp.qty)}`,
    `Material: ${R.inp.mat.name}`,
    `Process: ${R.chosen.name}`,
    `Finish: ${R.inp.finish.name}`,
    `Price per part: ${money(fp)}`,
    `Order total: ${money0(fp * R.inp.qty)}`,
    `Estimated lead time: about ${R.lead} days`
  ];
  if (open.length) lines.push("", "Assumptions to confirm:", ...open.map((g) => `- ${g.title}`));
  return lines.join("\n");
}

/* ---------- Settings ---------- */
function renderSettings() {
  const shop = db.getShop();
  const mats = db.getMaterials();
  const today = db.today();
  const age = (m) => Math.round((new Date(today) - new Date(m.checkedAt)) / 86400000);
  $("#settings-in", root).innerHTML = `
    <div class="two">
      ${["mill", "turn", "sheet", "cast"].map((k) => `<div class="field"><label for="set-r-${k}">${k === "mill" ? "Mill" : k === "turn" ? "Lathe" : k === "sheet" ? "Sheet" : "Cast finish"} rate ($/hr)</label><input type="number" id="set-r-${k}" data-rate="${k}" value="${shop.machineRates[k]}" step="1" min="0"></div>`).join("")}
      <div class="field"><label for="set-labor">Labor ($/hr)</label><input type="number" id="set-labor" value="${shop.laborRate}" step="1" min="0"></div>
      <div class="field"><label for="set-oh">Overhead multiplier</label><input type="number" id="set-oh" value="${shop.overhead}" step="0.01" min="1"></div>
      <div class="field"><label for="set-min">Minimum margin (%)</label><input type="number" id="set-min" value="${Math.round(shop.minMargin * 100)}" step="1" min="0" max="60"></div>
    </div>
    <div><b class="small">Material prices ($/lb)</b>
      <div class="stack" style="gap:8px;margin-top:8px" id="mat-list">
        ${mats.map((m) => `<div class="mat-row"><div>${esc(m.name)}<div class="mat-age ${age(m) > 45 ? "stale" : ""}">Checked ${age(m)} days ago</div></div><input type="number" step="0.01" min="0" value="${m.pricePerLb}" data-mat="${m.id}" aria-label="${esc(m.name)} price per pound"><button type="button" class="btn btn-sm" data-check="${m.id}">Checked today</button></div>`).join("")}
      </div>
    </div>
    <button type="button" class="btn btn-sm" id="btn-reset">Reset all saved data</button>`;
  const inn = $("#settings-in", root);
  inn.oninput = (e) => {
    const t = e.target;
    const v = parseFloat(t.value);
    if (!Number.isFinite(v)) return;
    if (t.dataset.rate) db.setShop({ machineRates: { [t.dataset.rate]: v } });
    else if (t.id === "set-labor") db.setShop({ laborRate: v });
    else if (t.id === "set-oh") db.setShop({ overhead: Math.max(1, v) });
    else if (t.id === "set-min") db.setShop({ minMargin: clampPct(v) });
    else if (t.dataset.mat) db.setMaterial(t.dataset.mat, { pricePerLb: v, checkedAt: db.today() });
    else return;
    if (S.fields) update();
  };
  inn.onclick = (e) => {
    const c = e.target.closest("[data-check]");
    if (c) { db.setMaterial(c.dataset.check, { checkedAt: db.today() }); renderSettings(); $("#settings", root).open = true; if (S.fields) update(); toast("Price marked as checked today."); return; }
    if (e.target.closest("#btn-reset") && window.confirm("Remove all saved quotes, rules and settings from this browser?")) { db.resetAll(); S = fresh(); renderApp(root); toast("Saved data cleared."); }
  };
}
const clampPct = (v) => Math.min(0.6, Math.max(0, v / 100));
