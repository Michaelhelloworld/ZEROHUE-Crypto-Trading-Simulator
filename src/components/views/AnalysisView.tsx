import React, { memo, useState, useMemo } from 'react';
import { History } from 'lucide-react';

import PriceDisplay from '../common/PriceDisplay';
import Pagination from '../common/Pagination';
import ScoringDashboard from './ScoringDashboard';
import { useStore } from '../../store/useStore';
import { usePortfolioManager } from '../../hooks/usePortfolioManager';
import { useSEO } from '../../hooks/useSEO';
import { formatAmount, formatUsdWithSymbol } from '../../utils/format';

const itemsPerPage = 15;

const AnalysisView: React.FC = () => {
  useSEO({
    title: 'History & Analysis',
    description:
      'Review paper-trading history, PnL, and execution scoring inside the ZEROHUE simulator.',
    robots: 'noindex,follow',
  });

  const transactions = useStore((state) => state.transactions);
  const portfolio = useStore((state) => state.portfolio);
  const coins = useStore((state) => state.coins);
  const orders = useStore((state) => state.orders);
  const { accountRoiPercentage } = usePortfolioManager();
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));

  const displayTransactions = useMemo(() => {
    const sortedTransactions = [...transactions].sort(
      (left, right) => right.timestamp - left.timestamp
    );
    const validPage = Math.min(currentPage, totalPages);
    const startIndex = (validPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [transactions, currentPage, totalPages]);

  return (
    <div className="space-y-6 pb-6">
      <ScoringDashboard
        portfolio={portfolio}
        coins={coins}
        orders={orders}
        accountRoiPercentage={accountRoiPercentage}
      />
      <h2 className="text-2xl font-bold text-white">Transaction History</h2>
      {/* Desktop Table */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold tracking-wider">
            <tr>
              <th className="p-5">Time</th>
              <th className="p-5">Type</th>
              <th className="p-5">Asset</th>
              <th className="p-5 text-right">Amount</th>
              <th className="p-5 text-right">Price</th>
              <th className="p-5 text-right">Fee</th>
              <th className="p-5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayTransactions.length === 0 && (
              <tr className="h-64">
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <History size={32} className="mb-3 opacity-20" />
                    <p>No transactions yet</p>
                  </div>
                </td>
              </tr>
            )}
            {displayTransactions.map((tx) => (
              <tr key={tx.id} className="text-sm hover:bg-white/5 transition-colors">
                <td className="p-5 text-slate-500 font-mono text-xs">
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className="p-5">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${tx.type === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="p-5 font-bold text-slate-200">{tx.coinSymbol}</td>
                <td className="p-5 text-right font-mono text-slate-300">
                  {formatAmount(tx.amount)}
                </td>
                <td className="p-5 text-right font-mono text-slate-500">
                  <PriceDisplay price={tx.pricePerCoin} />
                </td>
                <td className="p-5 text-right font-mono text-slate-400">
                  {formatUsdWithSymbol(tx.fee || 0)}
                </td>
                <td className="p-5 text-right font-mono font-medium text-white">
                  {formatUsdWithSymbol(tx.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {displayTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 glass-card rounded-xl">
            <History size={32} className="mb-3 opacity-20" />
            <p>No transactions yet</p>
          </div>
        )}
        {displayTransactions.map((tx) => (
          <div key={tx.id} className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">{tx.coinSymbol}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${tx.type === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                >
                  {tx.type}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {new Date(tx.timestamp).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-slate-500 uppercase mb-1">Price</div>
                <div className="font-mono text-slate-300">
                  <PriceDisplay price={tx.pricePerCoin} />
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-slate-500 uppercase mb-1">Amt</div>
                <div className="font-mono text-slate-300">{formatAmount(tx.amount)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-slate-500 uppercase mb-1">Fee</div>
                <div className="font-mono text-slate-300">{formatUsdWithSymbol(tx.fee || 0)}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-slate-500 uppercase mb-1">Total</div>
                <div className="font-mono text-white font-bold">
                  {formatUsdWithSymbol(tx.total)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {transactions.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default memo(AnalysisView);
