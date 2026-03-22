import {
  SUPPORT_CONTACT_TOKEN as supportContactTokenData,
  aboutFeatures as aboutFeaturesData,
  aboutPage as aboutPageData,
  faqItems as faqItemsData,
  faqPage as faqPageData,
  legalDocuments as legalDocumentsData,
} from './publicPages.data.js';
import {
  glossaryEntries as glossaryEntriesData,
  glossaryHub as glossaryHubData,
  learnHub as learnHubData,
  tutorialArticles as tutorialArticlesData,
} from './learning.data.js';

export interface ContentLink {
  label: string;
  path: string;
}

export interface ContentSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface TutorialArticle {
  slug: string;
  title: string;
  fullTitle: string;
  description: string;
  h1: string;
  summary: string;
  primaryKeyword: string;
  sections: ContentSection[];
  relatedLinks: ContentLink[];
}

export interface GlossaryEntry {
  slug: string;
  term: string;
  fullTitle: string;
  description: string;
  h1: string;
  summary: string;
  primaryKeyword: string;
  sections: ContentSection[];
  relatedLinks: ContentLink[];
}

export interface HubPage {
  seoTitle: string;
  description: string;
  heading: string;
  summary: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface AboutFeature {
  title: string;
  description: string;
  accent: string;
}

export interface AboutPage {
  seoTitle: string;
  description: string;
  heading: string;
  subheading: string;
  introTitle: string;
  introParagraphs: string[];
  simulationNotice: string;
}

export interface FAQPage {
  seoTitle: string;
  description: string;
  heading: string;
  subheading: string;
}

export interface LegalSection {
  title: string;
  desc: string;
}

export interface LegalDocument {
  title: string;
  description: string;
  updatedLabel: string;
  sections: LegalSection[];
}

export const learnHub = learnHubData as HubPage;
export const glossaryHub = glossaryHubData as HubPage;

export const tutorialArticles = tutorialArticlesData as TutorialArticle[];
export const glossaryEntries = glossaryEntriesData as GlossaryEntry[];
export const faqItems = faqItemsData as FAQItem[];
export const faqPage = faqPageData as FAQPage;
export const aboutPage = aboutPageData as AboutPage;
export const aboutFeatures = aboutFeaturesData as AboutFeature[];
export const legalDocuments = legalDocumentsData as Record<string, LegalDocument>;
export const SUPPORT_CONTACT_TOKEN = supportContactTokenData as string;

export const getTutorialArticle = (slug?: string) =>
  tutorialArticles.find((article) => article.slug === slug);

export const getGlossaryEntry = (slug?: string) =>
  glossaryEntries.find((entry) => entry.slug === slug);

export const getLegalDocument = (key?: string) => (key ? legalDocuments[key] : undefined);
