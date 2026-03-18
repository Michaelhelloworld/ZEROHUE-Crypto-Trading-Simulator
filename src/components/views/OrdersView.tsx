import React, { useMemo, useState } from 'react';
import { List, XCircle } from 'lucide-react';

import PriceDisplay from '../common/PriceDisplay';
import Pagination from '../common/Pagination';
import ConfirmModal from '../modals/ConfirmModal';
import { useStore } from '../../store/useStore';
import { useTradeExecution } from '../../hooks/useTradeExecution';
import { useSEO } from '../../hooks/useSEO';
import { formatAmount } from '../../utils/format';

const itemsPerPage = 8;

const OrdersView: React.FC = () => {
  useSEO({
    title: 'Orders',
    description:
      'Manage open paper orders, review fills and cancellations, and track execution status in ZEROHUE.',
    robots: 'noindex,follow',
  });

  const orders = useStore((state) => state.orders);
  const { handleCancelOrder: onCancelOrder } = useTradeExecution();
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'OPEN').sort((a, b) => b.timestamp - a.timestamp),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => o.status !== 'OPEN').sort((a, b) => b.timestamp - a.timestamp),
    [orders]
  );

  const activeTotalPages = Math.max(1, Math.ceil(activeOrders.length / itemsPerPage));
  const historyTotalPages = Math.max(1, Math.ceil(historyOrders.length / itemsPerPage));

  const displayActiveOrders = useMemo(() => {
    const validPage = Math.min(activePage, activeTotalPages);
    const start = (validPage - 1) * itemsPerPage;
    return activeOrders.slice(start, start + itemsPerPage);
  }, [activeOrders, activePage, activeTotalPages]);

  const displayHistoryOrders = useMemo(() => {
    const validPage = Math.min(historyPage, historyTotalPages);
    const start = (validPage - 1) * itemsPerPage;
    return historyOrders.slice(start, start + itemsPerPage);
  }, [historyOrders, historyPage, historyTotalPages]);

  return (
    <div className="space-y-6 pb-6">
      <h2 className="text-2xl font-bold text-white">Active Orders</h2>
      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase font-semibold tracking-wider">
            <tr>
              <th className="p-5">Time</th>
              <th className="p-5">Pair</th>
              <th className="p-5">Type</th>
              <th className="p-5 text-right">Price</th>
              <th className="p-5 text-right">Amount</th>
              <th className="p-5 text-right">Status</th>
              <th className="p-5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayActiveOrders.length === 0 && (
              <tr className="h-64">
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <List size={32} className="mb-3 opacity-20" />
                    <p>No open orders</p>
                  </div>
                </td>
              </tr>
            )}
            {displayActiveOrders.map((order) => (
              <tr key={order.id} className="text-sm hover:bg-white/5 transition-colors">
                <td className="p-5 text-slate-500 font-mono text-xs">
                  {new Date(order.timestamp).toLocaleString()}
                </td>
                <td className="p-5 font-bold text-slate-200">{order.coinSymbol}</td>
                <td className="p-5">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                      order.type === 'BUY'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    {order.type}
                  </span>
                </td>
                <td className="p-5 text-right font-mono font-medium text-white">
                  <PriceDisplay price={order.limitPrice} />
                </td>
                <td className="p-5 text-right font-mono text-slate-300">
                  {formatAmount(order.amount)}
                </td>
                <td className="p-5 text-right">
                  <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-xs border border-blue-500/20">
                    OPEN
                  </span>
                </td>
                <td className="p-5 text-center">
                  <button
                    onClick={() => setOrderToCancel(order.id)}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1 mx-auto"
                  >
                    <XCircle size={14} /> Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Active Orders) */}
      <div className="md:hidden space-y-4">
        {displayActiveOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 glass-card rounded-xl">
            <List size={32} className="mb-3 opacity-20" />
            <p>No open orders</p>
          </div>
        )}
        {displayActiveOrders.map((order) => (
          <div key={order.id} className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-white text-lg">{order.coinSymbol}</div>
                <div className="text-xs text-slate-500 font-mono">
                  {new Date(order.timestamp).toLocaleString()}
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                  order.type === 'BUY'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {order.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/5 rounded-lg p-2.5">
                <div className="text-xs text-slate-500 uppercase mb-1">Price</div>
                <div className="font-mono text-slate-200">
                  <PriceDisplay price={order.limitPrice} />
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <div className="text-xs text-slate-500 uppercase mb-1">Amount</div>
                <div className="font-mono text-slate-200">{formatAmount(order.amount)}</div>
              </div>
            </div>

            <button
              onClick={() => setOrderToCancel(order.id)}
              className="w-full py-3 mt-2 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 font-bold rounded-xl transition-all active:scale-95 border border-white/5 flex items-center justify-center gap-2"
            >
              <XCircle size={16} /> Cancel Order
            </button>
          </div>
        ))}
      </div>

      {activeOrders.length > itemsPerPage && (
        <Pagination
          currentPage={activePage}
          totalPages={activeTotalPages}
          onPageChange={setActivePage}
        />
      )}

      {historyOrders.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-slate-400 mt-8">Order History</h3>

          {/* Desktop History Table */}
          <div className="hidden md:block glass rounded-2xl overflow-hidden opacity-70">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-slate-500 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Pair</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayHistoryOrders.map((order) => (
                  <tr key={order.id} className="text-sm">
                    <td className="p-4 text-slate-600 font-mono text-xs">
                      {new Date(order.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-400">{order.coinSymbol}</td>
                    <td className="p-4">
                      <span
                        className={`text-xs font-bold ${
                          order.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500">
                      <PriceDisplay price={order.limitPrice} />
                    </td>
                    <td className="p-4 text-right">
                      <span
                        className={`text-xs ${
                          order.status === 'FILLED' ? 'text-emerald-500' : 'text-slate-500'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile History Cards */}
          <div className="md:hidden space-y-3 opacity-80">
            {displayHistoryOrders.map((order) => (
              <div
                key={order.id}
                className="glass border border-white/5 p-3 rounded-lg flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300">{order.coinSymbol}</span>
                    <span
                      className={`text-xs font-bold ${
                        order.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {order.type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {new Date(order.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-mono">
                    <PriceDisplay price={order.limitPrice} />
                  </div>
                  <span
                    className={`text-xs ${
                      order.status === 'FILLED' ? 'text-emerald-500' : 'text-slate-500'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {historyOrders.length > itemsPerPage && (
            <Pagination
              currentPage={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
            />
          )}
        </>
      )}

      {/* Cancel Order Confirmation Modal */}
      <ConfirmModal
        isOpen={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={() => {
          if (orderToCancel) {
            onCancelOrder(orderToCancel);
            setOrderToCancel(null);
          }
        }}
        title="Cancel Order"
        message="Are you sure you want to cancel this active order? This action cannot be undone."
        confirmText="Yes, Cancel"
      />
    </div>
  );
};

export default React.memo(OrdersView);
