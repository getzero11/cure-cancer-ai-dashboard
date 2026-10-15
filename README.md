# Cure Cancer With AI / Observatory

A responsive oncology signal dashboard built for Vercel and Docker. It reads the Cure Cancer With AI REST API through a server-side Next.js route, so the API key is never sent to the browser.

## What it displays

- Research papers, news, editorial posts, FDA approvals, and clinical trials
- Cancer-type filters for lung, breast, prostate, colorectal, melanoma, leukemia, and lymphoma
- Cross-source keyword filtering
- Source totals, latest signal rows, clinical-trial watch, approval shelf, refresh health, and API budget status
- Source links for PubMed, FDA, ClinicalTrials.gov, and Cure Cancer With AI records
- A clearly marked preview mode when no API key is configured

The dashboard is informational only and is not medical advice.

## Requirements

- Node.js `20.9.0` (the version is pinned in `.nvmrc` and `package.json`)
- npm `10.1.x` (the package manager is recorded in `package.json`)
- Docker 24+ only if you want to use the container workflow

## Setup

Install exactly from the committed npm lockfile:

```bash
npm ci
```

Create a local environment file. On macOS/Linux:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and set `CCWAI_API_KEY` to a key created at <https://www.curecancerwithai.com/api-keys>. The key is optional for local UI work: leaving it blank intentionally uses preview data. Never commit `.env.local` or place a real key in source, browser code, screenshots, logs, or Docker build arguments.

## Run locally

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000>.

For a production-like local run:

```bash
npm run build
npm run start
```

## Test and checks

Run the single reproducible validation command:

```bash
npm test
```

This runs the TypeScript check and a production Next.js build. The build also verifies the standalone output used by Docker. The clinical-trials route accepts the documented `data` response shape and the compatible `items`/nested-items shape, normalizes common registry field names, surfaces source errors in the trial panel, and does not cache partial/error snapshots.

## Docker

Build the production image from a clean dependency install:

```bash
docker build -t cure-cancer-ai-dashboard .
```

Run it with the API key supplied only at runtime:

```bash
docker run --rm -p 3000:3000 --env-file .env.local cure-cancer-ai-dashboard
```

Open <http://localhost:3000>. The Dockerfile uses the pinned Node 20.9.0 runtime and Next.js standalone output. `.dockerignore` excludes local dependencies, build output, Git metadata, and environment files from the build context.

## Vercel deployment

1. Import the Git repository into Vercel.
2. Set `CCWAI_API_KEY` under **Project Settings → Environment Variables** for the Production environment (and Preview/Development when needed).
3. Redeploy after changing the variable. Vercel does not make a newly added server-side variable available to an already-built deployment until it is redeployed.
4. Open the generated Vercel URL and check `/api/dashboard?cancerType=all` if the board needs troubleshooting.

The browser calls only `/api/dashboard`; the API key remains server-side. A live response has `mode: "live"` and `datasets.clinicalTrials.items`. If the clinical-trials panel reports an error, the panel now shows the upstream failure rather than disguising it as an empty successful result. A deployment without `CCWAI_API_KEY` is expected to show preview records and a preview notice.

The browser refreshes every five minutes. The route uses a short-lived in-memory cache only for complete live snapshots; partial or failed snapshots are retried instead of being cached as empty data.

## Repository portability

- `package-lock.json` is the dependency lockfile; use `npm ci` for rebuilds.
- `.nvmrc`, `package.json`, and `Dockerfile` pin the Node runtime.
- `.env.example` documents the only required setting without containing a credential.
- Local build output, dependencies, environment files, supplied credential-bearing source text, and machine-specific generated files are ignored.
