import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import LegalView from '../components/views/LegalView';

vi.mock('../components/common/ZeroHueLogo', () => ({
  default: () => <div>Logo</div>,
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          ...props
        }: {
          children?: React.ReactNode;
          initial?: unknown;
          animate?: unknown;
          transition?: unknown;
        }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

describe('Legal SEO metadata', () => {
  beforeEach(() => {
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

  it('sets legal-specific seo metadata and canonical urls for privacy pages', () => {
    render(
      <MemoryRouter initialEntries={['/legal/privacy']}>
        <Routes>
          <Route path="/legal/:type" element={<LegalView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(document.title).toContain('Privacy Policy');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      expect.stringMatching(/privacy policy/i)
    );
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://zerohue.org/legal/privacy'
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://zerohue.org/legal/privacy'
    );
  });
});
