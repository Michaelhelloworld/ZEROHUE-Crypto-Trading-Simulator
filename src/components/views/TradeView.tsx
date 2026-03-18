import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { motion } from 'framer-motion';

import { useTradeForm } from '../../hooks/useTradeForm';
import { useHaptic } from '../../hooks/useHaptic';
import TradeHeader from './trade/TradeHeader';
import TradePanel from './trade/TradePanel';
import { useStore } from '../../store/useStore';
import { useTradeExecution } from '../../hooks/useTradeExecution';
import { useSEO } from '../../hooks/useSEO';

const TRADING_VIEW_LOAD_TIMEOUT_MS = 8000;

type TradingViewWidgetProps = {
  symbol: string;
  loadTimeoutMs?: number;
};

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = React.memo(
  ({ symbol, loadTimeoutMs = TRADING_VIEW_LOAD_TIMEOUT_MS }) => {
    const container = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
      const containerEl = container.current;
      if (!containerEl) return;

      let cancelled = false;
      containerEl.innerHTML = '';

      const markFailed = () => {
        if (cancelled) return;
        containerEl.innerHTML = '';
        setStatus('error');
      };

      const timeoutId = window.setTimeout(markFailed, loadTimeoutMs);
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setStatus('ready');
      };
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        markFailed();
      };
      // TradingView's embed API expects a JSON config payload inside the script body.
      // This payload is fully application-controlled and does not interpolate user HTML.
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: symbol,
        interval: '60',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        enable_publishing: false,
        allow_symbol_change: true,
        calendar: false,
        support_host: 'https://www.tradingview.com',
        backgroundColor: 'rgba(2, 6, 23, 1)',
        gridColor: 'rgba(30, 41, 59, 0.4)',
        hide_side_toolbar: false,
      });
      containerEl.appendChild(script);

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
        containerEl.innerHTML = '';
      };
    }, [symbol, attempt, loadTimeoutMs]);

    return (
      <div className="relative w-full h-full">
        <div
          className={`tradingview-widget-container h-full w-full ${status === 'error' ? 'opacity-0 pointer-events-none' : ''}`}
          ref={container}
          aria-busy={status === 'loading'}
        >
          <div className="tradingview-widget-container__widget h-full w-full"></div>
        </div>

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#020617] text-slate-400">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">Loading Chart</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#020617] p-6">
            <div className="max-w-sm rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Info size={22} className="text-slate-300" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">Chart unavailable</h3>
              <p className="mb-5 text-sm leading-relaxed text-slate-400">
                TradingView failed to load in this browser session. You can still place trades using
                the ticket on the right.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus('loading');
                  setAttempt((current) => current + 1);
                }}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-500"
              >
                Retry Chart
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TradingViewWidget.displayName = 'TradingViewWidget';

const TradeView: React.FC = () => {
  const coins = useStore((state) => state.coins);
  const portfolio = useStore((state) => state.portfolio);
  const region = useStore((state) => state.region);
  const { handleExecuteTrade: onExecuteTrade } = useTradeExecution();
  const { coinId } = useParams<{ coinId: string }>();
  const navigate = useNavigate();
  const { trigger } = useHaptic();
  const [mobileView, setMobileView] = useState<'CHART' | 'TRADE'>('CHART');

  const coin = coins.find((c) => c.id === coinId);

  useSEO({
    title: coin ? `Trade ${coin.symbol} | ${coin.name}` : 'Trade',
    description: coin
      ? `Review live market context for ${coin.name} (${coin.symbol}), place paper orders, and manage risk inside ZEROHUE.`
      : 'Review live market context, place paper orders, and manage risk inside ZEROHUE.',
    robots: 'noindex,follow',
  });

  const { formState, calculations, handleSubmit } = useTradeForm({
    coin: coin || null,
    portfolio,
    onExecuteTrade: (id, type, amount, orderType, limit, tp, sl) => {
      trigger('success');
      return onExecuteTrade(id, type, amount, orderType, limit, tp, sl);
    },
    onClose: () => navigate('/portfolio'),
  });

  if (!coin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 md:p-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-500/5 blur-[120px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 rounded-[40px] border border-white/5 relative z-10 max-w-lg w-full"
        >
          <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-white/5 flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Info size={32} className="text-slate-600" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Asset unavailable</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            The asset signature you followed is not currently mapped to our liquidity providers. It
            may have been delisted or is pending integration.
          </p>
          <button
            onClick={() => navigate('/markets')}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            Back to Markets
          </button>
        </motion.div>
      </div>
    );
  }

  const chartSymbol =
    coin.source === 'COINBASE'
      ? `COINBASE:${coin.symbol}USD`
      : `${region === 'US' ? 'BINANCEUS' : 'BINANCE'}:${coin.symbol}USDT`;

  return (
    <div className="space-y-4 md:space-y-6 pb-28 md:pb-8">
      <TradeHeader coin={coin} />

      {/* Mobile View Switcher */}
      <div className="md:hidden flex bg-slate-950/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 mb-4 shadow-xl">
        <button
          onClick={() => {
            setMobileView('CHART');
            trigger('selection');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${mobileView === 'CHART' ? 'bg-slate-800 text-white shadow-lg shadow-black/20 ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Chart
        </button>
        <button
          onClick={() => {
            setMobileView('TRADE');
            trigger('selection');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${mobileView === 'TRADE' ? 'bg-slate-800 text-white shadow-lg shadow-black/20 ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Trade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-4 xl:grid-rows-1 gap-4 md:gap-6 md:h-auto">
        {/* Left: Chart Container */}
        <div
          className={`${mobileView === 'CHART' ? 'flex' : 'hidden'} md:flex xl:col-span-3 glass rounded-3xl overflow-hidden border border-white/5 flex-col relative group h-[50vh] md:h-[500px] xl:h-[750px]`}
        >
          <div className="flex-1 w-full bg-[#020617]">
            <TradingViewWidget key={chartSymbol} symbol={chartSymbol} />
          </div>
        </div>

        {/* Right: Trade Panel */}
        <div
          className={`${mobileView === 'TRADE' ? 'flex' : 'hidden'} md:flex xl:col-span-1 min-h-[500px] md:h-auto xl:h-auto`}
        >
          <TradePanel
            coin={coin}
            formState={formState}
            calculations={calculations}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
};

export default TradeView;
