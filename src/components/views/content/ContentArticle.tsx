import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useSEO } from '../../../hooks/useSEO';
import { buildBreadcrumbStructuredData } from '../../../utils/seo';

interface ContentSection {
  id: string;
  title: string;
  paragraphs: string[];
}

interface ContentLink {
  label: string;
  path: string;
}

interface ContentArticleProps {
  fullTitle: string;
  description: string;
  h1: string;
  summary: string;
  sections: ContentSection[];
  relatedLinks: ContentLink[];
  breadcrumbItems: Array<{ name: string; path: string }>;
  eyebrow: string;
  showTableOfContents?: boolean;
  showOutlineLink?: boolean;
  bottomCtaTitle?: string;
  bottomCtaDescription?: string;
}

const ContentArticle: React.FC<ContentArticleProps> = ({
  fullTitle,
  description,
  h1,
  summary,
  sections,
  relatedLinks,
  breadcrumbItems,
  eyebrow,
  showTableOfContents = true,
  showOutlineLink = true,
  bottomCtaTitle = 'Try it in the simulator.',
  bottomCtaDescription = 'Use ZEROHUE to observe live context, place the order type that fits the setup, and review the outcome without funding an exchange account.',
}) => {
  useSEO({
    fullTitle,
    description,
    structuredData: buildBreadcrumbStructuredData(breadcrumbItems),
  });

  const hasTableOfContents = showTableOfContents && sections.length > 1;

  return (
    <article className="mx-auto max-w-4xl">
      <div className="rounded-[2rem] border border-white/8 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-8 lg:p-10">
        <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.28em] text-blue-200">
          {eyebrow}
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">{h1}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{summary}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/markets"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
          >
            Open Simulator
            <ArrowRight size={16} />
          </Link>
          {showOutlineLink && hasTableOfContents && (
            <a
              href="#content-toc"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/[0.08]"
            >
              Jump to Outline
            </a>
          )}
        </div>
      </div>

      <div
        className={`mt-8 grid gap-8 ${hasTableOfContents ? 'lg:grid-cols-[16rem_minmax(0,1fr)]' : ''}`}
      >
        {hasTableOfContents && (
          <aside
            id="content-toc"
            className="h-fit rounded-[1.75rem] border border-white/8 bg-slate-950/55 p-5 lg:sticky lg:top-28"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500">
              Table of contents
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-sm leading-6 text-slate-300 transition-colors hover:text-white"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </aside>
        )}

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="rounded-[1.75rem] border border-white/8 bg-slate-950/55 p-6 sm:p-7"
            >
              <h2 className="text-2xl font-bold tracking-tight text-white">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-[1.75rem] border border-white/8 bg-slate-950/55 p-6 sm:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500">
              Related reading
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedLinks.map((link) => (
                <Link
                  key={`${link.path}-${link.label}`}
                  to={link.path}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-blue-400/15 bg-blue-500/[0.06] p-6 sm:p-7">
            <h2 className="text-2xl font-bold tracking-tight text-white">{bottomCtaTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {bottomCtaDescription}
            </p>
            <Link
              to="/markets"
              className="mt-6 inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition-transform hover:scale-[1.02]"
            >
              Open Simulator
              <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </div>
    </article>
  );
};

export default ContentArticle;
