import { CONFIG } from "../config.js";
import * as db from "../store.js";
import { esc, $, toast } from "../ui.js";

export function pilotView() {
  return `
  <div class="wrap landing-hero">
    <div class="stack" style="gap:26px;padding-top:16px">
      <p class="label">Pilot program for Iowa manufacturers</p>
      <h1>Quote with a range you can defend.</h1>
      <p class="lead">Send us three past requests. We will show what ${esc(CONFIG.brand)} flags, how it reads your requests, and the cost range it would have given, next to what you actually quoted.</p>
      <ul class="bullets" style="font-size:18px">
        <li>Runs beside your process. Nothing goes to a customer.</li>
        <li>Works with messy files, old spreadsheets and gaps.</li>
        <li>Your estimator approves every number.</li>
      </ul>
    </div>
    <form class="form-card" id="pilot-form" novalidate>
      <div><h2 style="font-size:30px">Request a pilot review</h2><p class="muted small" style="margin-top:6px">Takes about a minute. We reply within [X business days].</p></div>
      <div class="field"><label for="p-name">Your name</label><input type="text" id="p-name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="p-shop">Shop name</label><input type="text" id="p-shop" name="shop" autocomplete="organization" required></div>
      <div class="field"><label for="p-email">Work email</label><input type="email" id="p-email" name="email" autocomplete="email" required></div>
      <div class="field"><label for="p-make">What do you mostly make?</label><select id="p-make" name="make"><option>Machined parts</option><option>Fabricated sheet metal</option><option>Castings or molded parts</option><option>Assemblies</option><option>Something else</option></select></div>
      <div class="field"><label for="p-vol">Quotes per week</label><select id="p-vol" name="volume"><option>Fewer than 5</option><option>5 to 20</option><option>21 to 50</option><option>More than 50</option></select></div>
      <p id="p-error" class="small" style="color:var(--accent);font-weight:600" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-lg">Request my review</button>
      <p class="small muted">Your files stay yours. [Add your data handling terms here.]</p>
      <div id="p-thanks" class="thanks" role="status" hidden></div>
    </form>
  </div>

  <section class="block bg-sand" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
    <h2 style="max-width:860px;margin-bottom:48px">Three things that change how you quote.</h2>
    <div class="grid-3">
      <div class="card"><div class="step-no">Read</div><h3>Read before you cost</h3><p>It reads the request and lists what is missing or conflicting before anyone spends an hour costing.</p></div>
      <div class="card"><div class="step-no">Range</div><h3>Ranges with reasons</h3><p>Each estimate shows low, likely and high, plus the named drivers behind the gap, so you know where to look first.</p></div>
      <div class="card"><div class="step-no">Price</div><h3>Prices with context</h3><p>The price band reflects your capacity, the customer and the chance of winning. You set the final number.</p></div>
    </div>
  </div></section>

  <section class="block"><div class="wrap">
    <div class="section-head"><h2>How the pilot runs</h2><p class="lead">Try it beside your process first.</p></div>
    <div class="grid-3">
      <div class="card"><div class="step-no">Phase 1</div><h3>We learn your shop</h3><p>A short conversation with your estimator, plus your past quotes in whatever shape they are in. No cleanup needed on your side.</p></div>
      <div class="card"><div class="step-no">Phase 2</div><h3>It drafts quietly</h3><p>${esc(CONFIG.brand)} drafts alongside your team on live requests. Nothing is sent. You compare its ranges with your own numbers.</p></div>
      <div class="card"><div class="step-no">Phase 3</div><h3>You choose what to trust</h3><p>Turn on the steps that earned it, such as request reading or route suggestions. Keep the rest manual for as long as you like.</p></div>
    </div>
    <p style="margin-top:28px"><a class="btn" href="#/app/bracket">Try the workspace now</a></p>
  </div></section>

  <section class="block bg-sand"><div class="wrap faq">
    <h2>Questions shop owners ask.</h2>
    <div>
      <div class="faq-item"><h3>What if our records are a mess?</h3><p>That is the expected starting point. It works from what you have, marks what is old or thin, and widens the range instead of pretending.</p></div>
      <div class="faq-item"><h3>Do we have to replace our ERP?</h3><p>No. The pilot runs next to your current tools. [Describe your integration approach here.]</p></div>
      <div class="faq-item"><h3>Who sets the price?</h3><p>You do. ${esc(CONFIG.brand)} proposes a band and shows its reasoning. Nothing is sent until your estimator approves it.</p></div>
      <div class="faq-item"><h3>What happens to our drawings and prices?</h3><p>They stay yours and are used only for your shop. [Add your security and retention details here.]</p></div>
    </div>
  </div></section>

  <section class="block bg-accent"><div class="wrap stack" style="align-items:center;text-align:center;gap:24px">
    <h2>Bring three past quotes.</h2>
    <p class="lead" style="color:#fff">We will show you what it flags, the range it gives, and where it agrees or disagrees with your own numbers.</p>
    <a class="btn btn-lg btn-light" href="#pilot-form" id="to-form">Request my review</a>
  </div></section>`;
}

export function bindPilot(root) {
  const form = $("#pilot-form", root);
  if (!form) return;
  $("#to-form", root).addEventListener("click", (e) => { e.preventDefault(); form.scrollIntoView({ behavior: "smooth", block: "center" }); $("#p-name", root).focus(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const err = $("#p-error", root);
    const bad = !d.name.trim() ? "Enter your name." : !d.shop.trim() ? "Enter your shop name." : !/^\S+@\S+\.\S+$/.test(d.email.trim()) ? "Enter a valid work email." : "";
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    err.hidden = true;
    db.addPilot(d);
    const thanks = $("#p-thanks", root);
    if (CONFIG.contactEmail) {
      const body = `Name: ${d.name}\nShop: ${d.shop}\nEmail: ${d.email}\nMakes: ${d.make}\nQuotes per week: ${d.volume}`;
      window.location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent("Pilot review request")}&body=${encodeURIComponent(body)}`;
      thanks.textContent = "Thanks. Your email app should open with the request ready to send.";
    } else {
      thanks.textContent = "Thanks. Your request is saved on this device. Set a contact email in js/config.js to have requests sent to you.";
    }
    thanks.hidden = false;
    toast("Request recorded.");
  });
}
