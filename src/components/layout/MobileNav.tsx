import React from 'react';
import { LayoutDashboard, PieChart, List, History, HelpCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import MobileNavButton from '../common/MobileNavButton';
import { useHaptic } from '../../hooks/useHaptic';
import { normalizePathname } from '../../utils/pathname';

const MobileNav: React.FC = () => {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const { trigger } = useHaptic();

  const tabs = [
    { path: '/markets', label: 'Markets', icon: <LayoutDashboard size={20} /> },
    { path: '/portfolio', label: 'Portfolio', icon: <PieChart size={20} /> },
    { path: '/orders', label: 'Orders', icon: <List size={20} /> },
    { path: '/history', label: 'History', icon: <History size={20} /> },
    { path: '/faq', label: 'FAQ', icon: <HelpCircle size={20} /> },
    { path: '/about', label: 'About', icon: <Info size={20} /> },
  ];

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#020617]/92 backdrop-blur-xl shadow-[0_-20px_45px_rgba(2,6,23,0.5)] md:hidden"
    >
      <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 pb-safe pl-safe pr-safe pt-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <div key={tab.path} className="relative flex min-w-0 flex-1 justify-center">
              <Link
                to={tab.path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
                className="flex w-full justify-center rounded-2xl outline-none"
                onClick={() => trigger('light')}
              >
                <MobileNavButton active={isActive} icon={tab.icon} label={tab.label} />
              </Link>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute -top-2 left-3 right-3 h-0.5 rounded-full bg-blue-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
