# Cure Cancer With AI / Observatory

A responsive oncology signal dashboard built for Vercel. It reads the Cure Cancer With AI REST API through a server-side Next.js route, so the API key is never sent to the browser.

## What it displays

- Research papers, news, editorial posts, FDA approvals, and clinical trials
- Cancer-type filters for lung, breast, prostate, colorectal, melanoma, leukemia, and lymphoma
- Cross-source keyword filtering
- Source totals, latest signal rows, clinical-trial watch, approval shelf, refresh health, and API budget status
- Source links for PubMed, FDA, ClinicalTrials.gov, and Cure Cancer With AI records
- A safe preview mode when no API key is configured
- Dark observatory UI with clickable source tiles, a seven-day visible-sample pulse chart, connected source map, trial table, approval shelf, animated scan/pulse details, and record detail drawer

The dashboard is informational only and is not medical advice.

## Run locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
Copy-Item .env.example .env.local
# Edit .env.local and set CCWAI_API_KEY to a key created at:
# https://www.curecancerwithai.com/api-keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If `CCWAI_API_KEY` is not set, the app intentionally displays a clearly marked preview dataset. This makes the UI testable without putting a credential in source control.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add `CCWAI_API_KEY` under **Project Settings → Environment Variables** for Production, Preview, and Development as appropriate.
3. Deploy and open the generated Vercel URL.

The key must be added as a server-side environment variable. Do not add it to `NEXT_PUBLIC_*`, browser code, screenshots, logs, or committed files.

The browser refreshes the dashboard every five minutes. The app’s `/api/dashboard` route makes one request per source lane per refresh and reads the source rate-limit headers. The documented free tier allows 100 requests per rolling hour per key; the UI therefore shows the remaining budget when the live API provides it. MCP is not required for this scheduled dashboard flow.

## Checks

```bash
npm run typecheck
npm run build
```

`npm run typecheck` verifies the TypeScript route and UI. `npm run build` verifies the production Next.js bundle.
