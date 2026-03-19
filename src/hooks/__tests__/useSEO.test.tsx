import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { useSEO } from '../useSEO';

const SEOHarness: React.FC<{
  title?: string;
  fullTitle?: string;
  description: string;
  robots?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}> = ({ title, fullTitle, description, robots, structuredData }) => {
  useSEO({ title, fullTitle, description, robots, structuredData });
  return <div>SEO Harness</div>;
};

describe('useSEO', () => {
  beforeEach(() => {
    document.title = '';
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta name="robots" content="" />
      <meta property="og:title" content="" />
      <meta property="og:url" content="" />
      <meta property="og:description" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
      <link rel="canonical" href="" />
    `;
  });

  it('uses index,follow by default for public pages', () => {
    render(
      <MemoryRouter initialEntries={['/learn']}>
        <SEOHarness fullTitle="Learn Crypto Paper Trading | ZEROHUE" description="Learn page." />
      </MemoryRouter>
    );

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index,follow'
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zerohue.org/learn'
    );
  });

  it('supports noindex,follow for terminal pages', () => {
    render(
      <MemoryRouter initialEntries={['/markets']}>
        <SEOHarness title="Markets" description="Terminal route." robots="noindex,follow" />
      </MemoryRouter>
    );

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,follow'
    );
  });

  it('strips query parameters from canonical urls', () => {
    render(
      <MemoryRouter initialEntries={['/learn?utm_source=launch&ref=campaign']}>
        <SEOHarness fullTitle="Learn Crypto Paper Trading | ZEROHUE" description="Learn page." />
      </MemoryRouter>
    );

    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://zerohue.org/learn'
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zerohue.org/learn'
    );
  });

  it('injects route-scoped structured data when provided', () => {
    render(
      <MemoryRouter initialEntries={['/glossary/paper-trading']}>
        <SEOHarness
          fullTitle="Paper Trading Meaning for Crypto Trading | ZEROHUE"
          description="Glossary entry."
          structuredData={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [],
          }}
        />
      </MemoryRouter>
    );

    const script = document.querySelector('script[data-seo-structured-data="route"]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('BreadcrumbList');
  });
});
