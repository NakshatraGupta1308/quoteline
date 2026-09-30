# Quoteline

An AI-enabled quoting workspace for small and midsize manufacturers. It is a static web app (plain HTML, CSS and JavaScript modules). There is no build step and no server to run.

Pages:

- **Home** (`#/`): the pitch, with a sample quote calculated live by the same engine the workspace uses.
- **Workspace** (`#/app`): paste a customer request and work through the quote.
- **Quote log** (`#/log`): record results and actual costs, and adopt shop rules the system suggests.
- **Pilot** (`#/pilot`): landing page with a request form.

## What the workspace does

1. **Reads the request.** Pulls out quantity, material, size, tolerance, finish, delivery, certificates and export control markings, and shows the text each value came from.
2. **Finds gaps and conflicts.** Missing or contradictory details are listed with how much each one widens the range, and a draft message to the customer is written.
3. **Compares ways to make the part.** Mill, lathe, laser and bend, or cast then machine, each with cost, lead time, fit and scrap risk.
4. **Builds a cost range, not a number.** Named drivers (assumptions, price age, thin history, rush) set the low and high ends.
5. **Uses past jobs.** Comparable jobs are scored and shown with how they differ. Close jobs with a recorded actual cost adjust the estimate.
6. **Suggests a price band.** Combines cost risk, customer type, buying style, shop capacity and a win chance curve built from past quotes.
7. **Learns.** Cycle time adjustments and their reasons are logged. Two matching adjustments become a suggested shop rule.

The estimator can change any field, pick a different route, adjust cycle time and set the final price. Nothing is sent anywhere.

## How the demo is built (be clear with your audience)

- Request reading, costing and pricing run locally in the browser using transparent rules in `js/engine.js`. Every number can be traced.
- Sample materials, finishes, rates and past jobs in `js/data.js` and `js/config.js` are **illustrative**. Replace them with the shop's real data.
- Data (saved quotes, rules, settings, pilot requests) is stored in the visitor's browser only (`localStorage`). There is no database.
- The reading step (`parseRequest`) is where a language model belongs for messy emails and drawings. It returns a plain object, so a model can replace it without changing the rest of the app.

## Run locally

```powershell
cd quoteline
npx serve .
```

Then open the address it prints. Run the engine tests with:

```powershell
npm test
```

## Deploy to Vercel

### Option A: from PowerShell (about two minutes)

1. Install Node.js from nodejs.org if you do not have it.
2. In PowerShell:

```powershell
cd quoteline
npm install -g vercel
vercel login
vercel --prod
```

3. Answer the prompts:
   - Set up and deploy? **Y**
   - Which scope? your account
   - Link to existing project? **N**
   - Project name: your choice, for example `quoteline`
   - Directory with your code: `./`
   - Override settings? **N** (there is nothing to build)

Vercel prints the live address when it finishes.

### Option B: from GitHub

1. Push this folder to a new GitHub repository.
2. On vercel.com choose **Add New, Project** and import the repository.
3. Framework preset: **Other**. Leave build command and output directory empty. Deploy.

Every push to the main branch then redeploys automatically.

## Customize

- **Name and shop defaults:** `js/config.js` (brand name, machine rates, labor, overhead, minimum margin).
- **Contact email for the pilot form:** `contactEmail` in `js/config.js`. When set, the form opens a ready-to-send email. When empty, requests are only saved on the visitor's device.
- **Materials, finishes, sample requests, past jobs:** `js/data.js`.
- **Colors and type:** variables at the top of `css/styles.css`.
- **Placeholders to fill in before sharing publicly:** response time, data handling terms and integration notes in `js/views/pilot.js` (search for text in square brackets).

## Files

```
index.html          page shell
vercel.json         clean URLs and basic security headers
css/styles.css      all styling
js/main.js          router and page shell
js/config.js        brand and shop defaults
js/data.js          sample materials, finishes, requests, past jobs
js/engine.js        reading, gaps, routes, cost, uncertainty, pricing, learning
js/store.js         browser storage
js/ui.js            small helpers
js/views/           home, workspace, quote log, pilot pages
tests/              engine tests (node --test)
```

## Known limits

- The reading step handles common phrasing in plain text. Drawings and PDFs are not read in this build.
- The cost model is a simplified shop model, good for showing how information flows and how uncertainty is handled. Calibrate it with real rates and real past jobs before relying on it.
- With few past jobs the win chance curve leans on a cautious default. It gets better as outcomes are logged.
