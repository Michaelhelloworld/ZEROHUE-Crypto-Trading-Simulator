import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { HOMEPAGE_TITLE, SITE_URL } from '../constants/branding';

interface SEOProps {
  title?: string;
  fullTitle?: string;
  description: string;
  robots?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const ensureMetaTag = (selector: string, attribute: 'name' | 'property', value: string) => {
  let tag = document.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }

  return tag;
};

const ensureCanonicalLink = () => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  return link;
};

const ensureStructuredDataScript = () => {
  let script = document.querySelector<HTMLScriptElement>(
    'script[data-prerender-structured-data], script[data-seo-structured-data="route"]'
  );
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    document.head.appendChild(script);
  }

  script.removeAttribute('data-prerender-structured-data');
  script.setAttribute('data-seo-structured-data', 'route');

  return script;
};

export const useSEO = ({
  title,
  fullTitle,
  description,
  robots = 'index,follow',
  structuredData,
}: SEOProps) => {
  const location = useLocation();

  useEffect(() => {
    const baseTitle = HOMEPAGE_TITLE;
    const newTitle = fullTitle ?? (title ? `${title} | ${baseTitle}` : baseTitle);
    const canonicalUrl = new URL(
      `${location.pathname}${location.search}`,
      `${SITE_URL}/`
    ).toString();

    document.title = newTitle;

    ensureMetaTag('meta[property="og:title"]', 'property', 'og:title').setAttribute(
      'content',
      newTitle
    );
    ensureMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title').setAttribute(
      'content',
      newTitle
    );
    ensureMetaTag('meta[name="description"]', 'name', 'description').setAttribute(
      'content',
      description
    );
    ensureMetaTag('meta[property="og:description"]', 'property', 'og:description').setAttribute(
      'content',
      description
    );
    ensureMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description').setAttribute(
      'content',
      description
    );
    ensureMetaTag('meta[name="robots"]', 'name', 'robots').setAttribute('content', robots);
    ensureMetaTag('meta[property="og:url"]', 'property', 'og:url').setAttribute(
      'content',
      canonicalUrl
    );
    ensureCanonicalLink().setAttribute('href', canonicalUrl);

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-prerender-structured-data], script[data-seo-structured-data="route"]'
    );

    if (structuredData) {
      ensureStructuredDataScript().textContent = JSON.stringify(structuredData);
    } else if (existingScript) {
      existingScript.remove();
    }
  }, [title, fullTitle, description, robots, structuredData, location.pathname, location.search]);
};
