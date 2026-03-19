import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

vi.mock('../components/modals/DisclaimerModal', () => ({
  default: () => <div>Disclaimer Modal</div>,
}));

vi.mock('../components/views/IntroView', () => ({
  default: () => <div>Intro View</div>,
}));

vi.mock('../components/views/LegalView', () => ({
  default: () => <div>Legal View</div>,
}));

vi.mock('../components/views/MarketView', () => ({
  default: () => <div>Market View</div>,
}));

vi.mock('../components/views/PortfolioView', () => ({
  default: () => <div>Portfolio View</div>,
}));

vi.mock('../components/views/OrdersView', () => ({
  default: () => <div>Orders View</div>,
}));

vi.mock('../components/views/AnalysisView', () => ({
  default: () => <div>Analysis View</div>,
}));

vi.mock('../components/views/FAQView', () => ({
  default: () => <div>FAQ View</div>,
}));

vi.mock('../components/views/AboutView', () => ({
  default: () => <div>About View</div>,
}));

vi.mock('../components/views/LearnHubView', () => ({
  default: () => <div>Learn Hub View</div>,
}));

vi.mock('../components/views/LearnArticleView', () => ({
  default: () => <div>Learn Article View</div>,
}));

vi.mock('../components/views/GlossaryHubView', () => ({
  default: () => <div>Glossary Hub View</div>,
}));

vi.mock('../components/views/GlossaryEntryView', () => ({
  default: () => <div>Glossary Entry View</div>,
}));

vi.mock('../components/views/NotFoundView', () => ({
  default: () => <div>Not Found View</div>,
}));

vi.mock('../components/layout/PublicContentLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/layout/TerminalShell', () => ({
  default: () => <div>Terminal Shell</div>,
}));

vi.mock('../utils/safeStorage', () => {
  const store = new Map<string, string>();

  return {
    safeStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
});

describe('App routing', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
    window.history.pushState({}, '', '/');
  });

  it('does not block the intro route with the disclaimer modal', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(await screen.findByText('Intro View')).toBeInTheDocument();
    expect(screen.queryByText('Disclaimer Modal')).not.toBeInTheDocument();
  });

  it('does not block legal routes with the disclaimer modal', async () => {
    window.history.pushState({}, '', '/legal/privacy');
    render(<App />);

    expect(await screen.findByText('Legal View')).toBeInTheDocument();
    expect(screen.queryByText('Disclaimer Modal')).not.toBeInTheDocument();
  });

  it('resets window scroll when entering public legal routes', () => {
    window.history.pushState({}, '', '/legal/privacy');
    render(<App />);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('does not block FAQ routes with the disclaimer modal', async () => {
    window.history.pushState({}, '', '/faq');
    render(<App />);

    expect(await screen.findByText('FAQ View')).toBeInTheDocument();
    expect(screen.queryByText('Disclaimer Modal')).not.toBeInTheDocument();
  });

  it('does not block learn hub routes with the disclaimer modal', async () => {
    window.history.pushState({}, '', '/learn');
    render(<App />);
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(await screen.findByText('Learn Hub View')).toBeInTheDocument();
    expect(screen.queryByText('Disclaimer Modal')).not.toBeInTheDocument();
  });

  it('still shows the disclaimer before entering the trading terminal', async () => {
    window.history.pushState({}, '', '/markets');
    render(<App />);
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(await screen.findByText('Terminal Shell')).toBeInTheDocument();
    expect(screen.getByText('Disclaimer Modal')).toBeInTheDocument();
  });

  it('still treats trailing-slash terminal routes as trading routes', async () => {
    window.history.pushState({}, '', '/markets/');
    render(<App />);
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(await screen.findByText('Terminal Shell')).toBeInTheDocument();
    expect(screen.getByText('Disclaimer Modal')).toBeInTheDocument();
  });

  it('routes trade pages through the terminal shell', async () => {
    window.history.pushState({}, '', '/trade/bitcoin');
    render(<App />);
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(await screen.findByText('Terminal Shell')).toBeInTheDocument();
  });
});
