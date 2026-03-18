import React from 'react';
import ContentHub from './content/ContentHub';
import { glossaryEntries, glossaryHub } from '../../content/publicContent';

const GlossaryHubView: React.FC = () => {
  return (
    <ContentHub
      fullTitle="Crypto Trading Glossary | ZEROHUE"
      description={glossaryHub.description}
      eyebrow="Glossary"
      heading={glossaryHub.heading}
      summary={glossaryHub.summary}
      items={glossaryEntries}
      basePath="/glossary"
    />
  );
};

export default GlossaryHubView;
