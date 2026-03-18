import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import toast, { Toast } from 'react-hot-toast';
import PriceDisplay from './PriceDisplay';
import { formatAmount } from '../../utils/format';

interface TransactionToastProps {
  t: Toast;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  amount: number;
  symbol: string;
  price: number;
  timestamp?: number;
}

const TransactionToast: React.FC<TransactionToastProps> = ({
  t,
  type,
  orderType,
  amount,
  symbol,
  price,
  timestamp,
}) => {
  const isBuy = type === 'BUY';

  // Use state for relative time to keep render pure
  const [relativeTime, setRelativeTime] = React.useState<string>(() => {
    if (!timestamp) return 'Just Now';
    return ''; // Will be updated in effect
  });

  React.useEffect(() => {
    const updateRelativeTime = () => {
      if (!timestamp) {
        setRelativeTime('Just Now');
        return;
      }
      const diffInMinutes = Math.floor((Date.now() - timestamp) / 60000);
      if (diffInMinutes < 1) {
        setRelativeTime('Just Now');
      } else if (diffInMinutes < 60) {
        setRelativeTime(`${diffInMinutes}m ago`);
      } else {
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
          setRelativeTime(`${diffInHours}h ago`);
        } else {
          setRelativeTime(`${Math.floor(diffInHours / 24)}d ago`);
        }
      }
    };

    updateRelativeTime();
    // Since toasts only last 4s, we don't necessarily need a ticker,
    // but for completeness if it stays open:
    const timer = setInterval(updateRelativeTime, 60000);
    return () => clearInterval(timer);
  }, [timestamp]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10, x: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`${
        t.visible ? 'opacity-100' : 'opacity-0'
      } max-w-sm w-full bg-[#0f172a]/70 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto flex relative group ring-1 ring-white/10`}
    >
      {/* Glow Effect */}
      <div
        className={`absolute -inset-2 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none ${
          isBuy ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`}
      />

      <div className="flex-1 w-0 p-4 relative z-10">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              } border border-white/5 shadow-lg shadow-black/20`}
            >
              {isBuy ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </motion.div>
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                {orderType === 'MARKET' ? 'Market Order' : 'Limit Order'}
              </p>
              <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                <CheckCircle2 size={10} className="text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase">Success</span>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-xl font-black tracking-tight ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {isBuy ? 'Bought' : 'Sold'} {formatAmount(amount)} {symbol}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div
                className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"
                title={timestamp ? new Date(timestamp).toLocaleString() : ''}
              >
                <Clock size={10} />
                {relativeTime}
              </div>
              <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md">
                Price:{' '}
                <span className="text-slate-300 font-mono">
                  <PriceDisplay price={price} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(t.id);
        }}
        className="w-14 flex items-center justify-center text-slate-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 border-l border-white/5 group/btn active:scale-90"
      >
        <X size={18} className="transition-transform group-hover/btn:rotate-90 duration-300" />
      </button>

      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: 0 }}
        transition={{ duration: 4, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-1 pointer-events-none ${isBuy ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
      />
    </motion.div>
  );
};

export default TransactionToast;
