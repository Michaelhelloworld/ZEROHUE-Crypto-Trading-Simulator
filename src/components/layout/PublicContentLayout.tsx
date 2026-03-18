import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { BRAND_NAME, BRAND_SUBTITLE } from '../../constants/branding';
import ZeroHueLogo from '../common/ZeroHueLogo';

const navigationItems = [
  { label: 'Learn', path: '/learn' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'FAQ', path: '/faq' },
  { label: 'About', path: '/about' },
];

const legalItems = [
  { label: 'Privacy Policy', path: '/legal/privacy' },
  { label: 'Terms of Use', path: '/legal/terms' },
  { label: 'Risk Disclaimer', path: '/legal/disclaimer' },
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

      <footer className="relative z-10 border-t border-white/8 px-4 pb-14 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <ZeroHueLogo />
              <div>
                <div className="text-sm font-black tracking-[0.26em] text-white">{BRAND_NAME}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
                  {BRAND_SUBTITLE}
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Learn execution, risk, and review with live market context, paper execution, and
              local-first storage.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Explore
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {navigationItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Connect
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                <a
                  href="https://x.com/zerohue_org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-slate-400 transition-colors hover:text-white"
                >
                  X (Twitter)
                </a>
                <a
                  href="https://discord.gg/N48aHv9xjW"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-slate-400 transition-colors hover:text-white"
                >
                  Discord
                </a>
              </div>
            </div>

            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Legal
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {legalItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl border-t border-white/8 pt-6 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-600">
          &copy; 2026 ZEROHUE. Public content pages are indexable. The simulator is for paper
          trading only.
        </div>
      </footer>
    </div>
  );
};

export default PublicContentLayout;
