import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MarketView from '../MarketView';
import { Coin } from '../../../types';
import * as useStoreModule from '../../../store/useStore';

const mockNavigate = vi.fn();

vi.mock('../../../hooks/useSEO', () => ({
  useSEO: vi.fn(),
}));

vi.mock('../../CryptoIcon', () => ({
  default: ({ symbol }: { symbol: string }) => <div>{symbol}</div>,
}));

vi.mock('../../common/PriceDisplay', () => ({
  default: ({ price }: { price: number }) => <span>${price.toFixed(2)}</span>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => <path />,
  YAxis: () => null,
}));

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
          transition: _transition,
          ...props
        }: {
          children?: React.ReactNode;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          transition?: unknown;
        }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 65000,
  change24h: 2.5,
  history: [64000, 65000],
  category: 'L1/L2',
  ...overrides,
});

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('MarketView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(useStoreModule, 'useStore').mockImplementation((selector?: unknown) => {
      const mockState = {
        coins: [createCoin(), createCoin({ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' })],
        region: 'US' as const,
        binanceStatus: 'connected' as const,
        coinbaseStatus: 'connecting' as const,
      };

      if (typeof selector === 'function') {
        return selector(mockState);
      }

      return mockState;
    });
  });

  it.each([320, 375, 768])(
    'uses a wrap-safe toolbar layout and preserves controls at %ipx',
    (width) => {
      setViewport(width);

      render(
        <MemoryRouter>
          <MarketView />
        </MemoryRouter>
      );

      const controlsGroup = screen.getByRole('group', {
        name: /market search and connection controls/i,
      });
      const searchInput = screen.getByRole('textbox', { name: /search crypto assets/i });
      const statusGroup = screen.getByRole('group', {
        name: /market connection statuses/i,
      });

      expect(controlsGroup).toHaveClass('flex-col', 'sm:flex-row');
      expect(searchInput.parentElement).toHaveClass('min-w-0');
      expect(statusGroup).toHaveClass('flex-wrap');

      fireEvent.change(searchInput, { target: { value: 'eth' } });

      expect(searchInput).toHaveValue('eth');
      expect(screen.getByText('BINANCE.US')).toBeInTheDocument();
      expect(screen.getByText('COINBASE')).toBeInTheDocument();
    }
  );
});
