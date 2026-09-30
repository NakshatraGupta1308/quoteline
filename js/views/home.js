import { SAMPLES } from "../data.js";
import { parseRequest, runPipeline, pricePlan } from "../engine.js";
import { getCtx } from "../store.js";
import { esc, money, rangeBar } from "../ui.js";

const STEPS = [
  ["Understand the request", "Reads emails, prints and specs. Lists what is missing or in conflict.", "Confirm unclear callouts and answer open questions."],
  ["Choose how to make it", "Compares routes on cost, lead time and scrap risk.", "Pick or edit the route that fits your shop."],
  ["Build the estimate", "Adds up material, machine time, labor, setup and outside work.", "Adjust assumptions where your experience differs."],
  ["Size the uncertainty", "Turns gaps, old prices and thin history into a range with named reasons.", "Decide which risks are worth accepting."],
  ["Set the price", "Links the range to capacity, the customer and the chance of winning.", "Choose the number you will stand behind."],
  ["Review and send", "Drafts the quote and any question for the customer.", "Approve, edit or hold the quote."],
  ["Track the outcome", "Records won or lost, and actual cost when the job ships.", "Note why a quote was won or lost."]
];

export function homeView() {
  const ctx = getCtx();
  const f = parseRequest(SAMPLES[0].text, ctx.materials, ctx.finishes);
  const R = runPipeline(f, ctx);
  const plan = pricePlan(R.cost, { relationship: "new", sensitivity: "neutral", capacity: "normal" }, ctx.history, ctx.shop, R.inp.qty);
  const c = R.cost;
  const top = R.drivers.slice(0, 3);
  const comps = R.comps.slice(0, 3);

  return `
  <div class="wrap hero">
    <div class="stack">
      <p class="label">AI quoting for small and midsize manufacturers</p>
      <h1>Quote fast without guessing.</h1>
      <p class="lead">Quoteline reads the request, flags what is missing, compares ways to make the part, and hands your estimator a cost range with reasons. You keep the final call on every price.</p>
      <div class="row" style="padding-top:6px">
        <a class="btn btn-primary btn-lg" href="#/app/bracket">Try the workspace</a>
        <a class="btn btn-lg" href="#/pilot">Book a pilot review</a>
      </div>
      <p class="muted small" style="max-width:520px">Built around the steps every shop already follows, from customer request to submitted quote.</p>
    </div>
    <div class="quote-card" aria-label="Sample draft quote, calculated live">
      <div class="row" style="justify-content:space-between"><span class="label">Draft quote</span><span class="pill">Sample request, calculated live</span></div>
      <h3>Bracket, ${esc(R.inp.mat.name)}, ${R.inp.qty} pieces</h3>
      <div><div class="muted small">Estimated cost per part</div><div class="big">${money(c.low)} to ${money(c.high)}</div></div>
      ${rangeBar(c.low, c.likely, c.high, c.low * 0.92, c.high * 1.06)}
      <div><b class="small">What drives the gap</b>
        <ul class="bullets" style="margin-top:8px;font-size:15px">${top.map((d) => `<li>${esc(d.label)}</li>`).join("")}</ul></div>
      <div class="band"><span class="small muted">Suggested price band</span><span class="mono">${money(plan.bandLow)} to ${money(plan.bandHigh)}</span></div>
      <a class="btn btn-primary" href="#/app/bracket">Open this quote</a>
    </div>
  </div>

  <div class="bg-sand" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
    <div class="wrap" style="padding-top:28px;padding-bottom:28px">
      <div class="row" style="gap:16px">
        <span class="label" style="margin-right:8px">What it works from</span>
        <div class="chips"><span class="chip">Pasted request emails</span><span class="chip">Your shop rates</span><span class="chip">Past quotes and results</span><span class="chip">Material price age</span><span class="chip">Estimator corrections</span></div>
      </div>
    </div>
  </div>

  <section class="block" id="process"><div class="wrap">
    <div class="section-head"><p class="label">How it works</p><h2>Seven steps, one connected decision.</h2>
      <p class="lead">Each step hands its result to the next. A missing tolerance at step one shows up as a wider range at step four, not as a surprise on the shop floor.</p></div>
    <ol class="grid-4" style="list-style:none;margin:0;padding:0">
      ${STEPS.map((s, i) => `<li class="card"><div class="step-no">${String(i + 1).padStart(2, "0")}</div><h3>${s[0]}</h3>
        <p class="small" style="margin-top:8px"><b>Software</b><br>${s[1]}</p><p class="small" style="margin-top:10px"><b>You</b><br>${s[2]}</p></li>`).join("")}
      <li class="card bg-green" style="border-color:var(--green)"><div class="step-no" style="color:var(--blush)">Loop</div><h3>Every correction teaches the system.</h3>
        <p class="small" style="margin-top:8px;color:var(--green-2)">When your estimator changes a number, the reason is logged. Repeated reasons become shop rules you can read and edit.</p></li>
    </ol>
  </div></section>

  <section class="block bg-green"><div class="wrap grid-2" style="align-items:center;gap:72px">
    <div class="stack" style="gap:22px">
      <p class="label">Risk and uncertainty</p><h2>One number hides the risk.</h2>
      <p class="lead">A single price looks certain even when it is not. Quoteline shows a low, likely and high estimate, names what widens the gap, and shows how each past job differs from the one in front of you.</p>
      <ul class="bullets"><li>Different quantity, tolerance or material is called out, not hidden.</li><li>Old supplier prices are flagged before they reach a quote.</li><li>Thin history widens the range instead of faking confidence.</li></ul>
    </div>
    <div class="card" style="background:var(--paper);color:var(--ink)">
      <div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Comparable past jobs</h3><span class="pill" style="background:#E3DED2">Sample data</span></div>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Past job</th><th>Match</th><th>What is different</th></tr></thead><tbody>
        ${comps.map((k) => `<tr><td><b>${esc(k.id)}</b> ${esc(k.name)}</td><td class="match-${k.label}">${k.label}</td><td>${k.diffs.length ? esc(k.diffs.join(". ")) : "Same material, process and similar quantity"}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="small muted" style="margin-top:10px">Low matches stay in view but count for less, and the estimate says why.</p>
    </div>
  </div></section>

  <section class="block" id="data"><div class="wrap">
    <div class="section-head"><p class="label">Real shop conditions</p><h2>Built for the data you actually have.</h2>
      <p class="lead">Records are incomplete, prices move and the best knowledge sits in people's heads. Quoteline is designed to work through that, not around it.</p></div>
    <div class="grid-3">
      <div class="card"><div class="step-no">Gaps</div><h3>Missing details</h3><p>Asks before it guesses. Drafts the question for the customer and shows how the answer would move the estimate.</p></div>
      <div class="card"><div class="step-no">Age</div><h3>Aging information</h3><p>Every material price carries its age. Stale inputs are flagged and widen the range until someone refreshes them.</p></div>
      <div class="card"><div class="step-no">Skill</div><h3>Knowledge in heads</h3><p>A log of estimator corrections turns habits like "this alloy always runs slow" into rules the whole shop can read and edit.</p></div>
    </div>
  </div></section>

  <section class="block bg-sand" id="people"><div class="wrap">
    <div class="section-head"><p class="label">Human judgment</p><h2>Your estimator stays in charge.</h2></div>
    <div class="grid-2">
      <div class="card"><h3 style="color:var(--accent)">Quoteline handles</h3><ul class="bullets"><li>Reading requests and specs</li><li>Finding gaps and conflicts early</li><li>Laying out routes, costs and comparable jobs</li><li>Drafting the quote and follow-up messages</li></ul></div>
      <div class="card"><h3 style="color:var(--green)">You decide</h3><ul class="bullets"><li>Which manufacturing route to use</li><li>Which risks are worth accepting</li><li>How much to discount for the relationship</li><li>The final price on every quote</li></ul></div>
    </div>
  </div></section>

  <section class="block bg-accent"><div class="wrap stack" style="align-items:center;text-align:center;gap:26px">
    <h2>See it on one of your own quotes.</h2>
    <p class="lead" style="color:#fff">Paste a real request into the workspace, or send three past requests and see what Quoteline flags next to what you actually quoted.</p>
    <div class="row" style="justify-content:center"><a class="btn btn-lg btn-light" href="#/app">Open the workspace</a><a class="btn btn-lg btn-outline-light" href="#/pilot">Book a pilot review</a></div>
  </div></section>`;
}
