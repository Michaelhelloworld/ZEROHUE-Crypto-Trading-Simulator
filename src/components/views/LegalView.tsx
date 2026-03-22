import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Lock, FileText, ShieldAlert, X } from 'lucide-react';
import ZeroHueLogo from '../common/ZeroHueLogo';
import { COPYRIGHT_YEAR } from '../../constants/branding';
import { useSEO } from '../../hooks/useSEO';
import { getLegalDocument } from '../../content/publicContent';
import SupportEmailLink from '../common/SupportEmailLink';
import SupportRichText from '../common/SupportRichText';

const documentStyling = {
  privacy: {
    icon: Lock,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  terms: {
    icon: FileText,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  disclaimer: {
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
} as const;

const LegalView: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();

  const legalContent = getLegalDocument(type);
  const styling = type ? documentStyling[type as keyof typeof documentStyling] : undefined;
  const seoTitle = legalContent?.title ?? 'Legal';
  const seoDescription = legalContent
    ? legalContent.description
    : 'The requested ZEROHUE legal document could not be found.';

  useSEO({
    fullTitle: legalContent ? `${seoTitle} | ZEROHUE` : 'Legal | ZEROHUE',
    description: seoDescription,
  });

  if (!legalContent) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#020617] text-white">
        <h1 className="text-2xl font-bold text-slate-300">Document Not Found</h1>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!styling) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#020617] text-white">
        <h1 className="text-2xl font-bold text-slate-300">Document Not Found</h1>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { title, sections, updatedLabel } = legalContent;
  const { icon: Icon, color, bg, border } = styling;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#020617] font-sans text-slate-100 selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      <header className="sticky top-0 relative z-10 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 pb-4 pt-safe pl-safe pr-safe sm:px-6 md:px-12">
          <button
            type="button"
            className="flex items-center gap-3"
            onClick={() => navigate('/')}
            aria-label="Go to homepage"
          >
            <ZeroHueLogo />
            <span className="font-black tracking-[0.2em] text-white text-sm">ZEROHUE</span>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest">Back</span>
            <div className="rounded-full border border-white/5 bg-slate-800/50 p-2 transition-colors group-hover:bg-slate-800">
              <X size={16} />
            </div>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex-1 w-full max-w-3xl px-4 py-12 sm:px-6 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="mb-12 flex flex-col items-center text-center md:mb-16">
            <div
              className={`w-16 h-16 rounded-3xl ${bg} flex items-center justify-center mb-8 border ${border} shadow-2xl`}
            >
              <Icon size={32} className={color} />
            </div>
            <h1 className="mb-6 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-6xl">
              {title}
            </h1>
            <p className="font-mono text-xs text-slate-500 tracking-widest uppercase">
              {updatedLabel}
            </p>
          </div>

          <article className="space-y-6 sm:space-y-8 md:space-y-12">
            {sections.map((item, index) => (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                key={item.title}
                className="rounded-3xl border border-white/5 bg-slate-900/35 p-5 sm:p-6 md:p-8"
              >
                <h2 className={`text-xl font-bold mb-4 tracking-wide ${color}`}>{item.title}</h2>
                <div className="text-slate-400 leading-loose text-[15px] md:text-base font-light space-y-4">
                  <p>
                    <SupportRichText
                      text={item.desc}
                      linkClassName="font-medium text-blue-300 underline decoration-blue-500/40 underline-offset-4 hover:text-blue-200"
                    />
                  </p>
                </div>
              </motion.section>
            ))}
          </article>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-4 py-12 pb-safe text-center sm:px-6">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-4">
          &copy; {COPYRIGHT_YEAR} ZEROHUE. Strictly an educational simulation.
        </p>
        <SupportEmailLink
          label="Contact Support"
          className="text-[10px] font-mono text-blue-500/60 hover:text-blue-400 uppercase tracking-[0.2em] transition-colors"
        />
      </footer>
    </div>
  );
};

export default LegalView;
