# ZEROHUE Architecture

This document summarizes the current runtime structure, public content routes, terminal routes, and core trading data flow.

## 1. Entry, routing, and shells

- `src/index.tsx`: application bootstrap; uses `hydrateRoot(...)` when prerendered HTML already exists in `#root`, otherwise falls back to `createRoot(...)`
- `src/App.tsx`: top-level client routing, lazy public content routes, disclaimer gating, and scroll reset behavior
- `src/components/layout/TerminalShell.tsx`: terminal-only shell, startup gating, and terminal views
- `src/components/layout/PublicContentLayout.tsx`: lightweight shell for indexable FAQ / About / Learn / Glossary routes; reuses the shared site footer without the landing CTA block
- `src/components/layout/SiteFooter.tsx`: shared footer used by the landing page and `PublicContentLayout` routes
- `src/prerender/renderPublicRoute.tsx`: build-time server-side route tree used only for prerendering public pages into real React DOM

Public routes:

- `/` -> `IntroView`
- `/faq` -> `FAQView` inside `PublicContentLayout`
- `/about` -> `AboutView` inside `PublicContentLayout`
- `/learn` -> `LearnHubView` inside `PublicContentLayout`
- `/learn/:slug` -> `LearnArticleView` inside `PublicContentLayout`
- `/glossary` -> `GlossaryHubView` inside `PublicContentLayout`
- `/glossary/:slug` -> `GlossaryEntryView` inside `PublicContentLayout`
- `/legal/:type` -> `LegalView`

Terminal routes:

- `/markets` -> `TerminalShell` -> `MarketView`
- `/portfolio` -> `TerminalShell` -> `PortfolioView`
- `/orders` -> `TerminalShell` -> `OrdersView`
- `/history` -> `TerminalShell` -> `AnalysisView`
- `/trade/:coinId` -> `TerminalShell` -> `TradeView`

Global fallback route:

- `*` -> `NotFoundView` (outside `TerminalShell`, still marked `noindex,follow`)

Route metadata is managed through `src/hooks/useSEO.ts`, which updates title, description, canonical URL, `og:url`, `robots`, and optional route-scoped structured data on navigation. Public routes default to `index,follow`; terminal pages and 404 pages use `noindex,follow`.

Public content prerendering is intentionally split from the client route graph: the browser app keeps public pages lazy-loaded through `App.tsx`, while `renderPublicRoute.tsx` provides a synchronous server-renderable route tree for the build step. This preserves route-level code splitting for `/markets` and other terminal pages while still allowing static public HTML to hydrate cleanly on refresh.

The landing page and `PublicContentLayout` no longer maintain separate footer implementations. They both render `SiteFooter`, with the landing page enabling the CTA block and `PublicContentLayout` routes disabling it so branding, legal links, social links, and support email stay synchronized. `LegalView` still renders its own legal-page footer.

## 2. UI composition

- `src/components/layout`: sidebar, mobile header, mobile nav, shared site footer, page transitions, terminal shell, and public content shell
- `src/components/views`: page-level views, including the landing page, public content hubs, and legal pages
- `src/components/views/content`: reusable article and hub renderers for learn / glossary content
- `src/components/views/intro`: landing-page sections (`IntroNav`, `HeroSection`, `WorkflowSection`, `PrivacySection`, `IntroFooter`), where `IntroFooter` is now a thin wrapper around the shared `SiteFooter`
- `src/components/views/trade`: trade-specific modules (`TradeHeader`, `TradePanel`)
- `src/components/modals`: disclaimer, reset balance, edit position, confirm flows
- `src/components/common`: shared UI primitives (`PriceDisplay`, `StatCard`, `ZeroHueLogo`, etc.)

`TradeView` embeds TradingView with a timeout/error fallback so chart failure does not block order entry. Learn and glossary pages render from shared content data in `src/content/*.data.js` so React rendering and build-time prerendering share the same source text.

## 3. State and orchestration

- `src/store/useStore.ts`: global Zustand store
- `src/hooks/useMarketData.ts`: live market history, websocket updates, and source-aware timestamps
- `src/hooks/useMarketEngine.ts`: dispatches market snapshots to the worker
- `src/hooks/useWorkerBridge.ts`: request ordering, lifecycle management, stale-response guards
- `src/hooks/useTradeExecution.ts`: trade execution entrypoint from the UI
- `src/hooks/useTradeForm.tsx`: trade form validation and derived calculations
- `src/hooks/usePortfolioManager.ts`: top-line valuation, scoring, and portfolio helpers
- `src/hooks/useAppInitialization.ts`: hydration, replay gating, and startup stage transitions
- `src/hooks/useIDBSync.ts`: incremental IndexedDB persistence
- `src/hooks/usePersistenceEpochGuard.ts`: cross-tab persistence invalidation listener
- `src/utils/appInitializationState.ts`: startup state machine (`hydrating`, `hydration_error`, `replay_pending`, `replay_error`, `ready`)
- `src/utils/persistenceEpoch.ts`: per-tab write ownership and cross-tab epoch helpers
- `src/store/useMarketExecutionStore.ts`: source-level executable price gating

Holdings are modeled as FIFO lots. The portfolio UI aggregates them for readability, but execution, PnL attribution, and scoring remain lot-based.

## 4. Execution engine

- `src/workers/marketEngine.worker.ts`: limit matching, TP/SL triggers, transaction generation
- `src/utils/engineProtocol.ts`: shared worker message contracts
- `src/hooks/useMarketEngine.ts`: thin orchestrator that commits worker output back into the store

Worker isolation is used to keep the main thread responsive during frequent price updates.

## 5. Core runtime flows

### Startup hydration flow

1. `useAppInitialization` restores `portfolio` from localStorage and `orders` / `transactions` from IndexedDB through `hydratePersistedAppState(...)`.
2. Before normal hydration runs, any staged local recovery transition is resumed from its browser journal unless the same transition id was already committed, in which case the stale journal is just cleared.
3. Hydration normalizes malformed-but-parseable state before it enters the store and rewrites repaired `portfolio` snapshots back through the commit-aware local persistence path instead of raw localStorage writes.
4. If the restored `portfolio` cannot be trusted as the source of truth, open orders are reconciled and can be cancelled to avoid cash / holdings mismatches.
5. If `orders` or `transactions` are unavailable from IndexedDB, startup enters `hydration_error` and `TerminalShell` blocks simulator entry.
6. If hydration repairs a malformed `portfolio` but cannot persist the repaired commit-aware snapshot, startup fails with `portfolio_unavailable` rather than allowing a stale refresh path.
7. Each tab establishes a persistence epoch on startup. If another tab advances the epoch during destructive recovery, the current tab becomes non-writable and `TerminalShell` blocks with `Tab Reload Required`.
8. Only after hydration succeeds does initial offline replay begin; the app does not enter the ready stage before both startup phases settle, and stale tabs do not enable the live engine.

### Market data flow

1. `useMarketData` hydrates cached `market_history` from IndexedDB.
2. Initial Binance / Coinbase history requests use bounded concurrency and retry.
3. WebSocket ticker updates are buffered and applied in animation-frame batches.
4. Per-source `lastOnlineAt` watermarks are advanced only after queued ticks are actually flushed into store state, so hard-kill windows cannot acknowledge ticks that never reached matching.
5. Live Binance and Coinbase ticks are filtered by exchange event ordering (`E`, `sequence`, `time`) before they can move prices backward.
6. Each source stays non-executable until the first live ticker arrives; cached history and reconnect backfills can refresh UI prices but do not drive matching while the source is still gated.
7. Market snapshots are sent to the worker through `useWorkerBridge`.
8. Worker results return portfolio updates, transactions, and notifications, which are committed to the store.

### Order flow

1. `TradePanel` collects user input.
2. `useTradeForm` validates amount, limit, TP, and SL values.
3. `useTradeExecution` either fills market orders immediately or creates open limit orders.
4. The worker later fills limit orders when trigger conditions are met.
5. SELL paths consume inventory in FIFO order, so one exit can close multiple older lots while leaving newer lots partially open.

### TP / SL flow

1. Holdings carry `takeProfitPrice` and `stopLossPrice`.
2. Position edits fan those values out across lots for the same asset.
3. The worker evaluates trigger conditions on every price update.
4. Triggered closes settle at the configured trigger prices for deterministic accounting.

### Offline replay flow

1. `useOfflineOrderExecution` runs after hydration and before the shell enters the ready stage.
2. Replay candidates are grouped by symbol and source, then fetched in symbol-level batches.
3. Replay uses 1m candles for recent windows and 1h candles for older windows.
4. Fetched candles are structurally validated (`open/high/low/close` finite, positive, and internally consistent) before replay uses them.
5. Replay fills harmless missing buckets with carry-forward synthetic candles, but rejects discontinuous gaps whose neighboring prices do not join cleanly.
6. Filled replay results are applied with guarded transitions and the same FIFO semantics used online.
7. If initial replay cannot complete after retries, the shell offers `Retry Sync` or `Continue Without Sync`.

## 6. Persistence, valuation, scoring, and public content

- `portfolio` is stored in localStorage as a commit-aware envelope, while its latest commit state is mirrored in IndexedDB `app_meta`
- `orders`, `transactions`, and `market_history` are stored in IndexedDB
- destructive browser-only recovery writes a transition journal to localStorage and a committed transition id to IndexedDB so interrupted resets can resume idempotently
- local persistence ownership is guarded by a cross-tab epoch in localStorage; stale tabs are downgraded to read-only until reload
- hydration normalizes malformed-but-parseable state before it enters the store
- hydration can rewrite sanitized `portfolio`, `orders`, and `transactions` back to browser storage
- fallback or untrusted `portfolio` recovery can trigger open-order reconciliation and cancellation
- hydration does not recover deprecated order or transaction arrays from localStorage
- hydration failure for `orders` or `transactions` blocks startup and surfaces recovery actions instead of entering `ready`
- hydration also blocks startup if a repaired `portfolio` cannot be re-persisted safely, because refresh would otherwise restore an older account snapshot
- `src/utils/valuation.ts` is the shared mark-price resolver for equity, portfolio rows, reserved SELL exposure, and scoring
- `src/utils/scoring.ts` computes risk, profit, stability, and confidence-based totals
- `scripts/prerender-public-pages.mjs` runs after the production build, server-renders public routes through `renderPublicRoute.tsx`, writes real React HTML into `#root`, and updates route-specific metadata

Public pages therefore ship with route-specific static body content and metadata, then hydrate in place on the client. Terminal routes still receive route-specific metadata files, but they do not prerender terminal UI bodies.

If an active exposure has no valid live or historical mark price, the app surfaces `Price data incomplete`, uses conservative valuation, and pauses scoring instead of silently using partial data.

## 7. Testing strategy

- Unit and integration tests: `src/**/__tests__`
- Hook tests: `src/hooks/**/__tests__`
- E2E shell coverage: `tests/terminal-shell.spec.ts`
- E2E order lifecycle coverage: `tests/order-lifecycle.spec.ts`
- E2E resilience coverage: `tests/trade-resilience.spec.ts`
- Shared E2E helpers: `tests/helpers/terminal.ts`
- Playwright projects: chromium, firefox, webkit, Mobile Chrome, Mobile Safari
- Playwright concurrency: CI uses `1` worker for stability; local runs default to `2` workers
- Type-check coverage: `npm run type-check` validates both application code and Playwright test/config TypeScript
- CI gate: lint, type-check, unit/integration tests, build, and Chromium E2E via `npm run test:e2e:chromium`

## 8. Constraints and invariants

- Worker-driven execution must stay deterministic across live and offline paths.
- Limit / TP / SL triggers settle at configured trigger prices.
- Monetary and quantity rounding uses shared helpers to reduce floating-point drift.
- Startup must not enter the ready stage until hydration and initial offline replay settle.
- A tab that loses persistence ownership must stop writing local state and require reload before trading can continue.
- Cached history and reconnect backfills must not be treated as executable prices until a live ticker confirms the source.
- Offline replay must reject malformed candle payloads instead of silently treating them as valid trigger ranges.
- Public content pages must remain accessible without simulator disclaimer gating.
- Terminal pages must remain `noindex,follow` so search ranking effort stays focused on public content.
