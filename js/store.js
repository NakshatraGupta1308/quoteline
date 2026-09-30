// All data stays in the visitor's browser (localStorage). Nothing is sent anywhere.
import { CONFIG } from "./config.js";
import { MATERIALS, FINISHES, HISTORY_RAW } from "./data.js";
import { hydrateHistory } from "./engine.js";

const KEY = "quoteline.v1";
const iso = (d) => d.toISOString().slice(0, 10);
export const today = () => iso(new Date());

const blank = () => ({ firstRun: today(), shop: {}, matOv: {}, quotes: [], rules: [], pilot: [] });
let db = blank();
try {
  db = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
} catch (e) {
  db = blank();
}
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ }
};
persist();

const agoFrom = (base, n) => iso(new Date(new Date(base).getTime() - n * 86400000));

// Sample history is computed once against the default settings so its "actual" costs stay fixed.
export const baseHistory = hydrateHistory(HISTORY_RAW, MATERIALS, FINISHES, CONFIG.shop);

export function getMaterials() {
  return MATERIALS.map((m) => {
    const o = db.matOv[m.id] || {};
    return { ...m, pricePerLb: o.pricePerLb != null ? o.pricePerLb : m.pricePerLb, checkedAt: o.checkedAt || agoFrom(db.firstRun, m.ageDays) };
  });
}

export function getShop() {
  const s = db.shop || {};
  return { ...CONFIG.shop, ...s, machineRates: { ...CONFIG.shop.machineRates, ...(s.machineRates || {}) } };
}

export function getHistory() {
  const logged = db.quotes
    .filter((q) => q.outcome === "won" || q.outcome === "lost")
    .map((q) => ({
      id: q.id, name: q.title, materialId: q.materialId, qty: q.qty, dims: q.dims, tol: q.tol, finishId: q.finishId,
      route: q.route, complexity: q.complexity, modelCost: q.modelCost, actual: q.actual != null ? q.actual : null,
      costBasis: q.actual != null ? q.actual : q.costLikely, price: q.price, won: q.outcome === "won", source: "logged"
    }));
  return [...baseHistory, ...logged];
}

export const getRules = () => db.rules;
export const getQuotes = () => db.quotes;

export function getCtx(extra = {}) {
  return { materials: getMaterials(), finishes: FINISHES, shop: getShop(), rules: db.rules, history: getHistory(), today: today(), ...extra };
}

export function addQuote(q) { db.quotes.unshift(q); persist(); }
export function setOutcome(id, outcome, actual) {
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return;
  q.outcome = outcome || null;
  q.actual = actual != null && actual > 0 ? actual : null;
  persist();
}
export function adoptRule(rule) {
  if (db.rules.some((r) => r.materialId === rule.materialId && r.tag === rule.tag)) return;
  db.rules.push({ id: "R-" + Date.now().toString(36), ...rule, adoptedAt: today() });
  persist();
}
export function removeRule(id) { db.rules = db.rules.filter((r) => r.id !== id); persist(); }
export function setShop(patch) { db.shop = { ...db.shop, ...patch, machineRates: { ...(db.shop.machineRates || {}), ...(patch.machineRates || {}) } }; persist(); }
export function setMaterial(id, patch) { db.matOv[id] = { ...(db.matOv[id] || {}), ...patch }; persist(); }
export function addPilot(req) { db.pilot.push({ ...req, ts: new Date().toISOString() }); persist(); }
export function resetAll() { db = blank(); persist(); }
