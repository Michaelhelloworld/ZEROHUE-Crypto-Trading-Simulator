import React from 'react';

type NavIconElement = React.ReactElement<{ size?: number }>;

interface NavButtonProps {
  active: boolean;
  onClick?: () => void;
  icon: NavIconElement;
  label: string;
  isCollapsed?: boolean;
}

const NavButton = ({ active, onClick, icon, label, isCollapsed = false }: NavButtonProps) => (
  <div
    onClick={onClick}
    className={`flex items-center transition-all duration-200 group relative overflow-hidden mx-auto ${
      isCollapsed
        ? 'justify-center w-12 h-12 rounded-[14px]'
        : 'w-full gap-3 px-4 py-3.5 rounded-xl'
    } ${
      active
        ? 'bg-blue-600/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400/30'
        : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
    }`}
    title={isCollapsed ? label : undefined}
  >
    <span
      aria-hidden="true"
      className={`transition-colors flex-shrink-0 flex items-center justify-center ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
    >
      {React.cloneElement(icon, {
        size: isCollapsed ? 22 : 20,
      })}
    </span>
    {!isCollapsed && (
      <>
        <span className="font-medium text-sm whitespace-nowrap">{label}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></span>
        )}
      </>
    )}
    {isCollapsed && <span className="sr-only">{label}</span>}
  </div>
);

export default NavButton;
