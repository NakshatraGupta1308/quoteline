export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (n, d = 2) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const money0 = (n) => money(n, 0);
export const pct = (n, d = 0) => (n * 100).toFixed(d) + "%";
export const num = (n) => Number(n).toLocaleString("en-US");
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function fmtDate(isoStr) {
  try { return new Date(isoStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return isoStr; }
}

// Re-render a container but keep keyboard focus on the same control.
export function keepFocus(container, render) {
  const a = document.activeElement;
  const key = a && container.contains(a) ? a.getAttribute("data-key") : null;
  render();
  if (key) {
    const again = container.querySelector(`[data-key="${key}"]`);
    if (again) again.focus();
  }
}

export function rangeBar(low, likely, high, scaleLow, scaleHigh) {
  const span = scaleHigh - scaleLow || 1;
  const p = (v) => ((v - scaleLow) / span) * 100;
  return `<div class="rangebar" role="img" aria-label="Cost range from ${money(low)} to ${money(high)}, likely ${money(likely)}">
    <div class="rangebar-fill" style="left:${p(low).toFixed(1)}%;width:${(p(high) - p(low)).toFixed(1)}%"></div>
    <div class="rangebar-mark" style="left:${p(likely).toFixed(1)}%"></div>
  </div>
  <div class="rangebar-labels"><span>${money(low)}</span><span>${money(likely)}</span><span>${money(high)}</span></div>`;
}

export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* ignore */ }
  ta.remove();
  return Promise.resolve();
}
