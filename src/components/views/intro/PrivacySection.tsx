import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Shield } from 'lucide-react';
import SectionIntro from './SectionIntro';
import { privacySignals } from './content';

const PrivacySection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <section id="privacy" className="landing-section-divider px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow="Privacy"
          title="Private by default."
          description="Stored on this device, no signup required, and built only for simulation."
        />

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="landing-surface mt-10 rounded-[1.75rem] p-5 sm:p-7"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-blue-200">
                <Shield size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Local-first trading practice</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500">
                  No real funds
                </div>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-300">
              ZEROHUE keeps the practice loop clear: live context on screen, paper execution in the
              browser, and no custody or funding flow.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {privacySignals.map((signal, index) => (
              <motion.div
                key={signal.title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  duration: 0.6,
                  delay: shouldReduceMotion ? 0 : index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 sm:p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-blue-200">
                  <signal.icon size={18} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{signal.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{signal.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PrivacySection;
