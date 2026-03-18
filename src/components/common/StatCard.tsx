import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
  prefix: string;
  isPnL?: boolean;
  pnlValue?: number;
  helperText?: string;
  helperTone?: 'neutral' | 'warning';
}

const StatCard = ({
  label,
  value,
  prefix,
  isPnL = false,
  pnlValue = 0,
  helperText,
  helperTone = 'neutral',
}: StatCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
    className="glass-card p-4 md:p-5 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-colors cursor-default"
  >
    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</div>
    <div
      className={`text-xl md:text-2xl font-bold font-mono ${isPnL ? (pnlValue >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}
    >
      {prefix}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </div>
    {helperText && (
      <div
        className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
          helperTone === 'warning' ? 'text-amber-300' : 'text-slate-400'
        }`}
      >
        {helperText}
      </div>
    )}
    {/* Decorative gradient blob */}
    <div
      className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity ${isPnL ? (pnlValue >= 0 ? 'bg-emerald-500' : 'bg-red-500') : 'bg-blue-500'}`}
    ></div>
  </motion.div>
);

export default React.memo(StatCard);
