import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { HERO_BRAND_BADGE } from '../../../constants/branding';
import {
  heroTrustPills,
  introNavItems,
  introPrimaryCtaLabel,
  introSecondaryCtaLabel,
  scrollToSection,
} from './content';

const HeroSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <section
      id="experience"
      className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-36 lg:px-8 lg:pb-20 lg:pt-40"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex max-w-4xl flex-col items-start text-left sm:items-center sm:text-center"
        >
          <div className="mb-6 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4">
            <span className="h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_12px_rgba(125,211,252,0.8)]" />
            <span className="text-[9px] font-mono uppercase leading-5 tracking-[0.24em] text-slate-300 sm:text-[10px] sm:tracking-[0.34em]">
              {HERO_BRAND_BADGE}
            </span>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:mx-auto sm:text-6xl md:text-7xl lg:text-[5.4rem] lg:leading-[0.94]">
              Practice crypto trades before real capital is on the line.
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-300 sm:mx-auto sm:text-lg">
              Live market context, paper execution, and no account required.
            </p>
          </div>

          <div className="mt-8 grid w-full gap-3 sm:flex sm:flex-wrap sm:justify-center">
            {heroTrustPills.map((item) => (
              <div
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-slate-950/55 px-4 py-2 text-xs font-medium text-slate-200 sm:justify-center"
              >
                <Check size={14} className="text-blue-200" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 flex w-full flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/markets"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 transition-transform hover:scale-[1.02] sm:w-auto"
            >
              {introPrimaryCtaLabel}
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
            <button
              onClick={() => scrollToSection('workflow')}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/[0.08] sm:w-auto"
            >
              {introSecondaryCtaLabel}
            </button>
          </div>

          <div className="mt-6 flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide sm:hidden">
            {introNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] text-slate-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
