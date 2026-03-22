import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { BRAND_FOOTER_SUMMARY, BRAND_NAME, BRAND_SUBTITLE } from '../../constants/branding';
import SupportEmailLink from '../common/SupportEmailLink';
import ZeroHueLogo from '../common/ZeroHueLogo';
import {
  introPrimaryCtaLabel,
  legalLinks,
  resourceLinks,
  socialLinks,
} from '../views/intro/content';

interface SiteFooterProps {
  showCta?: boolean;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ showCta = true }) => {
  return (
    <footer
      className="landing-section-divider px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-20"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0.5rem) + 3rem)' }}
    >
      <div className="mx-auto max-w-5xl">
        {showCta ? (
          <div className="landing-surface landing-preview-glow rounded-[2rem] p-5 sm:p-8 lg:p-10">
            <div className="mx-auto flex max-w-3xl flex-col items-start gap-5 text-left sm:items-center sm:text-center">
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Open the simulator when you&apos;re ready.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                No signup, no funding flow, and simulation only.
              </p>
              <div className="flex flex-col gap-3 sm:items-center">
                <Link
                  to="/markets"
                  className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02] sm:w-auto"
                >
                  {introPrimaryCtaLabel}
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
                <div className="text-left text-[11px] font-mono uppercase tracking-[0.24em] text-slate-500 sm:text-center">
                  Simulation only / Not financial advice
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`flex flex-col gap-8 border-t border-white/8 pt-8 lg:flex-row lg:items-start lg:justify-between ${showCta ? 'mt-8' : ''}`}
        >
          <div className="max-w-xs">
            <div className="flex items-center gap-3">
              <ZeroHueLogo />
              <div>
                <div className="text-sm font-black tracking-[0.28em] text-white">{BRAND_NAME}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
                  {BRAND_SUBTITLE}
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">{BRAND_FOOTER_SUMMARY}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Explore
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {resourceLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.path ?? '/'}
                    className="text-left text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Connect
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {socialLinks.map((link) => {
                  if (link.label === 'Email' && link.href?.startsWith('mailto:')) {
                    return (
                      <SupportEmailLink
                        key={link.label}
                        label="Email"
                        className="text-sm text-slate-400 transition-colors hover:text-white"
                      />
                    );
                  }
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Legal
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {legalLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.path ?? '/legal/privacy'}
                    className="text-left text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/8 pt-6 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-600">
          &copy; 2026 ZEROHUE. Simulation only. Not financial advice.
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
