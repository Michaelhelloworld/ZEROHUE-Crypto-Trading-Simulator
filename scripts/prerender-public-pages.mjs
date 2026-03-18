import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aboutPage, faqPage, legalDocuments } from '../src/content/publicPages.data.js';
import {
  glossaryEntries,
  glossaryHub,
  learnHub,
  tutorialArticles,
} from '../src/content/learning.data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

const SITE_URL = 'https://zerohue.org';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const BRAND_NAME = 'ZEROHUE';
const BRAND_ALT_NAME = 'ZEROHUE Crypto Trading Simulator';

const createUrl = (routePath) => new URL(routePath, `${SITE_URL}/`).toString();

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const replaceMeta = (html, selector, content) => {
  const escapedContent = escapeHtml(content);
  const pattern = new RegExp(
    `(<meta[^>]*${selector}[^>]*content=")([^"]*)("(?:(?!>).)*\\/?>)`,
    'is'
  );
  return html.replace(pattern, `$1${escapedContent}$3`);
};

const replaceCanonical = (html, href) =>
  html.replace(/(<link rel="canonical" href=")([^"]*)(" ?\/>)/i, `$1${escapeHtml(href)}$3`);

const replaceTitle = (html, title) =>
  html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const replaceStructuredData = (html, structuredData) => {
  const script = `\n    <script type="application/ld+json" data-prerender-structured-data>${JSON.stringify(
    structuredData
  )}</script>`;

  return html.replace('</head>', `${script}\n  </head>`);
};

const replaceRoot = (html, content) =>
  html.replace(/<div id="root"><\/div>/i, `<div id="root">${content}</div>`);

const homeStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ZEROHUE',
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
    logo: DEFAULT_IMAGE,
    sameAs: ['https://x.com/zerohue_org', 'https://discord.gg/N48aHv9xjW'],
  },
];

const buildBreadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: createUrl(item.path),
  })),
});

const pages = [
  {
    routePath: '/',
    title: 'ZEROHUE | Crypto Trading Simulator',
    description:
      'ZEROHUE is a local-first crypto trading simulator with live market context, paper execution, and no account required.',
    robots: 'index,follow',
    prerenderBody: true,
    structuredData: homeStructuredData,
  },
  {
    routePath: '/faq',
    title: 'Crypto Trading FAQ | ZEROHUE',
    description: faqPage.description,
    robots: 'index,follow',
    prerenderBody: true,
  },
  {
    routePath: '/about',
    title: 'About ZEROHUE | Crypto Trading Simulator',
    description: aboutPage.description,
    robots: 'index,follow',
    prerenderBody: true,
  },
  {
    routePath: '/learn',
    title: 'Learn Crypto Paper Trading | ZEROHUE',
    description: learnHub.description,
    robots: 'index,follow',
    prerenderBody: true,
  },
  {
    routePath: '/glossary',
    title: 'Crypto Trading Glossary | ZEROHUE',
    description: glossaryHub.description,
    robots: 'index,follow',
    prerenderBody: true,
  },
  ...tutorialArticles.map((article) => ({
    routePath: `/learn/${article.slug}`,
    title: article.fullTitle,
    description: article.description,
    robots: 'index,follow',
    prerenderBody: true,
    structuredData: buildBreadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Learn', path: '/learn' },
      { name: article.title, path: `/learn/${article.slug}` },
    ]),
  })),
  ...glossaryEntries.map((entry) => ({
    routePath: `/glossary/${entry.slug}`,
    title: entry.fullTitle,
    description: entry.description,
    robots: 'index,follow',
    prerenderBody: true,
    structuredData: buildBreadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Glossary', path: '/glossary' },
      { name: entry.term, path: `/glossary/${entry.slug}` },
    ]),
  })),
  ...Object.entries(legalDocuments).map(([key, document]) => ({
    routePath: `/legal/${key}`,
    title: `${document.title} | ZEROHUE`,
    description: document.description,
    robots: 'index,follow',
    prerenderBody: true,
  })),
  {
    routePath: '/markets',
    title: 'Markets | ZEROHUE',
    description: 'ZEROHUE simulator market route.',
    robots: 'noindex,follow',
  },
  {
    routePath: '/portfolio',
    title: 'Portfolio | ZEROHUE',
    description: 'ZEROHUE simulator portfolio route.',
    robots: 'noindex,follow',
  },
  {
    routePath: '/orders',
    title: 'Orders | ZEROHUE',
    description: 'ZEROHUE simulator orders route.',
    robots: 'noindex,follow',
  },
  {
    routePath: '/history',
    title: 'History & Analysis | ZEROHUE',
    description: 'ZEROHUE simulator analysis route.',
    robots: 'noindex,follow',
  },
];

const writePage = async (template, page, renderRoute) => {
  let html = template;
  const canonicalUrl = createUrl(page.routePath === '/404' ? '/404' : page.routePath);
  html = replaceTitle(html, page.title);
  html = replaceMeta(html, 'name="description"', page.description);
  html = replaceMeta(html, 'name="robots"', page.robots);
  html = replaceMeta(html, 'property="og:url"', canonicalUrl);
  html = replaceCanonical(html, canonicalUrl);
  html = replaceMeta(html, 'property="og:title"', page.title);
  html = replaceMeta(html, 'property="og:description"', page.description);
  html = replaceMeta(html, 'property="og:image"', DEFAULT_IMAGE);
  html = replaceMeta(html, 'name="twitter:title"', page.title);
  html = replaceMeta(html, 'name="twitter:description"', page.description);
  html = replaceMeta(html, 'name="twitter:image"', DEFAULT_IMAGE);
  if (page.prerenderBody) {
    html = replaceRoot(html, renderRoute(page.routePath));
  }
  if (page.structuredData) {
    html = replaceStructuredData(html, page.structuredData);
  }

  const outputPath =
    page.routePath === '/'
      ? path.join(distDir, 'index.html')
      : page.routePath === '/404'
        ? path.join(distDir, '404.html')
        : path.join(distDir, page.routePath.slice(1), 'index.html');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');
};

const run = async () => {
  const template = await readFile(indexHtmlPath, 'utf8');
  const vite = await createServer({
    logLevel: 'error',
    appType: 'custom',
    server: {
      middlewareMode: true,
    },
    ssr: {
      noExternal: ['react-router', 'react-router-dom'],
    },
  });

  try {
    const { renderPublicRoute } = await vite.ssrLoadModule('/src/prerender/renderPublicRoute.tsx');

    for (const page of pages) {
      await writePage(template, page, renderPublicRoute);
    }

    await writePage(
      template,
      {
        routePath: '/404',
        title: 'Page Not Found | ZEROHUE',
        description: 'The requested ZEROHUE page could not be found.',
        robots: 'noindex,follow',
        prerenderBody: true,
      },
      renderPublicRoute
    );
  } finally {
    await vite.close();
  }
};

run().catch((error) => {
  console.error('Failed to prerender public pages.');
  console.error(error);
  process.exitCode = 1;
});
