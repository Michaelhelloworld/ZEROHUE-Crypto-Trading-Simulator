import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SectionIntro from './SectionIntro';
import { workflowSteps } from './content';

const WorkflowSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <section id="workflow" className="landing-section-divider px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow="Workflow"
          title="Learn the workflow."
          description="Observe the market, simulate the order, and review the result."
        />

        <div className="mt-10 grid gap-4 md:mt-12 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <motion.article
              key={step.step}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: 0.65,
                delay: shouldReduceMotion ? 0 : index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              className="landing-surface relative rounded-[1.75rem] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-4xl font-black tracking-tight text-white/12">
                  {step.step}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-blue-200">
                  <step.icon size={20} />
                </div>
              </div>
              <div className="mt-8 inline-flex rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.26em] text-slate-400">
                {step.accent}
              </div>
              <h3 className="mt-5 text-xl font-bold text-white sm:text-2xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
