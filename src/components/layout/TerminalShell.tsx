import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
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
import { useStore } from '../../store/useStore';

const TerminalShell: React.FC = () => {
  const location = useLocation();
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const { initializationStage, initialReplayError, retryInitialReplay, skipInitialReplay } =
    useAppInitialization();
  const isAppReady = initializationStage === 'ready';

  const portfolio = useStore((state) => state.portfolio);
  const binanceStatus = useStore((state) => state.binanceStatus);
  const coinbaseStatus = useStore((state) => state.coinbaseStatus);
  const isResetModalOpen = useStore((state) => state.isResetModalOpen);
  const setIsResetModalOpen = useStore((state) => state.setIsResetModalOpen);
  const selectedHoldingForEdit = useStore((state) => state.selectedHoldingForEdit);
  const setSelectedHoldingForEdit = useStore((state) => state.setSelectedHoldingForEdit);

  const { totalEquity, totalPnL, handleConfirmReset, handleUpdateStrategy, isScoreDataComplete } =
    usePortfolioManager({
      autoCaptureScoreSnapshots: isAppReady,
    });

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
  }, [location.pathname]);

  const isTradePage = location.pathname.includes('/trade');

  let viewElement: React.ReactNode = null;
  if (location.pathname === '/markets') {
    viewElement = <MarketView />;
  } else if (location.pathname === '/portfolio') {
    viewElement = <PortfolioView />;
  } else if (location.pathname === '/orders') {
    viewElement = <OrdersView />;
  } else if (location.pathname === '/history') {
    viewElement = <AnalysisView />;
  } else if (location.pathname.startsWith('/trade/')) {
    viewElement = <TradeView />;
  }

  React.useEffect(() => {
    if (isTradePage) {
      setIsStatsExpanded(false);
    }
  }, [isTradePage]);

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
                    <PageTransition key={location.pathname}>{viewElement}</PageTransition>
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
