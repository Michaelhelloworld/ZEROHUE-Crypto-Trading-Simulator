import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import GlossaryEntryView from '../components/views/GlossaryEntryView';
import LearnArticleView from '../components/views/LearnArticleView';

describe('public content pages', () => {
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

  it('renders a learn article with outline and simulator ctas', () => {
    render(
      <MemoryRouter initialEntries={['/learn/crypto-paper-trading']}>
        <Routes>
          <Route path="/learn/:slug" element={<LearnArticleView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        name: /Crypto paper trading: what it is and how to use it well\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Table of contents/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Open Simulator/i }).length).toBeGreaterThan(0);
    expect(document.title).toBe('Crypto Paper Trading | ZEROHUE');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index,follow'
    );
  });

  it('renders a glossary entry with a unique title and canonical url', () => {
    render(
      <MemoryRouter initialEntries={['/glossary/market-order']}>
        <Routes>
          <Route path="/glossary/:slug" element={<GlossaryEntryView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Market order meaning in crypto\./i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Table of contents/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Jump to Outline/i })).not.toBeInTheDocument();
    expect(document.title).toBe('Market Order Meaning for Crypto Trading | ZEROHUE');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zerohue.org/glossary/market-order'
    );
  });
});
