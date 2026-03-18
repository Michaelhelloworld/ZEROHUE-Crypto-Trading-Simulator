import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, Activity } from 'lucide-react';

interface DisclaimerModalProps {
  onAccept: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept }) => {
  const [canAccept, setCanAccept] = useState(false);

  // Force a small delay or interaction before enabling the button to ensure reading?
  // For now, we'll keep it simple but make the button clear.

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-500">
      <div className="relative bg-[#090d15] rounded-[32px] w-full max-w-2xl border border-white/[0.08] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-500 ring-1 ring-white/5">
        {/* Header Accent Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />

        <div className="p-6 md:p-10 flex flex-col h-full max-h-[85vh] relative z-10">
          {/* Header */}
          <div className="flex items-start gap-5 mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-transparent flex items-center justify-center flex-shrink-0 border border-red-500/20 shadow-lg shadow-red-500/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-red-400/10 animate-pulse" />
              <ShieldAlert size={32} className="text-red-400 relative z-10" />
            </div>
            <div className="pt-1">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
                Important Disclaimer
              </h2>
              <p className="text-slate-400 font-medium text-sm md:text-base">
                Please read carefully before proceeding to the trading simulation.
              </p>
            </div>
          </div>

          {/* Scrolling Content */}
          <div className="space-y-4 text-slate-300 text-sm md:text-base leading-relaxed max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Card 1 */}
            <div className="relative group bg-slate-900/60 rounded-2xl p-5 border border-white/5 flex gap-4 transition-all hover:bg-slate-900 hover:border-white/10">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Info size={16} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-blue-100 font-bold mb-1 tracking-wide">
                  1. Educational Purpose Only
                </h3>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                  This platform is a <strong className="text-white">simulation</strong> designed for
                  educational and entertainment purposes only. No real money, cryptocurrency, or
                  actual financial assets are involved.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="relative group bg-slate-900/60 rounded-2xl p-5 border border-white/5 flex gap-4 transition-all hover:bg-slate-900 hover:border-white/10">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-100 font-bold mb-1 tracking-wide">
                  2. No Financial Advice
                </h3>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                  The information, data, and simulated trading results provided do not constitute
                  financial, investment, or trading advice.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="relative group bg-slate-900/60 rounded-2xl p-5 border border-white/5 flex gap-4 transition-all hover:bg-slate-900 hover:border-white/10">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <ShieldAlert size={16} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-red-100 font-bold mb-1 tracking-wide">3. Regulatory Status</h3>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                  This platform is not registered as an exchange in any jurisdiction. Users must
                  comply with their local laws regarding trading simulations.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="relative group bg-slate-900/60 rounded-2xl p-5 border border-white/5 flex gap-4 transition-all hover:bg-slate-900 hover:border-white/10">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Activity size={16} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-emerald-100 font-bold mb-1 tracking-wide">4. Data Accuracy</h3>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                  Market data is sourced for simulation purposes and may contain delays or
                  discrepancies from live market conditions.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-5">
            <div
              className="flex items-center gap-4 cursor-pointer group p-4 rounded-xl hover:bg-white/5 transition-colors w-full border border-transparent hover:border-white/5"
              onClick={() => setCanAccept(!canAccept)}
            >
              <div
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 ${canAccept ? 'bg-blue-500 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'border-slate-500 bg-[#090d15] group-hover:border-slate-400'}`}
              >
                {canAccept && <CheckCircle2 size={16} strokeWidth={3} className="text-[#090d15]" />}
              </div>
              <span
                className={`text-sm md:text-base font-bold select-none transition-colors ${canAccept ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}
              >
                I have read and agree to the terms above.
              </span>
            </div>

            <button
              onClick={onAccept}
              disabled={!canAccept}
              className="w-full py-4 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:shadow-none transition-all active:scale-[0.98] text-base tracking-widest uppercase relative overflow-hidden group border border-blue-500/50 disabled:border-transparent"
            >
              {!canAccept && <div className="absolute inset-0 bg-slate-900/50" />}
              <span className="relative z-10 flex items-center justify-center gap-2">
                Open Simulator
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
