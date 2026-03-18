import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface SectionIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
}

const SectionIntro: React.FC<SectionIntroProps> = ({
  eyebrow,
  title,
  description,
  align = 'center',
}) => {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const alignmentClass =
    align === 'left'
      ? 'items-start text-left'
      : 'items-start text-left sm:items-center sm:text-center';

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto flex max-w-3xl flex-col gap-3 sm:gap-4 ${alignmentClass}`}
    >
      <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.32em] text-blue-200">
        {eyebrow}
      </span>
      <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base md:text-lg">
        {description}
      </p>
    </motion.div>
  );
};

export default SectionIntro;
