import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { BRAND_NAME, BRAND_SUBTITLE } from '../../constants/branding';
import ZeroHueLogo from '../common/ZeroHueLogo';
import SiteFooter from './SiteFooter';

const navigationItems = [
  { label: 'Learn', path: '/learn' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'FAQ', path: '/faq' },
  { label: 'About', path: '/about' },
];
interface PublicContentLayoutProps {
  children: React.ReactNode;
}

const PublicContentLayout: React.FC<PublicContentLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#020617] text-white selection:bg-blue-500/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="absolute left-[-10rem] top-[-10rem] h-[24rem] w-[24rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="landing-grid absolute inset-0 opacity-50" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#020617]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <ZeroHueLogo />
            <div>
              <div className="text-sm font-black tracking-[0.26em] text-white">{BRAND_NAME}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
                {BRAND_SUBTITLE}
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link
            to="/markets"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
          >
            Open Simulator
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {children}
      </main>
      <SiteFooter showCta={false} />
    </div>
  );
};

export default PublicContentLayout;
