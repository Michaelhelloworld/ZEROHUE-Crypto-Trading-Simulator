import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Share2, Info, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Coin } from '../../../types';
import CryptoIcon from '../../CryptoIcon';
import PriceDisplay from '../../common/PriceDisplay';

const CMC_ID_MAPPING: Record<string, string> = {
  'avalanche-2': 'avalanche',
  binancecoin: 'bnb',
  'hedera-hashgraph': 'hedera',
  near: 'near-protocol',
  polkadot: 'polkadot-new',
  'quant-network': 'quant',
  'render-token': 'render',
  ripple: 'xrp',
  'world-liberty-financial': 'world-liberty-financial-wlfi',
};

interface TradeHeaderProps {
  coin: Coin;
}

const TradeHeader: React.FC<TradeHeaderProps> = ({ coin }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCMC = () => {
    const cmcId = CMC_ID_MAPPING[coin.id] || coin.id;
    window.open(`https://coinmarketcap.com/currencies/${cmcId}/`, '_blank');
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/markets')}
          className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-white/5"
          aria-label="Back to markets"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <CryptoIcon symbol={coin.symbol} size={40} />
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2">
              {coin.name}{' '}
              <span className="text-slate-500 font-mono text-sm md:text-lg uppercase">
                {coin.symbol}/USDT
              </span>
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xl font-mono font-bold text-white">
                <PriceDisplay price={coin.price} />
              </span>
              <span
                className={`text-sm font-bold font-mono ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {coin.change24h >= 0 ? '+' : ''}
                {coin.change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          className={`relative p-2.5 rounded-xl transition-all border ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Share this asset link"
          title="Copy link to this coin"
        >
          {copied ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
              <Zap size={18} fill="currentColor" />
            </motion.div>
          ) : (
            <Share2 size={18} />
          )}
          {copied && (
            <motion.span
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-bold text-emerald-400 whitespace-nowrap"
            >
              Copied!
            </motion.span>
          )}
        </button>
        <button
          onClick={handleCMC}
          className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
          aria-label="View asset on CoinMarketCap"
          title="View on CoinMarketCap"
        >
          <Info size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(TradeHeader);
