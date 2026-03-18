import React from 'react';
import { Wallet } from 'lucide-react';
import { BRAND_NAME, BRAND_SUBTITLE } from '../../constants/branding';
import ZeroHueLogo from '../common/ZeroHueLogo';
import { usePortfolioManager } from '../../hooks/usePortfolioManager';
import { formatUsdWithSymbol } from '../../utils/format';

const MobileHeader: React.FC = () => {
  const {
    totalEquity,
    handleResetAccount: onResetAccount,
    isScoreDataComplete,
  } = usePortfolioManager();
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-safe pl-safe pr-safe">
        <div className="flex min-w-0 items-center gap-3" aria-label="ZeroHue Logo">
          <ZeroHueLogo small />
          <div className="flex min-w-0 flex-col">
            <span className="truncate bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-base font-black leading-none tracking-[0.15em] text-transparent sm:text-lg">
              {BRAND_NAME}
            </span>
            <span className="truncate text-[9px] font-bold tracking-wider text-emerald-500">
              {BRAND_SUBTITLE}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={onResetAccount}
            aria-label="Reset simulated account"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-slate-800/60 text-slate-300 transition-all active:scale-95 hover:text-white"
          >
            <Wallet size={16} />
          </button>
          <div className="flex min-w-0 flex-col items-end">
            <div className="max-w-[42vw] truncate rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-sm font-bold text-emerald-400">
              {formatUsdWithSymbol(totalEquity, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            {!isScoreDataComplete && (
              <div className="mt-1 max-w-[42vw] text-right text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                Price data incomplete
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
