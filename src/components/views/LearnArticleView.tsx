import React from 'react';
import { useParams } from 'react-router';
import ContentArticle from './content/ContentArticle';
import PublicContentNotFound from './content/PublicContentNotFound';
import { getTutorialArticle } from '../../content/publicContent';

const LearnArticleView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = getTutorialArticle(slug);

  if (!article) {
    return <PublicContentNotFound />;
  }

  return (
    <ContentArticle
      fullTitle={article.fullTitle}
      description={article.description}
      h1={article.h1}
      summary={article.summary}
      sections={article.sections}
      relatedLinks={article.relatedLinks}
      breadcrumbItems={[
        { name: 'Home', path: '/' },
        { name: 'Learn', path: '/learn' },
        { name: article.title, path: `/learn/${article.slug}` },
      ]}
      eyebrow="Learn"
    />
  );
};

export default LearnArticleView;
