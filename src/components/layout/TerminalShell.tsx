import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';
import MobileHeader from './MobileHeader';
import MobileNav from './MobileNav';
import PageTransition from './PageTransition';
import Sidebar from './Sidebar';
import ConnectionStatus from '../common/ConnectionStatus';
import ErrorBoundary from '../common/ErrorBoundary';
import StatCard from '../common/StatCard';
import EditPositionModal from '../modals/EditPositionModal';
import ResetBalanceModal from '../modals/ResetBalanceModal';
import AnalysisView from '../views/AnalysisView';
import MarketView from '../views/MarketView';
import OrdersView from '../views/OrdersView';
import PortfolioView from '../views/PortfolioView';
import TradeView from '../views/TradeView';
import { useAppInitialization } from '../../hooks/useAppInitialization';
import { usePortfolioManager } from '../../hooks/usePortfolioManager';
import { usePersistenceSyncStore } from '../../store/usePersistenceSyncStore';
import { useStore } from '../../store/useStore';
import { isDust, roundUSD } from '../../utils/math';
import { createDefaultPortfolio } from '../../utils/appPersistence';
import {
  executeLocalPersistenceTransition,
  stageLocalPersistenceTransition,
} from '../../utils/localSimulatorState';
import { normalizePathname } from '../../utils/pathname';

type HydrationRecoveryAction = 'clear_orders' | 'clear_transactions' | 'factory_reset';

const TerminalShell: React.FC = () => {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [activeRecoveryAction, setActiveRecoveryAction] = useState<HydrationRecoveryAction | null>(
    null
  );
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const {
    initializationStage,
    hydrationError,
    retryHydration,
    initialReplayError,
    retryInitialReplay,
    skipInitialReplay,
    isCurrentTabWritable,
    crossTabInvalidationMessage,
  } = useAppInitialization();
  const isAppReady = initializationStage === 'ready';

  const portfolio = useStore((state) => state.portfolio);
  const binanceStatus = useStore((state) => state.binanceStatus);
  const coinbaseStatus = useStore((state) => state.coinbaseStatus);
  const isResetModalOpen = useStore((state) => state.isResetModalOpen);
  const setIsResetModalOpen = useStore((state) => state.setIsResetModalOpen);
  const selectedHoldingForEdit = useStore((state) => state.selectedHoldingForEdit);
  const setSelectedHoldingForEdit = useStore((state) => state.setSelectedHoldingForEdit);
  const setPortfolio = useStore((state) => state.setPortfolio);
  const setOrders = useStore((state) => state.setOrders);
  const setTransactions = useStore((state) => state.setTransactions);
  const persistenceSyncIssues = usePersistenceSyncStore((state) => state.issues);

  const { totalEquity, totalPnL, handleConfirmReset, handleUpdateStrategy, isScoreDataComplete } =
    usePortfolioManager({
      autoCaptureScoreSnapshots: isAppReady,
    });
  const degradedPersistenceStores = Object.values(persistenceSyncIssues).filter(
    (issue) => issue.status === 'degraded'
  );
  const retryingPersistenceStores = Object.values(persistenceSyncIssues).filter(
    (issue) => issue.status === 'retrying'
  );
  const persistenceWarning =
    degradedPersistenceStores.length > 0
      ? {
          title: 'Local Persistence Degraded',
          tone: 'degraded' as const,
          stores: degradedPersistenceStores,
        }
      : retryingPersistenceStores.length > 0
        ? {
            title: 'Local Persistence Retrying',
            tone: 'retrying' as const,
            stores: retryingPersistenceStores,
          }
        : null;

  const handleCloseResetModal = React.useCallback(
    () => setIsResetModalOpen(false),
    [setIsResetModalOpen]
  );
  const handleCloseEditModal = React.useCallback(
    () => setSelectedHoldingForEdit(null),
    [setSelectedHoldingForEdit]
  );

  React.useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  const isTradePage = pathname.startsWith('/trade/');

  let viewElement: React.ReactNode = null;
  if (pathname === '/markets') {
    viewElement = <MarketView />;
  } else if (pathname === '/portfolio') {
    viewElement = <PortfolioView />;
  } else if (pathname === '/orders') {
    viewElement = <OrdersView />;
  } else if (pathname === '/history') {
    viewElement = <AnalysisView />;
  } else if (pathname.startsWith('/trade/')) {
    viewElement = <TradeView />;
  }

  React.useEffect(() => {
    if (isTradePage) {
      setIsStatsExpanded(false);
    }
  }, [isTradePage]);

  const resolveRecoverableAccountValue = React.useCallback(() => {
    return roundUSD(Math.max(isScoreDataComplete ? totalEquity : 0, portfolio.balance, 0));
  }, [isScoreDataComplete, portfolio.balance, totalEquity]);

  const createRecoveryPortfolioSnapshot = React.useCallback(() => {
    const recoverableAccountValue = resolveRecoverableAccountValue();
    return {
      balance: recoverableAccountValue,
      initialBalance: recoverableAccountValue,
      holdings: [],
      peakBalance: recoverableAccountValue,
      historicalMDD: 0,
      grossProfit: 0,
      grossLoss: 0,
      validTradesCount: 0,
    };
  }, [resolveRecoverableAccountValue]);
  const canSafelyValueCurrentHoldings =
    isScoreDataComplete || portfolio.holdings.every((holding) => isDust(holding.amount));

  const handleRetryHydration = React.useCallback(() => {
    setRecoveryError(null);
    retryHydration();
  }, [retryHydration]);

  const handleReloadApp = React.useCallback(() => {
    window.location.reload();
  }, []);

  const handleHydrationRecovery = React.useCallback(
    async (action: HydrationRecoveryAction) => {
      if (action === 'factory_reset') {
        const shouldContinue =
          typeof window === 'undefined' ||
          window.confirm(
            'This will remove your local ZEROHUE simulator snapshot, orders, transaction history, and cached market history on this browser. Continue?'
          );
        if (!shouldContinue) {
          return;
        }
      }

      if (
        (action === 'clear_orders' || action === 'clear_transactions') &&
        !canSafelyValueCurrentHoldings
      ) {
        setRecoveryError(
          'Current holdings cannot be valued safely yet. Wait for live prices to load, then retry this action, or use the full local reset instead.'
        );
        return;
      }

      setRecoveryError(null);
      setActiveRecoveryAction(action);

      try {
        if (action === 'clear_orders') {
          const nextPortfolio = createRecoveryPortfolioSnapshot();
          const transition = {
            version: 1 as const,
            action,
            nextPortfolio,
          };
          if (!stageLocalPersistenceTransition(transition)) {
            throw new Error('failed to stage orders recovery state');
          }

          const didExecuteTransition = await executeLocalPersistenceTransition(transition);
          if (!didExecuteTransition) {
            throw new Error('failed to persist orders recovery state');
          }

          setPortfolio(nextPortfolio);
          setOrders([]);
          toast.success(
            'Local orders cache cleared and a clean cash snapshot was rebuilt. Retrying startup hydration.'
          );
        } else if (action === 'clear_transactions') {
          const scoreResetBaseline = resolveRecoverableAccountValue();
          const nextPortfolio = {
            ...portfolio,
            initialBalance: scoreResetBaseline,
            peakBalance: scoreResetBaseline,
            historicalMDD: 0,
            grossProfit: 0,
            grossLoss: 0,
            validTradesCount: 0,
          };
          const transition = {
            version: 1 as const,
            action,
            nextPortfolio,
          };
          if (!stageLocalPersistenceTransition(transition)) {
            throw new Error('failed to stage transaction recovery state');
          }

          const didExecuteTransition = await executeLocalPersistenceTransition(transition);
          if (!didExecuteTransition) {
            throw new Error('failed to persist transaction recovery state');
          }

          setPortfolio(nextPortfolio);
          setTransactions([]);
          toast.success(
            'Local transaction history cleared and performance snapshot reset. Retrying startup hydration.'
          );
        } else {
          const nextPortfolio = createDefaultPortfolio();
          const transition = {
            version: 1 as const,
            action,
            nextPortfolio,
          };
          if (!stageLocalPersistenceTransition(transition)) {
            throw new Error('failed to stage factory reset snapshot');
          }

          const didExecuteTransition = await executeLocalPersistenceTransition(transition);
          if (!didExecuteTransition) {
            throw new Error('failed to persist factory reset snapshot');
          }

          setPortfolio(nextPortfolio);
          setOrders([]);
          setTransactions([]);
          toast.success('Local simulator state rebuilt. Retrying startup hydration.');
        }

        handleRetryHydration();
      } catch (error) {
        console.error('Hydration recovery action failed', error);
        setRecoveryError(
          action === 'factory_reset'
            ? 'Full local recovery failed. Clear the ZEROHUE site data in your browser settings, then reload the app.'
            : 'Targeted cache recovery failed. Try the full local reset if the startup error keeps returning.'
        );
      } finally {
        setActiveRecoveryAction(null);
      }
    },
    [
      handleRetryHydration,
      createRecoveryPortfolioSnapshot,
      canSafelyValueCurrentHoldings,
      portfolio,
      resolveRecoverableAccountValue,
      setOrders,
      setPortfolio,
      setTransactions,
    ]
  );

  if (!isCurrentTabWritable) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020617] p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.35em] text-red-300/80">
            Tab Reload Required
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">
            This tab is no longer allowed to write simulator state
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {crossTabInvalidationMessage ||
              'Another ZEROHUE tab rebuilt local persistence. Reload this tab before continuing.'}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            ZEROHUE blocked further writes here to avoid reviving stale portfolio, order, or
            transaction state after a reset or recovery completed elsewhere.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleReloadApp}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (initializationStage === 'hydration_error' && hydrationError) {
    const isOrdersHydrationError = hydrationError.code === 'orders_unavailable';
    const isTransactionsHydrationError = hydrationError.code === 'transactions_unavailable';

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020617] p-6">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.35em] text-amber-300/80">
            Startup State Error
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">
            Simulator state could not be restored safely
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{hydrationError.message}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            ZEROHUE blocked terminal startup because the restored portfolio, orders, and history
            snapshot could no longer be trusted as a single source of truth.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="font-semibold text-white">Recovery Actions</div>
            <p className="mt-2 leading-6 text-slate-400">
              Try a targeted cache cleanup first. If the same startup error keeps coming back, use
              the full local reset to rebuild ZEROHUE&apos;s persisted browser state from scratch.
            </p>
          </div>
          {recoveryError && (
            <div
              className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
              role="alert"
            >
              {recoveryError}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleRetryHydration}
              disabled={activeRecoveryAction !== null}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
            >
              Retry Hydration
            </button>
            <button
              onClick={handleReloadApp}
              disabled={activeRecoveryAction !== null}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              Reload App
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {isOrdersHydrationError && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
                <button
                  onClick={() => void handleHydrationRecovery('clear_orders')}
                  disabled={activeRecoveryAction !== null || !canSafelyValueCurrentHoldings}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeRecoveryAction === 'clear_orders'
                    ? 'Clearing Orders Cache And Rebuilding Cash Snapshot...'
                    : 'Clear Orders Cache And Rebuild Cash Snapshot'}
                </button>
                <p className="mt-2 text-xs leading-5 text-amber-100/80">
                  {canSafelyValueCurrentHoldings
                    ? 'Removes persisted orders and rebuilds a clean cash-only portfolio snapshot from this browser&apos;s current recoverable account value. Transaction history stays intact.'
                    : 'Disabled until live prices finish loading for current holdings. ZEROHUE will not collapse open positions into a cash snapshot using incomplete marks.'}
                </p>
              </div>
            )}
            {isTransactionsHydrationError && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
                <button
                  onClick={() => void handleHydrationRecovery('clear_transactions')}
                  disabled={activeRecoveryAction !== null || !canSafelyValueCurrentHoldings}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeRecoveryAction === 'clear_transactions'
                    ? 'Clearing Transaction History And Resetting Performance Snapshot...'
                    : 'Clear Transaction History And Reset Performance Snapshot'}
                </button>
                <p className="mt-2 text-xs leading-5 text-amber-100/80">
                  {canSafelyValueCurrentHoldings
                    ? 'Removes persisted trade history and resets realized performance stats on this browser only. Orders, portfolio cash, and holdings stay intact.'
                    : 'Disabled until live prices finish loading for current holdings. ZEROHUE will not rebuild a new performance baseline from incomplete account marks.'}
                </p>
              </div>
            )}
            <button
              onClick={() => void handleHydrationRecovery('factory_reset')}
              disabled={activeRecoveryAction !== null}
              className="inline-flex items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeRecoveryAction === 'factory_reset'
                ? 'Rebuilding Local Simulator State...'
                : 'Factory Reset Local Simulator State'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (initializationStage === 'hydrating' || initializationStage === 'replay_pending') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
          <div className="font-mono text-xs uppercase tracking-widest text-slate-400 animate-pulse">
            Initializing Engine...
          </div>
        </div>
      </div>
    );
  }

  if (initializationStage === 'replay_error' && initialReplayError) {
    const replaySourcesLabel = initialReplayError.sources
      .map((source) => (source === 'BINANCE' ? 'Binance' : 'Coinbase'))
      .join(' + ');

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020617] p-6">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.35em] text-red-300/80">
            Offline Sync Error
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Initial replay could not complete</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            ZEROHUE could not finish the startup offline replay for {replaySourcesLabel} after{' '}
            {initialReplayError.attemptCount} attempts.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Retry to preserve exact offline execution history. If you continue without sync, the app
            will use the last saved snapshot and live prices, which can leave orders, holdings, and
            PnL temporarily stale.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={retryInitialReplay}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
            >
              Retry Sync
            </button>
            <button
              onClick={skipInitialReplay}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              Continue Without Sync
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] font-sans text-slate-100 md:flex-row">
      <Sidebar />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 h-96 w-full bg-blue-600/5 blur-[120px]" />

        <MobileHeader />

        <div
          id="main-scroll-container"
          className="relative z-10 flex-1 overflow-auto overscroll-y-contain scroll-smooth p-4 md:p-8"
        >
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-8 lg:flex-row">
            <div className="flex flex-1 flex-col space-y-8">
              {persistenceWarning && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                    persistenceWarning.tone === 'degraded'
                      ? 'border-red-500/30 bg-red-500/10 text-red-100'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                  }`}
                  role="status"
                >
                  <div className="text-[11px] font-mono uppercase tracking-[0.28em]">
                    {persistenceWarning.title}
                  </div>
                  <p className="mt-2">
                    {persistenceWarning.stores
                      .map((issue) => issue.message)
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                </div>
              )}

              {!isTradePage && (
                <div className="md:hidden">
                  <button
                    onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-slate-800/40 p-3.5 backdrop-blur-md transition-all active:scale-[0.98]"
                  >
                    <span className="text-sm font-bold tracking-wide text-slate-300">
                      PORTFOLIO OVERVIEW
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform duration-300 ${isStatsExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              )}

              <div className={`${isStatsExpanded ? 'block' : 'hidden'} md:block`}>
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`${isTradePage ? 'hidden md:grid' : 'grid'} grid-cols-2 gap-3 md:grid-cols-3 md:gap-6`}
                >
                  <div className="col-span-1">
                    <StatCard label="Available Cash" value={portfolio.balance} prefix="$" />
                  </div>
                  <div className="col-span-1 hidden md:block">
                    <StatCard
                      label="Total Equity"
                      value={totalEquity}
                      prefix="$"
                      helperText={!isScoreDataComplete ? 'Price data incomplete' : undefined}
                      helperTone="warning"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <StatCard
                      label="Total Profit/Loss"
                      value={Math.abs(totalPnL)}
                      prefix={totalPnL >= 0 ? '+$' : '-$'}
                      isPnL={true}
                      pnlValue={totalPnL}
                    />
                  </div>
                </motion.div>
              </div>

              <div className="relative">
                <ErrorBoundary>
                  <AnimatePresence mode="wait">
                    <PageTransition key={pathname}>{viewElement}</PageTransition>
                  </AnimatePresence>
                </ErrorBoundary>
              </div>

              <div className="mt-auto">
                <Footer />
                <div className="h-28 pb-safe md:hidden" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <MobileNav />
      </main>

      <EditPositionModal
        key={`${selectedHoldingForEdit?.holding?.coinId || 'none'}-${selectedHoldingForEdit?.holding?.takeProfitPrice ?? ''}-${selectedHoldingForEdit?.holding?.stopLossPrice ?? ''}`}
        isOpen={!!selectedHoldingForEdit}
        onClose={handleCloseEditModal}
        holding={selectedHoldingForEdit?.holding || null}
        coin={selectedHoldingForEdit?.coin || null}
        onConfirm={handleUpdateStrategy}
      />

      <ResetBalanceModal
        isOpen={isResetModalOpen}
        onClose={handleCloseResetModal}
        onConfirm={handleConfirmReset}
      />

      <ConnectionStatus binanceStatus={binanceStatus} coinbaseStatus={coinbaseStatus} />
    </div>
  );
};

export default TerminalShell;
