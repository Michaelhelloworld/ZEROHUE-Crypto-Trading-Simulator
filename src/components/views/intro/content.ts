import type { LucideIcon } from 'lucide-react';
import { Database, Eye, Layers, Lock, Shield, Terminal } from 'lucide-react';

export interface IntroNavItem {
  label: string;
  path: string;
}

export interface WorkflowStep {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

export interface FooterLink {
  label: string;
  href?: string;
  path?: string;
}

export interface PrivacySignal {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const introNavItems: IntroNavItem[] = [
  { label: 'Learn', path: '/learn' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'FAQ', path: '/faq' },
  { label: 'About', path: '/about' },
];

export const introPrimaryCtaLabel = 'Open Simulator';
export const introSecondaryCtaLabel = 'Explore Workflow';

export const heroTrustPills = ['Live context', 'Local-first', 'No account'];

export const workflowSteps: WorkflowStep[] = [
  {
    step: '01',
    icon: Eye,
    title: 'Observe',
    description: 'Watch price, structure, and momentum before you enter.',
    accent: 'Read first',
  },
  {
    step: '02',
    icon: Terminal,
    title: 'Simulate',
    description: 'Place market or limit orders and set risk without real capital.',
    accent: 'Execute cleanly',
  },
  {
    step: '03',
    icon: Layers,
    title: 'Review',
    description: 'Check PnL, orders, and history to tighten the next trade.',
    accent: 'Close the loop',
  },
];

export const privacySignals: PrivacySignal[] = [
  {
    icon: Database,
    title: 'Stored locally',
    description: 'Orders, history, and settings stay in your browser.',
  },
  {
    icon: Shield,
    title: 'No account wall',
    description: 'Open the simulator without email, KYC, or API keys.',
  },
  {
    icon: Lock,
    title: 'Simulation only',
    description: 'Live market context, paper execution, and no real funds at risk.',
  },
];

export const socialLinks: FooterLink[] = [
  { label: 'Discord', href: 'https://discord.gg/N48aHv9xjW' },
  { label: 'X (Twitter)', href: 'https://x.com/zerohue_org' },
];

export const resourceLinks: FooterLink[] = [
  { label: 'Learn', path: '/learn' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'FAQ', path: '/faq' },
  { label: 'About', path: '/about' },
];

export const legalLinks: FooterLink[] = [
  { label: 'Privacy Policy', path: '/legal/privacy' },
  { label: 'Terms of Use', path: '/legal/terms' },
  { label: 'Risk Disclaimer', path: '/legal/disclaimer' },
];

export const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (!element) {
    return;
  }

  const offset = 88;
  const bodyRect = document.body.getBoundingClientRect().top;
  const elementRect = element.getBoundingClientRect().top;
  const elementPosition = elementRect - bodyRect;

  window.scrollTo({
    top: elementPosition - offset,
    behavior: 'smooth',
  });
};
