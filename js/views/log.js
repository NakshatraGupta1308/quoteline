import { REASON_TAGS, MATERIALS } from "../data.js";
import { suggestRules } from "../engine.js";
import * as db from "../store.js";
import { esc, money, money0, pct, num, fmtDate, toast, $ } from "../ui.js";

const tagLabel = (id) => (REASON_TAGS.find((t) => t.id === id) || { label: id }).label;
const matName = (id) => (MATERIALS.find((m) => m.id === id) || { name: id }).name;

export function renderLog(root) {
  const quotes = db.getQuotes();
  const rules = db.getRules();
  const sugg = suggestRules(quotes).filter((s) => !rules.some((r) => r.materialId === s.materialId && r.tag === s.tag));
  const decided = quotes.filter((q) => q.outcome);
  const won = decided.filter((q) => q.outcome === "won").length;

  const rows = quotes.map((q) => `<tr>
      <td>${fmtDate(q.ts)}<div class="small muted">${esc(q.id)}</div></td>
      <td><b>${esc(q.title)}</b><div class="small muted">${num(q.qty)} pcs, ${esc(q.materialName)}, ${esc(q.routeName)}</div>${q.adjPct ? `<div class="small">Adjusted ${q.adjPct > 0 ? "+" : ""}${q.adjPct}%: ${esc(tagLabel(q.reasonTag))}${q.note ? ", " + esc(q.note) : ""}</div>` : ""}</td>
      <td class="num">${money(q.price)}<div class="small muted">Cost ${money(q.costLow)} to ${money(q.costHigh)}</div></td>
      <td><label class="sr" for="oc-${q.id}">Result for ${esc(q.id)}</label>
        <select class="log-select" id="oc-${q.id}" data-outcome="${q.id}"><option value="">Open</option><option value="won" ${q.outcome === "won" ? "selected" : ""}>Won</option><option value="lost" ${q.outcome === "lost" ? "selected" : ""}>Lost</option></select></td>
      <td><label class="sr" for="ac-${q.id}">Actual cost per part for ${esc(q.id)}</label>
        <input class="log-actual" type="number" step="0.01" min="0" id="ac-${q.id}" data-actual="${q.id}" value="${q.actual != null ? q.actual : ""}" placeholder="$" ${q.outcome === "won" ? "" : "disabled"}></td>
    </tr>`).join("");

  root.innerHTML = `<div class="wrap">
    <header class="app-head">
      <h1>Quote log</h1>
      <p class="lead">Record what happened to each quote. Results and real costs make the next estimate sharper.</p>
    </header>
    <div class="stack" style="padding-bottom:96px">
      <section class="card">
        <div class="row" style="justify-content:space-between">
          <h2>Saved quotes</h2>
          <div class="log-actions">
            <a class="btn btn-primary" href="#/app">New quote</a>
            <button type="button" class="btn" id="btn-csv" ${quotes.length ? "" : "disabled"}>Export CSV</button>
          </div>
        </div>
        ${quotes.length ? `<p class="hint">${quotes.length} saved, ${decided.length} with a result${decided.length ? `, ${pct(won / decided.length)} won` : ""}. Mark a quote as won and enter the actual cost per part once the job ships.</p>
        <div class="table-scroll"><table class="tbl"><thead><tr><th>Date</th><th>Quote</th><th class="num">Price per part</th><th>Result</th><th>Actual cost</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : `<div class="empty"><p>No quotes yet.</p><p class="small">Approve a quote in the workspace and it will appear here.</p><p style="margin-top:16px"><a class="btn btn-primary" href="#/app/bracket">Try the sample bracket</a></p></div>`}
      </section>

      <section class="card">
        <h2>What the shop has learned</h2>
        <p class="hint">When the same adjustment for the same material shows up on two or more quotes, it becomes a suggested rule. Rules apply to every later estimate for that material.</p>
        ${sugg.length ? sugg.map((s) => `<div class="rule"><div><b>${esc(matName(s.materialId))}</b>: ${esc(tagLabel(s.tag))}<div class="small muted">${s.count} quotes, average ${s.adjPct > 0 ? "+" : ""}${s.adjPct}% on cycle time</div></div><button type="button" class="btn btn-sm btn-primary" data-adopt='${esc(JSON.stringify(s))}'>Adopt rule</button></div>`).join("") : `<p class="small muted">No suggestions yet. Adjust cycle time on two quotes for the same material, with the same reason, and a rule will be proposed.</p>`}
        ${rules.length ? `<div class="sub">Rules in use</div>${rules.map((r) => `<div class="rule"><div><b>${esc(matName(r.materialId))}</b>: cycle time x${r.multiplier}<div class="small muted">${esc(tagLabel(r.tag))}, adopted ${fmtDate(r.adoptedAt)}</div></div><button type="button" class="btn btn-sm" data-remove="${r.id}">Remove</button></div>`).join("")}` : ""}
      </section>
    </div>
  </div>`;

  root.onchange = (e) => {
    const o = e.target.closest("[data-outcome]");
    if (o) {
      const q = quotes.find((x) => x.id === o.dataset.outcome);
      db.setOutcome(q.id, o.value, o.value === "won" ? q.actual : null);
      renderLog(root);
      toast(o.value ? "Result recorded. Future estimates will use it." : "Result cleared.");
      return;
    }
    const a = e.target.closest("[data-actual]");
    if (a) {
      const v = parseFloat(a.value);
      const q = quotes.find((x) => x.id === a.dataset.actual);
      db.setOutcome(q.id, q.outcome, Number.isFinite(v) ? v : null);
      toast("Actual cost saved.");
    }
  };
  root.onclick = (e) => {
    const ad = e.target.closest("[data-adopt]");
    if (ad) { const s = JSON.parse(ad.getAttribute("data-adopt")); db.adoptRule({ materialId: s.materialId, tag: s.tag, multiplier: s.multiplier }); renderLog(root); toast("Rule adopted. New estimates will use it."); return; }
    const rm = e.target.closest("[data-remove]");
    if (rm) { db.removeRule(rm.dataset.remove); renderLog(root); toast("Rule removed."); return; }
    if (e.target.closest("#btn-csv")) exportCsv();
  };
}

function exportCsv() {
  const head = ["id", "date", "title", "qty", "material", "route", "price_per_part", "cost_low", "cost_likely", "cost_high", "adjust_pct", "reason", "note", "result", "actual_cost"];
  const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = db.getQuotes().map((q) => [q.id, q.ts, q.title, q.qty, q.materialName, q.routeName, q.price, q.costLow.toFixed(2), q.costLikely.toFixed(2), q.costHigh.toFixed(2), q.adjPct, q.reasonTag || "", q.note, q.outcome || "", q.actual != null ? q.actual : ""].map(cell).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quote-log.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
