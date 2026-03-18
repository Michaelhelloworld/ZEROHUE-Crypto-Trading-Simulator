import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useSEO } from '../../../hooks/useSEO';

interface HubCardItem {
  slug: string;
  title?: string;
  term?: string;
  summary: string;
}

interface ContentHubProps {
  fullTitle: string;
  description: string;
  eyebrow: string;
  heading: string;
  summary: string;
  items: HubCardItem[];
  basePath: '/learn' | '/glossary';
}

const ContentHub: React.FC<ContentHubProps> = ({
  fullTitle,
  description,
  eyebrow,
  heading,
  summary,
  items,
  basePath,
}) => {
  useSEO({
    fullTitle,
    description,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-[2rem] border border-white/8 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-8 lg:p-10">
        <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.28em] text-blue-200">
          {eyebrow}
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
          {heading}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{summary}</p>
        <Link
          to="/markets"
          className="mt-8 inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
        >
          Open Simulator
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.slug}
            to={`${basePath}/${item.slug}`}
            className="rounded-[1.75rem] border border-white/8 bg-slate-950/55 p-6 transition-colors hover:bg-slate-900/70"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500">
              {basePath === '/learn' ? 'Guide' : 'Glossary'}
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
              {item.title ?? item.term}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.summary}</p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
              {basePath === '/learn' ? 'Open guide' : 'Open term'}
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
};

export default ContentHub;
