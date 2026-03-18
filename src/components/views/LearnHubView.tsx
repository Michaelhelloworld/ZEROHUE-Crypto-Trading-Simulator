import React from 'react';
import ContentHub from './content/ContentHub';
import { learnHub, tutorialArticles } from '../../content/publicContent';

const LearnHubView: React.FC = () => {
  return (
    <ContentHub
      fullTitle="Learn Crypto Paper Trading | ZEROHUE"
      description={learnHub.description}
      eyebrow="Learn"
      heading={learnHub.heading}
      summary={learnHub.summary}
      items={tutorialArticles}
      basePath="/learn"
    />
  );
};

export default LearnHubView;
