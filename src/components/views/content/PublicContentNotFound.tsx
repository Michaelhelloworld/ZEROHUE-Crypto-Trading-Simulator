import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router';
import { useSEO } from '../../../hooks/useSEO';

const PublicContentNotFound: React.FC = () => {
  useSEO({
    fullTitle: 'Page Not Found | ZEROHUE',
    description: 'The requested ZEROHUE page could not be found.',
    robots: 'noindex,follow',
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/8 bg-slate-950/55 p-8 text-center sm:p-10">
      <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500">404</div>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Page not found</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
        The page you requested is not available. Use the links below to return to the homepage or
        continue into the simulator.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
        >
          <Home size={16} />
          Home
        </Link>
        <Link
          to="/markets"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
        >
          <ArrowLeft size={16} />
          Open Simulator
        </Link>
      </div>
    </div>
  );
};

export default PublicContentNotFound;
