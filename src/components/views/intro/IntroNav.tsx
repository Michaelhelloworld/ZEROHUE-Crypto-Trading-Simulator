import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router';
import { BRAND_NAME, BRAND_SUBTITLE } from '../../../constants/branding';
import ZeroHueLogo from '../../common/ZeroHueLogo';
import { introNavItems, introPrimaryCtaLabel } from './content';

const IntroNav: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : originalOverflow;

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  return (
    <nav
      className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? 'border-b border-white/8 bg-slate-950/75 shadow-[0_18px_50px_rgba(2,6,23,0.28)] backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-safe pl-safe pr-safe sm:px-6 sm:pb-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Go to homepage">
          <ZeroHueLogo />
          <div className="block">
            <div className="text-sm font-black tracking-[0.22em] text-white sm:tracking-[0.28em]">
              {BRAND_NAME}
            </div>
            <div className="hidden text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500 sm:block">
              {BRAND_SUBTITLE}
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {introNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="text-xs font-mono uppercase tracking-[0.26em] text-slate-400 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/markets"
            className="rounded-full border border-white/10 bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
          >
            {introPrimaryCtaLabel}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="rounded-full border border-white/10 bg-white/5 p-3 text-white transition-colors hover:border-white/20 hover:bg-white/10 md:hidden"
          aria-expanded={isMobileMenuOpen}
          aria-controls="intro-mobile-menu"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="intro-mobile-menu"
            data-testid="intro-mobile-menu"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
            className="overflow-hidden border-t border-white/8 bg-slate-950/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex max-h-[calc(100dvh-5.5rem)] flex-col gap-4 overflow-y-auto px-4 pb-8 pt-5 pl-safe pr-safe sm:px-6">
              {introNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-left text-sm font-mono uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/markets"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-2 rounded-2xl bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950"
              >
                {introPrimaryCtaLabel}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default IntroNav;
