import React, { useState } from 'react';
import { X, Target, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coin, Holding } from '../../types';
import CryptoIcon from '../CryptoIcon';
import PriceDisplay from '../common/PriceDisplay';

import toast from 'react-hot-toast';
import { formatPriceInput } from '../../utils/format';
import {
  PRICE_INPUT_LIMITS,
  describePriceInputRange,
  isWithinInclusiveRange,
  preventSignedExponentInput,
} from '../../utils/inputConstraints';

interface EditPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  coin: Coin | null;
  onConfirm: (coinId: string, tp: number | undefined, sl: number | undefined) => void;
}

const EditPositionModal: React.FC<EditPositionModalProps> = ({
  isOpen,
  onClose,
  holding,
  coin,
  onConfirm,
}) => {
  const [takeProfit, setTakeProfit] = useState<string>(() =>
    holding?.takeProfitPrice && holding.takeProfitPrice > 0
      ? formatPriceInput(holding.takeProfitPrice)
      : ''
  );
  const [stopLoss, setStopLoss] = useState<string>(() =>
    holding?.stopLossPrice && holding.stopLossPrice > 0
      ? formatPriceInput(holding.stopLossPrice)
      : ''
  );

  if (!holding || !coin) return null;

  const referencePrice = holding.averageCost > 0 ? holding.averageCost : coin.price;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;

    if (tp !== undefined && !isWithinInclusiveRange(tp, PRICE_INPUT_LIMITS)) {
      toast.error(`Take Profit must be within ${describePriceInputRange()}`);
      return;
    }

    if (sl !== undefined && !isWithinInclusiveRange(sl, PRICE_INPUT_LIMITS)) {
      toast.error(`Stop Loss must be within ${describePriceInputRange()}`);
      return;
    }

    // Consistent with marketEngine.worker.ts: isLong = amount > 0
    const isLong = (holding.amount || 0) >= 0;

    if (isLong) {
      if (tp !== undefined && coin && tp <= coin.price) {
        toast.error('Take Profit must be higher than current price');
        return;
      }
      if (sl !== undefined && coin && sl >= coin.price) {
        toast.error('Stop Loss must be lower than current price');
        return;
      }
    } else {
      // Short position: profit when price declines
      if (tp !== undefined && coin && tp >= coin.price) {
        toast.error('Take Profit must be lower than current price for short positions');
        return;
      }
      if (sl !== undefined && coin && sl <= coin.price) {
        toast.error('Stop Loss must be higher than current price for short positions');
        return;
      }
    }

    onConfirm(holding.coinId, tp, sl);
  };

  const calculatePercentage = (price: string) => {
    if (!price || parseFloat(price) <= 0 || referencePrice <= 0) return '0';
    return (((parseFloat(price) - referencePrice) / referencePrice) * 100).toFixed(2);
  };

  const setPercentage = (type: 'tp' | 'sl', percentage: number) => {
    const targetPrice = referencePrice * (1 + percentage / 100);
    if (type === 'tp') setTakeProfit(formatPriceInput(targetPrice));
    else setStopLoss(formatPriceInput(targetPrice));
  };

  const tpPercent = parseFloat(calculatePercentage(takeProfit));
  const slPercent = parseFloat(calculatePercentage(stopLoss));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Enhanced Backdrop (Performance Optimized) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80"
          />

          {/* Premium Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-[420px] bg-[#090d15] border border-white/[0.08] rounded-[32px] shadow-2xl overflow-hidden ring-1 ring-white/5"
          >
            {/* Header Accent Glow (Lightweight) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />

            {/* Header Section */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
              <div className="flex items-center gap-3.5">
                <div className="p-1 bg-white/[0.03] rounded-2xl border border-white/10 shadow-inner">
                  <CryptoIcon symbol={coin.symbol} size={32} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    Edit Strategy
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                      Entry
                    </span>
                    <PriceDisplay
                      price={holding.averageCost}
                      className="text-xs font-mono font-black text-blue-400"
                    />
                  </div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all border border-white/5 group"
              >
                <X size={18} className="group-hover:scale-110 transition-transform" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-7">
              {/* Live Context Card */}
              <div className="relative group bg-slate-900/90 rounded-2xl p-4 border border-white/5 flex justify-between items-center shadow-inner overflow-hidden transition-all hover:bg-slate-900 hover:border-white/10">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-3 h-3 bg-blue-500/30 rounded-full animate-ping" />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                  </div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    Live Price
                  </span>
                </div>
                <PriceDisplay
                  price={coin.price}
                  className="relative text-lg font-mono font-black text-white"
                />
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-black text-emerald-400/90 uppercase tracking-[0.15em] flex items-center gap-2">
                      <Target size={14} className="text-emerald-400" />
                      Take Profit
                    </label>
                    <AnimatePresence>
                      {takeProfit && (
                        <motion.span
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="text-[10px] font-mono font-black text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                        >
                          +{tpPercent}%
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative group/input">
                    <div className="absolute inset-0 bg-emerald-500/5 rounded-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-base font-bold select-none group-focus-within/input:text-emerald-400/70 transition-colors">
                      $
                    </span>
                    <input
                      type="number"
                      step={PRICE_INPUT_LIMITS.step}
                      min={PRICE_INPUT_LIMITS.minText}
                      max={PRICE_INPUT_LIMITS.maxText}
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      onKeyDown={preventSignedExponentInput}
                      placeholder="Enter target price"
                      className="relative w-full bg-[#1e293b]/50 border border-white/[0.08] rounded-xl pl-8 pr-4 py-4 text-sm font-mono text-white focus:border-emerald-500/40 focus:bg-[#1e293b]/80 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all placeholder:text-slate-500 shadow-inner"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {[10, 25, 50, 100].map((pct) => (
                      <motion.button
                        key={pct}
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPercentage('tp', pct)}
                        className="flex-1 py-1.5 text-[10px] font-black rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all font-mono"
                      >
                        +{pct}%
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1 mt-2">
                    <label className="text-[11px] font-black text-red-500/90 uppercase tracking-[0.15em] flex items-center gap-2">
                      <ShieldAlert size={14} className="text-red-500/80" />
                      Stop Loss
                    </label>
                    <AnimatePresence>
                      {stopLoss && (
                        <motion.span
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="text-[10px] font-mono font-black text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]"
                        >
                          {slPercent}%
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative group/input">
                    <div className="absolute inset-0 bg-red-500/5 rounded-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-base font-bold select-none group-focus-within/input:text-red-500/60 transition-colors">
                      $
                    </span>
                    <input
                      type="number"
                      step={PRICE_INPUT_LIMITS.step}
                      min={PRICE_INPUT_LIMITS.minText}
                      max={PRICE_INPUT_LIMITS.maxText}
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      onKeyDown={preventSignedExponentInput}
                      placeholder="Enter protection price"
                      className="relative w-full bg-[#1e293b]/50 border border-white/[0.08] rounded-xl pl-8 pr-4 py-4 text-sm font-mono text-white focus:border-red-500/40 focus:bg-[#1e293b]/80 focus:ring-4 focus:ring-red-500/10 focus:outline-none transition-all placeholder:text-slate-500 shadow-inner"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {[-2, -5, -10, -20].map((pct) => (
                      <motion.button
                        key={pct}
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPercentage('sl', pct)}
                        className="flex-1 py-1.5 text-[10px] font-black rounded-lg bg-red-500/5 border border-red-500/10 text-red-500/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all font-mono"
                      >
                        {pct}%
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="relative w-full py-4 mt-4 rounded-xl font-black text-[13px] uppercase tracking-widest text-white overflow-hidden group"
              >
                {/* Abstract animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s_ease] hover:bg-[position:200%_0,0_0] hover:transition-[background-position_1.5s_ease]" />
                <div className="absolute inset-0 ring-1 ring-white/20 rounded-xl" />
                <span className="relative z-10 drop-shadow-md">Update Strategy</span>
              </motion.button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditPositionModal;
