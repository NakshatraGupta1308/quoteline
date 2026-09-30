import test from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, FINISHES, SAMPLES, HISTORY_RAW } from "../js/data.js";
import { CONFIG } from "../js/config.js";
import { parseRequest, runPipeline, hydrateHistory, pricePlan, suggestRules, findGaps } from "../js/engine.js";

const history = hydrateHistory(HISTORY_RAW, MATERIALS, FINISHES, CONFIG.shop);
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const materials = MATERIALS.map((m) => ({ ...m, checkedAt: daysAgo(m.ageDays) }));
const ctx = (extra = {}) => ({ materials, finishes: FINISHES, shop: CONFIG.shop, rules: [], history, today, adjPct: 0, routeId: null, ...extra });
const sample = (id) => SAMPLES.find((s) => s.id === id).text;

test("bracket sample is read correctly", () => {
  const f = parseRequest(sample("bracket"), materials, FINISHES);
  assert.equal(f.qty.value, 250);
  assert.equal(f.material.value, "al6061");
  assert.deepEqual(f.dims.value, [4, 3, 1]);
  assert.equal(f.finish.value, "anodize");
  assert.equal(f.weeks.value, 5);
  assert.equal(f.tol.value, null);
  assert.equal(f.complexity.value, 3);
});

test("shaft sample: round part, tight tolerance, certs", () => {
  const f = parseRequest(sample("shaft"), materials, FINISHES);
  assert.equal(f.qty.value, 1200);
  assert.equal(f.material.value, "ss304");
  assert.deepEqual(f.dims.value, [0.75, 0.75, 6]);
  assert.equal(f.dims.round, true);
  assert.equal(f.tol.value, 0.001);
  assert.equal(f.flags.certs, true);
});

test("enclosure sample: sheet route, bends, export flag", () => {
  const f = parseRequest(sample("enclosure"), materials, FINISHES);
  assert.equal(f.qty.value, 60);
  assert.equal(f.hints.bends, 4);
  assert.equal(f.flags.itar, true);
  assert.equal(f.weeks.rush, true);
  const r = runPipeline(f, ctx());
  assert.equal(r.chosen.id, "sheet");
});

test("messy sample reports a material conflict and missing size", () => {
  const f = parseRequest(sample("messy"), materials, FINISHES);
  assert.equal(f.material.value, null);
  assert.ok(f.material.candidates.length > 1);
  const ids = findGaps(f, materials).map((g) => g.id);
  assert.ok(ids.includes("material") && ids.includes("dims"));
});

test("filling a gap narrows the range", () => {
  const f = parseRequest(sample("bracket"), materials, FINISHES);
  const before = runPipeline(f, ctx());
  f.tol.value = 0.005;
  const after = runPipeline(f, ctx());
  const wb = (before.cost.high - before.cost.low) / before.cost.likely;
  const wa = (after.cost.high - after.cost.low) / after.cost.likely;
  assert.ok(wa < wb);
});

test("stale material price widens the range", () => {
  const f = parseRequest(sample("shaft"), materials, FINISHES);
  const fresh = materials.map((m) => ({ ...m, checkedAt: today }));
  const a = runPipeline(f, ctx({ materials: fresh }));
  const b = runPipeline(f, ctx({ materials: materials.map((m) => ({ ...m, checkedAt: daysAgo(60) })) }));
  assert.ok(b.cost.high > a.cost.high);
});

test("stainless history raises the estimate above the base model", () => {
  const f = parseRequest(sample("shaft"), materials, FINISHES);
  const r = runPipeline(f, ctx());
  assert.ok(r.calib.applied);
  assert.ok(r.calib.multiplier > 1.05);
});

test("cycle time adjustment changes cost", () => {
  const f = parseRequest(sample("bracket"), materials, FINISHES);
  const a = runPipeline(f, ctx());
  const b = runPipeline(f, ctx({ adjPct: 20 }));
  assert.ok(b.cost.likely > a.cost.likely);
});

test("price plan stays above the margin floor and has a band", () => {
  const f = parseRequest(sample("bracket"), materials, FINISHES);
  const r = runPipeline(f, ctx());
  const p = pricePlan(r.cost, { relationship: "new", sensitivity: "neutral", capacity: "normal" }, history, CONFIG.shop, r.inp.qty);
  assert.ok(p.suggested >= p.floor);
  assert.ok(p.bandLow <= p.suggested && p.suggested <= p.bandHigh);
  assert.ok(p.pWin > 0 && p.pWin < 1);
});

test("repeated overrides become a suggested rule", () => {
  const q = { materialId: "ss304", reasonTag: "slower", adjPct: 10 };
  assert.equal(suggestRules([q]).length, 0);
  const s = suggestRules([q, { ...q, adjPct: 14 }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].adjPct, 12);
});

test("every sample runs without errors", () => {
  for (const s of SAMPLES) {
    const r = runPipeline(parseRequest(s.text, materials, FINISHES), ctx());
    assert.ok(Number.isFinite(r.cost.likely) && r.cost.likely > 0, s.id);
    assert.ok(r.cost.low < r.cost.likely && r.cost.likely < r.cost.high, s.id);
  }
});
