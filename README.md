# ZEROHUE

<div align="center">
  <img src="public/logo.png" alt="ZEROHUE logo" width="220" />
</div>

ZEROHUE is a local-first crypto trading simulator built with React, TypeScript, Zustand, and a
Web Worker matching engine. The app combines live market context, deterministic paper execution,
and on-device persistence without requiring an account.

This repository is published for source-available reference and technical review. It is publicly
readable on GitHub, but it is **not** an open-source project.

## Repository posture

- Publicly readable source code
- All rights reserved; see [LICENSE.md](LICENSE.md)
- External Issues and PRs are not accepted by default
- Simulation only; no custody, deposits, or live brokerage integration

## Current runtime characteristics

- Tradable universe: **37 assets**
- Source strategy: fixed single-source routing per asset
- Coinbase-routed assets: `HYPE`, `CRO`, `WLFI`, `IP`
- Order support: market, limit, take-profit, and stop-loss
- Execution semantics: deterministic trigger-price settlement for limit / TP / SL
- Holdings model: FIFO lots internally, aggregated positions in the portfolio UI
- Persistence: `portfolio` in localStorage, orders / transactions / market history in IndexedDB
- Startup flow: hydration and offline replay must settle before the live engine becomes ready

## Stack

- React 19
- TypeScript 5.8
- Vite 6
- Zustand 5
- Framer Motion
- IndexedDB via `idb`
- Vitest + Playwright

## Getting started

### Prerequisites

- Node.js 20+ supported (CI baseline: Node.js 24)
- npm

### Install

```bash
git clone <your-repo-url>
cd zerohue
npm install
```

### Start the app

```bash
npm run dev
```

The development server runs at `http://localhost:3000`.

### Optional: install Playwright browsers

```bash
npx playwright install
```

## Quality gates

Fast local gate:

```bash
npm run type-check
npm run lint
npm run test
npm run build
npm run test:e2e:chromium
```

Full browser matrix:

```bash
npm run test:e2e:matrix
```

Playwright defaults:

- CI runs with `1` worker for stability
- Local runs use `2` workers to reduce wall-clock time
- `npm run type-check` checks both the app source and Playwright test/config files

Available scripts:

```bash
npm run dev
npm run build
npm run preview
npm run type-check
npm run lint
npm run test
npm run test:e2e:chromium
npm run test:e2e
npm run test:e2e:matrix
npm run test:e2e:ui
```

## Windows note

If PowerShell blocks `npm.ps1`, run commands from Command Prompt or Git Bash, or temporarily relax
the execution policy for the current shell session:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

## Repo map

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): runtime structure and data-flow notes
- `src/App.tsx`: route composition, shell layout, startup orchestration
- `src/workers/marketEngine.worker.ts`: matching engine and trigger execution
- `src/hooks/useOfflineOrderExecution.tsx`: offline replay reconciliation
- `src/components/views/IntroView.tsx`: public landing page

## Notes for reviewers

- The repository does not include a backend service or exchange custody layer.
- Market data is sourced from public Binance and Coinbase endpoints for simulation purposes.
- No additional runtime environment variables are required for the default local setup.

## License

This repository is source-available and all rights are reserved. You may inspect and evaluate the
code, but you may not redistribute, commercialize, or reuse it without prior written permission.
See [LICENSE.md](LICENSE.md) for the full terms.
