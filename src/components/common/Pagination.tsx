import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-3 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/50 hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:bg-slate-800/50 disabled:cursor-not-allowed border border-white/5 text-slate-300 transition-all active:scale-95"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="font-mono text-xs text-slate-400 font-medium px-2 py-1 bg-white/5 rounded-lg border border-white/5">
        <span className="text-white">{currentPage}</span> / {totalPages}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/50 hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:bg-slate-800/50 disabled:cursor-not-allowed border border-white/5 text-slate-300 transition-all active:scale-95"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default React.memo(Pagination);
