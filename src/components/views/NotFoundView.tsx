import React from 'react';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useSEO } from '../../hooks/useSEO';

const NotFoundView: React.FC = () => {
  const navigate = useNavigate();

  useSEO({
    fullTitle: 'Page Not Found | ZEROHUE',
    description: 'The requested ZEROHUE page could not be found.',
    robots: 'noindex,follow',
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <div className="max-w-md w-full glass rounded-3xl p-10 border border-white/10 shadow-2xl relative overflow-hidden group">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-lg group-hover:scale-110 transition-transform duration-500">
            <FileQuestion
              size={48}
              className="text-slate-400 group-hover:text-blue-400 transition-colors duration-300"
            />
          </div>

          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-2">
            404
          </h1>
          <h2 className="text-xl font-bold text-white mb-4">Page Not Found</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            This page doesn&apos;t exist or may have moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/5 transition-all flex items-center justify-center gap-2 group/btn"
            >
              <ArrowLeft
                size={18}
                className="group-hover/btn:-translate-x-1 transition-transform"
              />
              Go Back
            </button>
            <Link
              to="/"
              className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Home size={18} />
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundView;
