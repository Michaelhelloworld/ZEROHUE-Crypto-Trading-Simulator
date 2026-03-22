import React from 'react';
import { Info, Zap, Shield, Activity, Code, Globe, Layers3 } from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { aboutFeatures, aboutPage } from '../../content/publicContent';
import SupportRichText from '../common/SupportRichText';

const featureIcons = [
  <Activity className="text-emerald-400" size={24} />,
  <Shield className="text-blue-400" size={24} />,
  <Zap className="text-amber-400" size={24} />,
  <Layers3 className="text-violet-400" size={24} />,
  <Code className="text-purple-400" size={24} />,
  <Globe className="text-cyan-400" size={24} />,
];

const AboutView: React.FC = () => {
  useSEO({
    fullTitle: 'About ZEROHUE | Crypto Trading Simulator',
    description: aboutPage.description,
  });

  return (
    <div className="space-y-6 md:space-y-8 pb-6">
      <header className="flex flex-col gap-2 mb-8 md:mb-12 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 md:p-3.5 rounded-2xl text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <Info size={24} className="md:w-7 md:h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
              {aboutPage.heading}
            </h1>
            <p className="text-slate-500 text-[11px] md:text-sm font-medium">
              {aboutPage.subheading}
            </p>
          </div>
        </div>
      </header>

      <div className="w-full max-w-4xl mx-auto space-y-8 md:space-y-12">
        {/* Intro Section */}
        <section className="glass rounded-[24px] md:rounded-[32px] p-6 md:p-12 relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none" />
          <div className="relative z-10 space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">
              {aboutPage.introTitle}
            </h2>
            {aboutPage.introParagraphs.map((paragraph, index) => (
              <p
                key={paragraph}
                className={
                  index === 0
                    ? 'text-slate-300 leading-relaxed text-base md:text-lg'
                    : 'text-slate-400 leading-relaxed text-sm md:text-base'
                }
              >
                <SupportRichText
                  text={paragraph}
                  linkClassName="font-medium text-blue-300 underline decoration-blue-500/40 underline-offset-4 hover:text-blue-200"
                />
              </p>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="space-y-6">
          <h2 className="text-lg md:text-xl font-bold text-white px-2 uppercase tracking-wide">
            Core Capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {aboutFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-slate-900/40 border border-white/5 rounded-[20px] md:rounded-[24px] p-5 md:p-6 hover:bg-slate-800/50 hover:border-white/10 transition-all duration-300 group"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-800/80 flex items-center justify-center mb-5 md:mb-6 group-hover:scale-110 transition-transform duration-500">
                  {React.cloneElement(
                    featureIcons[index] as React.ReactElement<{ size?: number }>,
                    {
                      size: 20,
                    }
                  )}
                </div>
                <h3 className="text-white font-bold mb-2 md:mb-3 text-sm md:text-base">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-[13px] md:text-sm leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer / Notice */}
        <section className="bg-amber-500/10 border border-amber-500/20 rounded-[20px] md:rounded-[24px] p-5 md:p-8 flex items-start gap-4">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 mt-1 flex-shrink-0">
            <Zap size={18} className="md:w-5 md:h-5" />
          </div>
          <div>
            <h3 className="text-amber-400 font-bold mb-1 md:mb-2 text-sm md:text-base uppercase tracking-tight">
              Simulation Only
            </h3>
            <p className="text-amber-400/80 text-[13px] md:text-sm leading-relaxed">
              {aboutPage.simulationNotice}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutView;
