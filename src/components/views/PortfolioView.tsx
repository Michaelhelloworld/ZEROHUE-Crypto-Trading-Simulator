import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, PieChart as PieChartIcon, Settings, Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { Coin, Holding } from '../../types';
import CryptoIcon from '../CryptoIcon';
import PriceDisplay from '../common/PriceDisplay';
import { useStore } from '../../store/useStore';
import { usePortfolioManager } from '../../hooks/usePortfolioManager';
import { useSEO } from '../../hooks/useSEO';
import { formatAmount, formatUsdWithSymbol } from '../../utils/format';
import { aggregateHoldingsByCoin } from '../../utils/lotAccounting';
import { isDust, roundCrypto } from '../../utils/math';
import { getHoldingMarketValue } from '../../utils/valuation';

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#475569',
];

const COLOR_BG_CLASSES = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-slate-600',
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  totalValue: number;
}

interface PortfolioDisplayLot {
  holding: Holding;
  isReserved: boolean;
  sourceOrderId?: string;
}

interface PortfolioHoldingGroup {
  holding: Holding;
  lots: PortfolioDisplayLot[];
  availableAmount: number;
  reservedAmount: number;
  coin: Coin;
}

interface PortfolioRowProps extends PortfolioHoldingGroup {
  expanded: boolean;
  navigate: (path: string) => void;
  onEditPosition: (coin: Coin) => void;
  onToggleLots: (coinId: string) => void;
}

const sortDisplayLotsFifo = (lots: PortfolioDisplayLot[]) =>
  [...lots].sort((left, right) => {
    const leftTime = left.holding.openedAt ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.holding.openedAt ?? Number.MAX_SAFE_INTEGER;
    const timeDelta = leftTime - rightTime;
    if (timeDelta !== 0) return timeDelta;
    return (left.holding.id || '').localeCompare(right.holding.id || '');
  });

const getPortfolioHoldingValue = (holding: Pick<Holding, 'amount'>, coin: Coin) =>
  getHoldingMarketValue(holding, coin) ?? 0;

const formatLotOpenedAt = (openedAt?: number) => {
  if (!openedAt || !Number.isFinite(openedAt)) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(openedAt);
};

const formatLotCount = (lotCount: number) => `${lotCount} ${lotCount === 1 ? 'lot' : 'lots'}`;

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, totalValue }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] ring-1 ring-white/10">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
          {payload[0].name}
        </div>
        <div className="text-sm font-mono font-bold text-white">
          $
          {payload[0].value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {totalValue > 0 ? ((payload[0].value / totalValue) * 100).toFixed(1) : '0.0'}% of total
        </div>
      </div>
    );
  }
  return null;
};

const LotDetailsPanel: React.FC<{ lots: PortfolioDisplayLot[]; coin: Coin }> = React.memo(
  ({ lots, coin }) => {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-300/90">
              FIFO Queue
            </div>
            <div className="text-sm font-bold text-white">
              FIFO lots below include both active inventory and lots reserved by open SELL orders.
            </div>
            <div className="mt-1 text-xs text-slate-400">
              5% qualified means the lot opened at {'>='}5% of total equity at entry.
            </div>
          </div>
          <div className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
            {formatLotCount(lots.length)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {lots.map((lot, index) => {
            const currentValue = getPortfolioHoldingValue(lot.holding, coin);
            const costBasis = lot.holding.amount * lot.holding.averageCost;
            const gainPercent = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

            return (
              <div
                key={lot.holding.id || `${coin.id}-lot-${index}`}
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.28)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {index === 0 ? 'Next Out' : `Queue #${index + 1}`}
                    </div>
                    <div className="text-sm font-bold text-white">FIFO Lot {index + 1}</div>
                    <div className="text-[11px] text-slate-500">
                      Opened {formatLotOpenedAt(lot.holding.openedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        lot.holding.meetsVolumeCondition
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-700/70 text-slate-300'
                      }`}
                    >
                      {lot.holding.meetsVolumeCondition ? '5% Qualified' : 'Below 5%'}
                    </span>
                    {lot.isReserved && (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                        Reserved
                      </span>
                    )}
                    {(lot.holding.takeProfitPrice || lot.holding.stopLossPrice) && (
                      <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                        TP/SL
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Amount</div>
                    <div className="font-mono font-bold text-slate-100">
                      {formatAmount(lot.holding.amount)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Avg Cost
                    </div>
                    <div className="font-mono font-bold text-slate-100">
                      <PriceDisplay price={lot.holding.averageCost} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Mark Value
                    </div>
                    <div className="font-mono font-bold text-white">
                      {formatUsdWithSymbol(currentValue)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Return</div>
                    <div
                      className={`font-mono font-bold ${
                        gainPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {gainPercent > 0 ? '+' : ''}
                      {gainPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {(lot.holding.takeProfitPrice || lot.holding.stopLossPrice) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">
                        Take Profit
                      </div>
                      <div className="font-mono font-bold text-emerald-200">
                        {lot.holding.takeProfitPrice ? (
                          <PriceDisplay price={lot.holding.takeProfitPrice} />
                        ) : (
                          'Not set'
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-red-300/80">
                        Stop Loss
                      </div>
                      <div className="font-mono font-bold text-red-200">
                        {lot.holding.stopLossPrice ? (
                          <PriceDisplay price={lot.holding.stopLossPrice} />
                        ) : (
                          'Not set'
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

const PortfolioRow: React.FC<PortfolioRowProps> = React.memo(
  ({
    holding,
    lots,
    availableAmount,
    reservedAmount,
    coin,
    expanded,
    navigate,
    onEditPosition,
    onToggleLots,
  }) => {
    const currentValue = getPortfolioHoldingValue(holding, coin);
    const costBasis = holding.amount * holding.averageCost;
    const gain = currentValue - costBasis;
    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    const lotsLabel = formatLotCount(lots.length);
    const detailsId = `portfolio-lots-${coin.id}`;
    const canEditPosition = availableAmount > 0;

    return (
      <>
        <motion.tr
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          layout
          className="hover:bg-white/[0.08] transition-all duration-300 group"
        >
          <td className="p-5 border-l-2 border-transparent group-hover:border-blue-500">
            <div className="flex items-center gap-4">
              <CryptoIcon
                symbol={coin.symbol}
                size={40}
                className="shadow-lg group-hover:scale-110 transition-transform duration-300"
              />
              <div>
                <div className="font-bold text-white group-hover:text-blue-400 transition-colors">
                  {coin.name}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {coin.symbol} | {lotsLabel}
                </div>
                {reservedAmount > 0 && (
                  <div className="text-[11px] text-amber-300/80 font-mono">
                    Reserved {formatAmount(reservedAmount)} {coin.symbol}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className="p-5 text-right font-mono text-sm font-medium text-slate-300">
            {formatAmount(holding.amount)}
          </td>
          <td className="p-5 text-right font-mono text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
            <PriceDisplay price={holding.averageCost} />
          </td>
          <td className="p-5 text-right font-mono text-white font-bold">
            {formatUsdWithSymbol(currentValue)}
          </td>
          <td
            className={`p-5 text-right font-mono text-sm font-bold ${
              gain >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {gainPercent > 0 ? '+' : ''}
            {gainPercent.toFixed(2)}%
          </td>
          <td className="p-5 text-center">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onToggleLots(coin.id)}
                aria-expanded={expanded}
                aria-controls={detailsId}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/15 bg-blue-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-200 transition-all hover:bg-blue-500/20 active:scale-95"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {expanded ? 'Hide Lots' : `Show ${lotsLabel}`}
              </button>
              <button
                onClick={() => onEditPosition(coin)}
                disabled={!canEditPosition}
                className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 hover:shadow-lg transition-all border border-transparent hover:border-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800/50 disabled:hover:text-slate-400"
                title="Edit TP/SL"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => navigate(`/trade/${coin.id}`)}
                className="text-xs font-black tracking-wider bg-white/5 hover:bg-blue-600 hover:text-white hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:border-blue-400/50 text-slate-300 px-5 py-2.5 rounded-xl transition-all border border-white/5 active:scale-95"
              >
                Trade
              </button>
            </div>
          </td>
        </motion.tr>
        {expanded && (
          <tr id={detailsId} className="bg-slate-950/40">
            <td colSpan={6} className="p-4 sm:p-5">
              <LotDetailsPanel lots={lots} coin={coin} />
            </td>
          </tr>
        )}
      </>
    );
  }
);

const PortfolioCard: React.FC<PortfolioRowProps> = React.memo(
  ({
    holding,
    lots,
    availableAmount,
    reservedAmount,
    coin,
    expanded,
    navigate,
    onEditPosition,
    onToggleLots,
  }) => {
    const currentValue = getPortfolioHoldingValue(holding, coin);
    const costBasis = holding.amount * holding.averageCost;
    const gain = currentValue - costBasis;
    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    const lotsLabel = formatLotCount(lots.length);
    const detailsId = `portfolio-lots-mobile-${coin.id}`;
    const canEditPosition = availableAmount > 0;

    return (
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CryptoIcon symbol={coin.symbol} size={40} className="shadow-lg" />
            <div>
              <div className="font-bold text-white text-lg">{coin.name}</div>
              <div className="text-xs text-slate-400 font-mono">
                {coin.symbol} | {lotsLabel}
              </div>
              {reservedAmount > 0 && (
                <div className="text-[11px] text-amber-300/80 font-mono">
                  Reserved {formatAmount(reservedAmount)} {coin.symbol}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white font-mono">
              {formatUsdWithSymbol(currentValue)}
            </div>
            <div
              className={`text-sm font-medium ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {gainPercent > 0 ? '+' : ''}
              {gainPercent.toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-xs text-slate-500 uppercase mb-1">Balance</div>
            <div className="font-mono text-slate-200">{formatAmount(holding.amount)}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-xs text-slate-500 uppercase mb-1">Avg Cost</div>
            <div className="font-mono text-slate-200">
              <PriceDisplay price={holding.averageCost} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleLots(coin.id)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="px-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 rounded-xl transition-colors border border-blue-400/15 active:scale-95 text-[11px] font-black uppercase tracking-[0.18em]"
          >
            {expanded ? 'Hide Lots' : `Show ${lotsLabel}`}
          </button>
          <button
            onClick={() => onEditPosition(coin)}
            title="Edit TP/SL"
            disabled={!canEditPosition}
            className="p-3.5 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors border border-white/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800/50 disabled:hover:text-slate-400"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => navigate(`/trade/${coin.id}`)}
            className="flex-1 py-3 bg-slate-800 hover:bg-blue-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-black/20"
          >
            Trade
          </button>
        </div>
        {expanded && (
          <div id={detailsId}>
            <LotDetailsPanel lots={lots} coin={coin} />
          </div>
        )}
      </div>
    );
  }
);

const PortfolioView: React.FC = () => {
  useSEO({
    title: 'Portfolio',
    description:
      'Review crypto holdings, FIFO lots, and paper-trading exposure inside the ZEROHUE simulator.',
    robots: 'noindex,follow',
  });

  const portfolio = useStore((state) => state.portfolio);
  const coins = useStore((state) => state.coins);
  const orders = useStore((state) => state.orders);
  const { handleEditPosition: onEditPosition } = usePortfolioManager();
  const navigate = useNavigate();
  const [expandedCoins, setExpandedCoins] = useState<Record<string, boolean>>({});

  const portfolioDisplayLots = useMemo(() => {
    const activeLots: PortfolioDisplayLot[] = portfolio.holdings
      .filter((holding) => !isDust(holding.amount))
      .map((holding) => ({ holding, isReserved: false }));

    const reservedLots: PortfolioDisplayLot[] = orders.flatMap((order) => {
      if (order.status !== 'OPEN' || order.type !== 'SELL') return [];

      return (
        order.lotAllocations
          ?.filter((allocation) => !isDust(allocation.amount))
          .map((allocation) => ({
            holding: {
              id: allocation.lotId,
              coinId: allocation.coinId,
              amount: allocation.amount,
              averageCost: allocation.averageCost,
              takeProfitPrice: allocation.takeProfitPrice,
              stopLossPrice: allocation.stopLossPrice,
              openedAt: allocation.openedAt,
              meetsVolumeCondition: allocation.meetsVolumeCondition,
            },
            isReserved: true,
            sourceOrderId: order.id,
          })) || []
      );
    });

    return [...activeLots, ...reservedLots];
  }, [orders, portfolio.holdings]);

  const holdingGroups = useMemo(() => {
    const aggregatedExposure = aggregateHoldingsByCoin(
      portfolioDisplayLots.map((displayLot) => displayLot.holding)
    );

    const groups: PortfolioHoldingGroup[] = [];
    for (const holding of aggregatedExposure) {
      const coin = coins.find((candidate) => candidate.id === holding.coinId);
      if (!coin) continue;

      const lots = sortDisplayLotsFifo(
        portfolioDisplayLots.filter((displayLot) => displayLot.holding.coinId === holding.coinId)
      );
      const availableAmount = roundCrypto(
        lots.filter((lot) => !lot.isReserved).reduce((acc, lot) => acc + lot.holding.amount, 0)
      );
      const reservedAmount = roundCrypto(
        lots.filter((lot) => lot.isReserved).reduce((acc, lot) => acc + lot.holding.amount, 0)
      );

      groups.push({
        holding,
        lots,
        availableAmount,
        reservedAmount,
        coin,
      });
    }

    return groups;
  }, [coins, portfolioDisplayLots]);

  const toggleLots = (coinId: string) => {
    setExpandedCoins((prev) => ({
      ...prev,
      [coinId]: !prev[coinId],
    }));
  };

  const { chartData, totalValue } = useMemo(() => {
    const data = holdingGroups
      .map(({ holding, coin }) => ({
        name: coin.name,
        symbol: coin.symbol,
        value: getPortfolioHoldingValue(holding, coin),
      }))
      .filter((item) => item.value > 0);

    if (portfolio.balance > 0) {
      data.push({
        name: 'Cash (USD)',
        symbol: 'USD',
        value: portfolio.balance,
      });
    }

    data.sort((left, right) => right.value - left.value);

    const total =
      portfolio.balance +
      holdingGroups.reduce(
        (acc, { holding, coin }) => acc + getPortfolioHoldingValue(holding, coin),
        0
      );

    return { chartData: data, totalValue: total };
  }, [holdingGroups, portfolio.balance]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Holdings</h2>
      </div>

      {holdingGroups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-white/5 bg-slate-900/20 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full group-hover:bg-blue-500/10 transition-colors duration-700 pointer-events-none" />

          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="p-6 rounded-3xl bg-slate-800/50 border border-white/5 mb-6 relative z-10 shadow-xl group-hover:shadow-blue-500/20 transition-all"
          >
            <Wallet
              size={48}
              className="text-slate-500 group-hover:text-blue-400 transition-colors duration-500"
            />
          </motion.div>

          <h3 className="text-xl font-bold text-white mb-2 relative z-10">
            Your portfolio is empty
          </h3>
          <p className="text-slate-500 mb-8 max-w-xs text-center relative z-10">
            Start trading to build your crypto portfolio and track your performance.
          </p>

          <Link
            to="/markets"
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-95 relative z-10 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] border border-blue-400/20 overflow-hidden flex items-center justify-center gap-2"
          >
            <span className="relative z-10">Back to Markets</span>
          </Link>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 glass-card p-6 rounded-2xl flex flex-col h-[320px]">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                  Asset Allocation
                </h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip totalValue={totalValue} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {chartData.slice(0, 6).map((item, index) => (
                  <div
                    key={item.symbol}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_BG_CLASSES[index % COLOR_BG_CLASSES.length]}`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 font-bold truncate uppercase">
                        {item.symbol}
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0'}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden md:block glass rounded-2xl overflow-hidden animate-in fade-in duration-500">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="p-5 text-left">Asset</th>
                  <th className="p-5 text-right">Balance</th>
                  <th className="p-5 text-right">Avg Cost</th>
                  <th className="p-5 text-right">Value</th>
                  <th className="p-5 text-right">Return</th>
                  <th className="p-5 text-right pr-8">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 relative">
                {holdingGroups.map((group) => (
                  <PortfolioRow
                    key={group.holding.coinId}
                    {...group}
                    expanded={Boolean(expandedCoins[group.coin.id])}
                    navigate={navigate}
                    onEditPosition={onEditPosition}
                    onToggleLots={toggleLots}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {holdingGroups.map((group) => (
              <PortfolioCard
                key={group.holding.coinId}
                {...group}
                expanded={Boolean(expandedCoins[group.coin.id])}
                navigate={navigate}
                onEditPosition={onEditPosition}
                onToggleLots={toggleLots}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PortfolioView;
