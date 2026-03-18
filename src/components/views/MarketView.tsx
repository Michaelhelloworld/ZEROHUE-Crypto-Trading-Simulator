import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { Coin } from '../../types';
import CryptoIcon from '../CryptoIcon';
import PriceDisplay from '../common/PriceDisplay';
import { ConnectionState } from '../../components/common/ConnectionStatus';

import { useStore } from '../../store/useStore';
import { useSEO } from '../../hooks/useSEO';

const CATEGORIES = ['All', 'L1/L2', 'DeFi', 'AI/DePIN', 'MEME'];

// MarketRow is already React.memoified.
// I will ensure the Sparkline and Flash logic are extremely efficient.
const Sparkline: React.FC<{ data: number[]; color: string }> = React.memo(({ data, color }) => {
  const gradientId = React.useId();
  // Using simplified props for ResponsiveContainer to avoid unnecessary churn
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer>
        <AreaChart data={data.map((p, i) => ({ price: p, i }))}>
          <defs>
            <linearGradient id={`spark-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-grad-${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

const MarketRow: React.FC<{ coin: Coin; index: number }> = React.memo(({ coin, index }) => {
  const navigate = useNavigate();
  const prevPriceRef = useRef(coin.price);
  const [flashType, setFlashType] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prevPriceRef.current !== coin.price) {
      const type = coin.price > prevPriceRef.current ? 'up' : 'down';
      // Flash effect requires synchronous state update for visual feedback
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlashType(type);
      prevPriceRef.current = coin.price;

      const timer = setTimeout(() => setFlashType(null), 400);
      return () => clearTimeout(timer);
    }
  }, [coin.price]);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`group transition-all duration-300 cursor-pointer relative ${
        flashType === 'up'
          ? 'bg-emerald-500/10'
          : flashType === 'down'
            ? 'bg-red-500/10'
            : 'hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] z-0 hover:z-10'
      }`}
      onClick={() => navigate(`/trade/${coin.id}`)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-slate-600 w-4">{index + 1}</span>
          <CryptoIcon symbol={coin.symbol} size={32} />
          <div>
            <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors uppercase tracking-tight">
              {coin.name}
            </div>
            <div className="text-[10px] font-mono text-slate-500">{coin.symbol}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div
          className={`text-sm font-mono font-bold transition-colors duration-300 ${
            flashType === 'up'
              ? 'text-emerald-400'
              : flashType === 'down'
                ? 'text-red-400'
                : 'text-white'
          }`}
        >
          <PriceDisplay price={coin.price} />
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div
          className={`flex items-center justify-end font-mono font-bold text-sm ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {coin.change24h >= 0 ? (
            <TrendingUp size={14} className="mr-1" />
          ) : (
            <TrendingUp size={14} className="mr-1 rotate-180" />
          )}
          {coin.change24h >= 0 ? '+' : ''}
          {coin.change24h.toFixed(2)}%
        </div>
      </td>
      <td className="px-6 py-4 text-right hidden xl:table-cell">
        <div className="flex justify-end pr-4">
          <Sparkline data={coin.history} color={coin.change24h >= 0 ? '#10b981' : '#ef4444'} />
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => navigate(`/trade/${coin.id}`)}
          className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 border border-blue-500/20"
        >
          Trade
        </button>
      </td>
    </motion.tr>
  );
});

const MobileMarketCard: React.FC<{ coin: Coin }> = React.memo(({ coin }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 active:scale-[0.98] transition-transform"
      onClick={() => navigate(`/trade/${coin.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CryptoIcon symbol={coin.symbol} size={36} />
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate">{coin.name}</div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">{coin.symbol}/USDT</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-white">
              <PriceDisplay price={coin.price} />
            </div>
            <div
              className={`text-[11px] font-mono font-bold ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {coin.change24h >= 0 ? '+' : ''}
              {coin.change24h.toFixed(2)}%
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/trade/${coin.id}`);
            }}
            className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 border border-blue-500/20"
          >
            Trade
          </button>
        </div>
      </div>
    </motion.div>
  );
});

const StatusBadge: React.FC<{ label: string; status: ConnectionState }> = ({ label, status }) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  let colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
  let dotClass = 'bg-red-500';

  if (isConnected) {
    colorClass = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    dotClass = 'bg-emerald-500';
  } else if (isConnecting) {
    colorClass = 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20';
    dotClass = 'bg-yellow-500 animate-pulse';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 whitespace-nowrap text-[9px] sm:text-[10px] font-bold border px-2 py-1 rounded-lg transition-colors uppercase tracking-tight ${colorClass}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
};

const MarketView: React.FC = () => {
  useSEO({
    title: 'Markets',
    description:
      'Review live market context, compare supported assets, and open paper trades inside the ZEROHUE simulator.',
    robots: 'noindex,follow',
  });

  const coins = useStore((state) => state.coins);
  const region = useStore((state) => state.region);
  const binanceStatus = useStore((state) => state.binanceStatus);
  const coinbaseStatus = useStore((state) => state.coinbaseStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredCoins = useMemo(() => {
    return coins.filter((coin) => {
      const matchesSearch =
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (activeCategory === 'All') return true;

      return coin.category === activeCategory;
    });
  }, [coins, searchQuery, activeCategory]);

  const isLoading = coins.length === 0 || coins.every((c) => c.history.length <= 1);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Markets{' '}
            <span className="bg-blue-500 text-[10px] px-2 py-0.5 rounded text-white uppercase tracking-widest font-black">
              Live
            </span>
          </h2>
        </div>

        <div
          role="group"
          aria-label="Market search and connection controls"
          className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto"
        >
          <div className="relative group flex-1 min-w-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors"
            />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search crypto assets"
              className="bg-slate-900/50 border border-white/5 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <div
            role="group"
            aria-label="Market connection statuses"
            className="flex flex-wrap items-center gap-1 self-start sm:self-center"
          >
            <StatusBadge
              label={region === 'US' ? 'BINANCE.US' : 'BINANCE'}
              status={binanceStatus}
            />
            <StatusBadge label="COINBASE" status={coinbaseStatus} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1 bg-slate-900/30 border border-white/5 rounded-xl w-fit max-w-full overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            aria-label={`Show ${cat} assets`}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${activeCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/50 border-b border-white/5">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-6 py-4"># Asset</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-right">24h Change</th>
                <th className="px-6 py-4 text-right hidden xl:table-cell">24h History</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td colSpan={5} className="p-4">
                          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                        </td>
                      </tr>
                    ))
                  : filteredCoins.map((coin, index) => (
                      <MarketRow key={coin.id} coin={coin} index={index} />
                    ))}
              </AnimatePresence>
            </tbody>
          </table>
          {!isLoading && filteredCoins.length === 0 && (
            <div className="p-20 text-center">
              <div className="inline-flex p-4 bg-slate-800/50 rounded-full mb-4">
                <Search size={32} className="text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-white">No matching assets</h3>
              <p className="text-sm text-slate-500">
                We couldn't find any assets matching "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={`m-skeleton-${i}`} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
          ))
        ) : filteredCoins.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex p-4 bg-slate-800/50 rounded-full mb-4">
              <Search size={28} className="text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-white">No matching assets</h3>
            <p className="text-xs text-slate-500 mt-1">No assets matching "{searchQuery}"</p>
          </div>
        ) : (
          filteredCoins.map((coin) => <MobileMarketCard key={coin.id} coin={coin} />)
        )}
      </div>
    </div>
  );
};

export default MarketView;
