import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BRAND_SUBTITLE, HERO_BRAND_BADGE, HOMEPAGE_TITLE } from '../constants/branding';
import IntroView from '../components/views/IntroView';
import { introPrimaryCtaLabel, introSecondaryCtaLabel } from '../components/views/intro/content';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          whileHover: _whileHover,
          whileInView: _whileInView,
          transition: _transition,
          viewport: _viewport,
          ...props
        }: {
          children?: React.ReactNode;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          whileHover?: unknown;
          whileInView?: unknown;
          transition?: unknown;
          viewport?: unknown;
        }) =>
          React.createElement(tag, props, children),
    }
  ),
  useReducedMotion: () => false,
}));

const renderIntroView = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<IntroView />} />
        <Route path="/markets" element={<div>Markets Route</div>} />
        <Route path="/learn" element={<div>Learn Route</div>} />
        <Route path="/glossary" element={<div>Glossary Route</div>} />
        <Route path="/faq" element={<div>FAQ Route</div>} />
        <Route path="/about" element={<div>About Route</div>} />
        <Route path="/legal/:type" element={<div>Legal Route</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('IntroView', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    document.title = '';
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:url" content="" />
      <meta property="og:description" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
      <link rel="canonical" href="" />
    `;
  });

  it('renders the streamlined hero, workflow, privacy, and footer sections', async () => {
    renderIntroView();

    expect(
      await screen.findByRole('heading', {
        name: /Practice crypto trades before real capital is on the line\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(HERO_BRAND_BADGE)).toBeInTheDocument();
    expect(screen.getByText('Live context')).toBeInTheDocument();
    expect(screen.getByText('Local-first')).toBeInTheDocument();
    expect(screen.getByText('No account')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByText(/^Learn$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Glossary$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^FAQ$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^About$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: introPrimaryCtaLabel }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: introSecondaryCtaLabel })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Get started in 3 steps\./i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Private by default\./i })).toBeInTheDocument();
    expect(screen.getByText(/Simulation only \/ Not financial advice/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getAllByText(BRAND_SUBTITLE).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Three signals that define the product\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Built for focused rehearsal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Practice terminal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local-first crypto simulator/i)).not.toBeInTheDocument();
  }, 15000);

  it('navigates to the simulator when the main cta is clicked', async () => {
    renderIntroView();

    fireEvent.click(screen.getAllByRole('link', { name: introPrimaryCtaLabel })[0]);

    expect(screen.getByText('Markets Route')).toBeInTheDocument();
  });

  it('opens the mobile menu and navigates to content routes before closing it', async () => {
    renderIntroView();

    const toggle = screen.getByRole('button', { name: /Open navigation menu/i });
    fireEvent.click(toggle);

    const menu = screen.getByTestId('intro-mobile-menu');
    const aboutButton = within(menu).getByRole('link', { name: /^About$/i });

    fireEvent.click(aboutButton);

    expect(screen.getByText('About Route')).toBeInTheDocument();
    expect(screen.queryByTestId('intro-mobile-menu')).not.toBeInTheDocument();
  });

  it('sets homepage seo metadata without the old title prefix', () => {
    renderIntroView();

    expect(document.title).toBe(HOMEPAGE_TITLE);
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
      'content',
      HOMEPAGE_TITLE
    );
    expect(document.querySelector('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      HOMEPAGE_TITLE
    );
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://zerohue.org/'
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zerohue.org/'
    );
    expect(document.title).not.toContain('Practice Crypto Trading');
  });
});
