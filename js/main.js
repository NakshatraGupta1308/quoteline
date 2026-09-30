import { CONFIG } from "./config.js";
import { homeView } from "./views/home.js";
import { pilotView, bindPilot } from "./views/pilot.js";
import { renderApp } from "./views/app.js";
import { renderLog } from "./views/log.js";
import { esc } from "./ui.js";

const root = document.getElementById("root");

const NAV = [
  { id: "home", href: "#/", label: "Home" },
  { id: "app", href: "#/app", label: "Workspace" },
  { id: "log", href: "#/log", label: "Quote log" },
  { id: "pilot", href: "#/pilot", label: "Pilot", cta: true }
];

function shell() {
  root.innerHTML = `
    <a class="skip" href="#main" id="skip">Skip to content</a>
    <header class="nav"><div class="wrap nav-in">
      <a class="brand" href="#/"><i></i>${esc(CONFIG.brand)}</a>
      <nav class="nav-links" aria-label="Main">${NAV.map((n) => `<a href="${n.href}" data-nav="${n.id}" class="${n.cta ? "cta" : ""}">${n.label}</a>`).join("")}</nav>
    </div></header>
    <main id="main" tabindex="-1"></main>
    <footer class="foot"><div class="wrap foot-in">
      <div><a class="brand" href="#/"><i></i>${esc(CONFIG.brand)}</a><p>Decision support for manufacturing quotes. The estimator always has the final say.</p></div>
      <nav aria-label="Footer"><a href="#/app">Workspace</a><a href="#/log">Quote log</a><a href="#/pilot">Pilot</a></nav>
    </div></footer>`;
  document.getElementById("skip").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("main").focus();
  });
}

function parse() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  return { name: parts[0] || "home", arg: parts[1] || null };
}

function render() {
  const { name, arg } = parse();
  const main = document.getElementById("main");
  const active = ["home", "app", "log", "pilot"].includes(name) ? name : "home";
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === active ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  main.onchange = null;
  main.onclick = null;
  if (active === "home") { main.innerHTML = homeView(); document.title = `${CONFIG.brand}: quote fast without guessing`; }
  else if (active === "pilot") { main.innerHTML = pilotView(); bindPilot(main); document.title = `${CONFIG.brand}: request a pilot review`; }
  else if (active === "log") { renderLog(main); document.title = `${CONFIG.brand}: quote log`; }
  else { renderApp(main, arg); document.title = `${CONFIG.brand}: quote workspace`; }
  window.scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
}

shell();
window.addEventListener("hashchange", render);
render();
