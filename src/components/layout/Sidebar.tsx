import React, { useState } from 'react';
import {
  LayoutDashboard,
  PieChart,
  List,
  History,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND_NAME, BRAND_SUBTITLE } from '../../constants/branding';
import ZeroHueLogo from '../common/ZeroHueLogo';
import NavButton from '../common/NavButton';
import { usePortfolioManager } from '../../hooks/usePortfolioManager';
import { formatUsdWithSymbol } from '../../utils/format';
import { normalizePathname } from '../../utils/pathname';

const NAV_ITEMS = [
  {
    to: '/markets',
    label: 'Markets',
    icon: LayoutDashboard,
  },
  {
    to: '/portfolio',
    label: 'Portfolio',
    icon: PieChart,
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: List,
  },
  {
    to: '/history',
    label: 'History',
    icon: History,
  },
  {
    to: '/faq',
    label: 'FAQ',
    icon: HelpCircle,
  },
  {
    to: '/about',
    label: 'About',
    icon: Info,
  },
] as const;

const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    totalEquity,
    totalPnL,
    pnlPercentage,
    handleResetAccount: onResetAccount,
    isScoreDataComplete,
  } = usePortfolioManager();

  // Custom formatter for compact stats display
  const formatCompact = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(0);
  };

  return (
    <aside
      className={`hidden md:flex flex-col ${isCollapsed ? 'w-24 px-3 py-6 items-center' : 'w-64 px-5 py-6'} border-r border-white/5 bg-[#0f172a]/50 backdrop-blur-xl relative z-20 transition-all duration-300`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-10 bg-slate-800 border border-white/10 rounded-full p-1.5 hover:bg-slate-700 transition-colors z-30 text-slate-400 hover:text-white flex items-center justify-center shadow-lg"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-controls="sidebar-navigation"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Brand Header */}
      <div
        className={`flex ${isCollapsed ? 'flex-col justify-center w-full' : 'items-center'} gap-3 mb-10`}
        aria-label="ZeroHue Logo"
      >
        <ZeroHueLogo small={isCollapsed} />
        <div
          className={`transition-all duration-300 ${isCollapsed ? 'flex flex-col items-center mt-3' : ''}`}
        >
          <h1
            className={`font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 leading-none ${isCollapsed ? 'text-[9.5px]' : 'text-2xl'}`}
          >
            {BRAND_NAME}
          </h1>
          {!isCollapsed && (
            <span className="mt-1 block whitespace-nowrap text-[10px] font-bold tracking-[0.02em] text-emerald-500">
              {BRAND_SUBTITLE}
            </span>
          )}
        </div>
      </div>

      <nav
        id="sidebar-navigation"
        aria-label="Primary navigation"
        className={`space-y-2 flex-1 ${isCollapsed ? 'w-full flex-col items-center space-y-3' : ''}`}
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = pathname === to;

          return (
            <Link
              key={to}
              to={to}
              className="block outline-none"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <NavButton
                active={isActive}
                icon={<Icon size={20} />}
                label={label}
                isCollapsed={isCollapsed}
              />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 w-full flex flex-col items-center">
        {/* Funding Options Button */}
        <button
          onClick={onResetAccount}
          title={isCollapsed ? 'Funding Options' : undefined}
          aria-label="Funding options and account reset"
          className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent border border-blue-500/20 hover:border-blue-400/40 transition-all active:scale-[0.98] mb-1 ${isCollapsed ? 'w-12 h-12 flex flex-shrink-0 items-center justify-center' : 'w-full p-3 flex items-center gap-3'}`}
        >
          <div className="absolute inset-0 bg-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div
            className={`rounded-lg bg-blue-500/20 flex flex-shrink-0 items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/30 transition-all ring-1 ring-blue-500/20 relative z-10 ${isCollapsed ? 'w-full h-full' : 'w-9 h-9'}`}
          >
            <Wallet size={18} />
          </div>
          {!isCollapsed && (
            <div className="text-left relative z-10">
              <div className="text-sm font-bold text-blue-100 group-hover:text-white transition-colors">
                Funding Options
              </div>
              <div className="text-[10px] font-medium text-blue-400/60 group-hover:text-blue-300">
                Add funds & reset
              </div>
            </div>
          )}
        </button>

        {!isCollapsed ? (
          <div className="glass rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 w-full">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet size={48} />
            </div>
            <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
              Total Equity
            </div>
            {!isScoreDataComplete && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                Price data incomplete
              </div>
            )}
            <div className="text-2xl font-bold font-mono text-white mb-1 whitespace-nowrap">
              {formatUsdWithSymbol(totalEquity, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div
              className={`text-sm font-medium flex items-center gap-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {totalPnL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {pnlPercentage.toFixed(2)}%
            </div>
          </div>
        ) : (
          <div
            className="glass rounded-[14px] p-2 py-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 w-full"
            title="Total Equity"
            aria-label={`Total equity ${formatUsdWithSymbol(totalEquity, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
          >
            <Wallet size={16} className="text-slate-400 mb-0.5" />
            <div className="text-[11px] font-bold font-mono text-white text-center leading-none">
              ${formatCompact(totalEquity)}
            </div>
            <div
              className={`text-[9px] font-medium flex items-center leading-none ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {totalPnL >= 0 ? '+' : ''}
              {pnlPercentage.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
