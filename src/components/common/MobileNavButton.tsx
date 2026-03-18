import React from 'react';

interface MobileNavButtonProps {
  active: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}

const MobileNavButton = ({ active, onClick, icon, label }: MobileNavButtonProps) => (
  <div
    onClick={onClick}
    className={`flex h-[56px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-center transition-all active:scale-95 ${
      active
        ? 'border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
        : 'border border-transparent text-slate-500 hover:text-slate-300'
    }`}
  >
    <div className="shrink-0">{icon}</div>
    <span className="w-full whitespace-normal px-0.5 text-[8px] font-bold leading-[1.05] tracking-tight">
      {label}
    </span>
  </div>
);

export default MobileNavButton;
