import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculateCurrentFloatingLoss, calculateScores } from '../../utils/scoring';
import { Portfolio, Coin, Order } from '../../types';
import {
  Trophy,
  ShieldAlert,
  TrendingUp,
  Anchor,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ScoringDashboardProps {
  portfolio: Portfolio;
  coins: Coin[];
  orders: Order[];
  accountRoiPercentage: number;
}

const ScoringDashboard: React.FC<ScoringDashboardProps> = ({
  portfolio,
  coins,
  orders,
  accountRoiPercentage,
}) => {
  const [isExpanded, setIsExpanded] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const scoreState = useMemo(() => {
    const { floatingLoss, isPriceDataComplete } = calculateCurrentFloatingLoss(
      portfolio,
      orders,
      coins
    );

    return {
      isPriceDataComplete,
      scores: calculateScores({
        mdd: portfolio.historicalMDD || 0,
        accountRoi: accountRoiPercentage / 100,
        grossProfit: portfolio.grossProfit || 0,
        grossLoss: portfolio.grossLoss || 0,
        currentFloatingLoss: floatingLoss,
        validTradesCount: portfolio.validTradesCount || 0,
      }),
    };
  }, [portfolio, orders, coins, accountRoiPercentage]);

  const visibleScores = scoreState.isPriceDataComplete ? scoreState.scores : null;
  const {
    riskScore = 0,
    profitScore = 0,
    stableScore = 0,
    confidenceMultiplier = 0,
    totalScore = 0,
  } = visibleScores || {};
  const hasVisibleScores = scoreState.isPriceDataComplete;

  const riskRef = useRef<HTMLDivElement>(null);
  const profitRef = useRef<HTMLDivElement>(null);
  const stableRef = useRef<HTMLDivElement>(null);
  const confidenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (riskRef.current) riskRef.current.style.width = `${riskScore}%`;
    if (profitRef.current) profitRef.current.style.width = `${profitScore}%`;
    if (stableRef.current) stableRef.current.style.width = `${stableScore}%`;
    if (confidenceRef.current) confidenceRef.current.style.width = `${confidenceMultiplier * 100}%`;
  }, [riskScore, profitScore, stableScore, confidenceMultiplier]);

  return (
    <div className="glass-card mb-8 p-6 rounded-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

      <div
        className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 cursor-pointer group ${isExpanded ? 'mb-8' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 transition-colors group-hover:text-blue-300">
            <Trophy className="text-yellow-400" />
            Tracer Execution Score
            <div className="ml-2 p-1 rounded-md bg-white/5 text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Evaluating your overall trading competency across 4 dimensions.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            {hasVisibleScores ? totalScore.toFixed(1) : '--'}{' '}
            <span className="text-lg text-slate-500 font-normal">/ 100</span>
          </div>
          {isExpanded && (
            <>
              <p className="text-xs text-slate-500 font-mono mt-1 text-right animate-in fade-in slide-in-from-top-2 duration-300">
                Valid Trades: {portfolio.validTradesCount || 0}/20
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 text-right w-56 animate-in fade-in slide-in-from-top-2 duration-300">
                * Only fully closed FIFO lots opened at {'>='}5% of total equity at entry and held
                for {'>'}5 mins are counted.
              </p>
              {!scoreState.isPriceDataComplete && (
                <p className="text-[10px] text-amber-400/80 mt-1 text-right w-48 animate-in fade-in slide-in-from-top-2 duration-300">
                  Score paused while waiting for fresh mark prices.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10 animate-in fade-in slide-in-from-top-4 duration-500">
          {/* Risk Score */}
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 group cursor-help relative w-fit">
              <ShieldAlert size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-300">Risk Control</h3>
              <Info
                size={14}
                className="text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity"
              />

              <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Max Drawdown (MDD) scoring. 100 points for {'<'}10% MDD, 0 points for {'>'}50% MDD.
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {hasVisibleScores ? riskScore.toFixed(1) : '--'}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                ref={riskRef}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-[width] duration-500"
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">
              MDD: {((portfolio.historicalMDD || 0) * 100).toFixed(2)}%
            </p>
          </div>

          {/* Profit Score */}
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 group cursor-help relative w-fit">
              <TrendingUp size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-300">Profitability</h3>
              <Info
                size={14}
                className="text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity"
              />

              <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Logarithmic scoring based on cumulative account ROI. Max 100 points bounded at +100%
                ROI.
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {hasVisibleScores ? profitScore.toFixed(1) : '--'}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                ref={profitRef}
                className="bg-gradient-to-r from-emerald-500 to-green-400 h-1.5 rounded-full transition-[width] duration-500"
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Account ROI: {accountRoiPercentage.toFixed(2)}%
            </p>
          </div>

          {/* Stable Score */}
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 group cursor-help relative w-fit">
              <Anchor size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-300">Stability</h3>
              <Info
                size={14}
                className="text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity"
              />

              <div className="absolute left-0 lg:right-0 lg:left-auto bottom-full mb-2 w-48 p-2 bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Profit Factor (Gross Win / Gross Loss plus open floating loss) scoring. Represents
                consistency up to 2.5 PF.
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {hasVisibleScores ? stableScore.toFixed(1) : '--'}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                ref={stableRef}
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-[width] duration-500"
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Gross Pnl: +{(portfolio.grossProfit || 0).toFixed(0)} / -
              {(portfolio.grossLoss || 0).toFixed(0)}
            </p>
          </div>

          {/* Confidence Multiplier */}
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 group cursor-help relative w-fit">
              <CheckCircle size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-300">Confidence</h3>
              <Info
                size={14}
                className="text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity"
              />

              <div className="absolute left-0 lg:right-0 lg:left-auto bottom-full mb-2 w-48 p-2 bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Final multiplier (0.0x - 1.0x). Requires 20 valid fully closed lots to filter out
                pure luck.
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {hasVisibleScores ? `x${confidenceMultiplier.toFixed(2)}` : '--'}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                ref={confidenceRef}
                className="bg-gradient-to-r from-amber-500 to-orange-400 h-1.5 rounded-full transition-[width] duration-500"
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">Max Value: x1.00</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ScoringDashboard);
