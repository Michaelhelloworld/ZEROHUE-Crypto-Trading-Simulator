import React from 'react';
import { useParams } from 'react-router';
import ContentArticle from './content/ContentArticle';
import PublicContentNotFound from './content/PublicContentNotFound';
import { getGlossaryEntry } from '../../content/publicContent';

const GlossaryEntryView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const entry = getGlossaryEntry(slug);

  if (!entry) {
    return <PublicContentNotFound />;
  }

  return (
    <ContentArticle
      fullTitle={entry.fullTitle}
      description={entry.description}
      h1={entry.h1}
      summary={entry.summary}
      sections={entry.sections}
      relatedLinks={entry.relatedLinks}
      showTableOfContents={false}
      showOutlineLink={false}
      bottomCtaTitle="See the term in a practice flow."
      bottomCtaDescription="Open ZEROHUE to watch the market, place a paper order, and review how the concept shows up in execution."
      breadcrumbItems={[
        { name: 'Home', path: '/' },
        { name: 'Glossary', path: '/glossary' },
        { name: entry.term, path: `/glossary/${entry.slug}` },
      ]}
      eyebrow="Glossary"
    />
  );
};

export default GlossaryEntryView;
