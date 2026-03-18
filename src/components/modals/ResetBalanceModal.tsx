import React, { useState } from 'react';
import { X, Wallet, Crown, TrendingUp, Award, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHaptic } from '../../hooks/useHaptic';
import { formatUsdWithSymbol } from '../../utils/format';
import {
  RESET_BALANCE_INPUT_LIMITS,
  describeWholeUsdInputRange,
  isWholeNumberWithinInclusiveRange,
  preventNonIntegerInput,
} from '../../utils/inputConstraints';

interface ResetBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

const FUNDING_OPTIONS = [
  {
    label: 'Starter',
    amount: 10000,
    desc: 'Perfect for learning',
    icon: <Wallet size={24} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'group-hover:border-blue-500/50',
    hoverBg: 'group-hover:bg-blue-500/10',
  },
  {
    label: 'Trader',
    amount: 50000,
    desc: 'Standard capital',
    icon: <TrendingUp size={24} />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'group-hover:border-purple-500/50',
    hoverBg: 'group-hover:bg-purple-500/10',
  },
  {
    label: 'Pro',
    amount: 100000,
    desc: 'Serious strategies',
    icon: <Award size={24} />,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'group-hover:border-pink-500/50',
    hoverBg: 'group-hover:bg-pink-500/10',
  },
  {
    label: 'Whale',
    amount: 1000000,
    desc: 'Unlimited power',
    icon: <Crown size={24} />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'group-hover:border-amber-500/50',
    hoverBg: 'group-hover:bg-amber-500/10',
  },
];

const CUSTOM_BALANCE_PLACEHOLDER = '50000';

const ResetBalanceModal: React.FC<ResetBalanceModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { trigger } = useHaptic();
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showCustom, setShowCustom] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCustomAmountChange = (value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setCustomAmount(value);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(customAmount);
    if (!isWholeNumberWithinInclusiveRange(amount, RESET_BALANCE_INPUT_LIMITS)) {
      toast.error(
        `Custom capital must be a whole number within ${describeWholeUsdInputRange(RESET_BALANCE_INPUT_LIMITS)}`
      );
      return;
    }

    setPendingAmount(amount);
  };

  const handleSelect = (amount: number) => {
    setPendingAmount(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-[#0f172a]/90 rounded-[32px] w-full max-w-lg border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10">
        {!pendingAmount ? (
          <>
            {/* Header */}
            <div className="flex justify-between items-center p-6 pb-2">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Select Capital</h2>
                <p className="text-slate-400 text-sm">
                  Choose your starting balance for the simulation.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options Grid */}
            <div className="p-6 grid grid-cols-1 gap-3">
              {FUNDING_OPTIONS.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => handleSelect(option.amount)}
                  className={`group relative flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5 transition-all duration-300 active:scale-[0.98] ${option.border} ${option.hoverBg}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full ${option.bg} flex items-center justify-center ${option.color} transition-transform group-hover:scale-110 duration-300`}
                    >
                      {option.icon}
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold text-lg leading-tight group-hover:text-white transition-colors">
                        {option.label}
                      </div>
                      <div className="text-xs text-slate-500 font-medium group-hover:text-slate-400 transition-colors">
                        {option.desc}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono text-slate-200 group-hover:text-white transition-colors">
                      {formatUsdWithSymbol(option.amount, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-600 group-hover:text-slate-500">
                      Virtual USD
                    </div>
                  </div>
                </button>
              ))}

              {/* Custom Amount Toggle */}
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="mt-2 w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/30 transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  Or enter custom amount
                </button>
              ) : (
                <form
                  onSubmit={handleCustomSubmit}
                  className="mt-2 animate-in slide-in-from-top-2 fade-in"
                >
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      min={RESET_BALANCE_INPUT_LIMITS.minText}
                      max={RESET_BALANCE_INPUT_LIMITS.maxText}
                      step={RESET_BALANCE_INPUT_LIMITS.step}
                      inputMode="numeric"
                      placeholder={CUSTOM_BALANCE_PLACEHOLDER}
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      onKeyDown={preventNonIntegerInput}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-8 pr-12 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition-colors"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!customAmount}
                      className="absolute right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-900/50 border-t border-white/5 items-center justify-center text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Select an amount to proceed to confirmation.
              </p>
            </div>
          </>
        ) : (
          <div className="p-8 text-center animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp size={32} className="rotate-180" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Are you sure?</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              This will <span className="text-red-400 font-bold">wipe all your current data</span>,
              including trade history and modified settings. Your balance will be reset to{' '}
              <span className="text-white font-mono font-bold">
                {formatUsdWithSymbol(pendingAmount, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
              .
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setPendingAmount(null)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  trigger('success');
                  onConfirm(pendingAmount);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all active:scale-[0.98]"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetBalanceModal;
