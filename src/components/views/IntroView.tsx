import React from 'react';
import { BRAND_NAME } from '../../constants/branding';
import { useSEO } from '../../hooks/useSEO';
import { buildHomepageStructuredData } from '../../utils/seo';
import IntroFooter from './intro/IntroFooter';
import HeroSection from './intro/HeroSection';
import IntroNav from './intro/IntroNav';
import PrivacySection from './intro/PrivacySection';
import WorkflowSection from './intro/WorkflowSection';

const IntroView: React.FC = () => {
  useSEO({
    fullTitle: 'ZEROHUE | Crypto Trading Simulator',
    description: `${BRAND_NAME} is a local-first crypto trading simulator with live market context, paper execution, and no account required.`,
    structuredData: buildHomepageStructuredData(),
  });

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#020617] text-white selection:bg-blue-500/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="landing-grid absolute inset-0 opacity-60" />
        <div className="landing-ambient absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div
          className="landing-ambient absolute bottom-[-12rem] right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-3xl"
          style={{ animationDelay: '-8s' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.06),transparent_28%)]" />
      </div>

      <IntroNav />

      <main className="relative z-10">
        <HeroSection />
        <WorkflowSection />
        <PrivacySection />
        <IntroFooter />
      </main>
    </div>
  );
};

export default IntroView;
