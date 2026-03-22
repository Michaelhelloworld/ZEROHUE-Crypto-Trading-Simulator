import { BRAND_ALT_NAME, BRAND_NAME, SITE_URL } from '../constants/branding';

interface BreadcrumbItem {
  name: string;
  path: string;
}

export const buildHomepageStructuredData = () => [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND_NAME,
    operatingSystem: 'Web',
    applicationCategory: 'FinanceApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'ZEROHUE is a local-first crypto trading simulator with live market context, paper execution, and no account required.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    alternateName: BRAND_ALT_NAME,
    url: SITE_URL,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      url: `${SITE_URL}/faq`,
      contactType: 'customer support',
    },
    sameAs: ['https://x.com/zerohue_org', 'https://discord.gg/N48aHv9xjW'],
  },
];

export const buildBreadcrumbStructuredData = (items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: new URL(item.path, `${SITE_URL}/`).toString(),
  })),
});
