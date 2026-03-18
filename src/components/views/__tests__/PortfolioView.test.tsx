import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PortfolioView from '../PortfolioView';
import { Coin, Holding, Order } from '../../../types';
import * as useStoreModule from '../../../store/useStore';
import * as portfolioManagerModule from '../../../hooks/usePortfolioManager';

const mockNavigate = vi.fn();
const mockHandleEditPosition = vi.fn();

vi.mock('../../../hooks/useSEO', () => ({
  useSEO: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  Tooltip: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          layout: _layout,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        }: {
          children?: React.ReactNode;
          layout?: unknown;
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
  id: 'ethereum',
  symbol: 'ETH',
  name: 'Ethereum',
  price: 3000,
  change24h: 1.5,
  history: [3000],
  ...overrides,
});

const createHolding = (overrides: Partial<Holding> = {}): Holding => ({
  id: 'lot-1',
  coinId: 'ethereum',
  amount: 1,
  averageCost: 2500,
  openedAt: new Date('2026-03-10T10:00:00Z').getTime(),
  meetsVolumeCondition: true,
  ...overrides,
});

describe('PortfolioView', () => {
  let mockState: {
    portfolio: {
      balance: number;
      holdings: Holding[];
    };
    coins: Coin[];
    orders: Order[];
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockState = {
      portfolio: {
        balance: 1200,
        holdings: [
          createHolding(),
          createHolding({
            id: 'lot-2',
            amount: 0.5,
            averageCost: 2800,
            openedAt: new Date('2026-03-10T11:15:00Z').getTime(),
            meetsVolumeCondition: false,
            takeProfitPrice: 3400,
          }),
        ],
      },
      coins: [createCoin()],
      orders: [],
    };

    vi.spyOn(useStoreModule, 'useStore').mockImplementation((selector?: unknown) => {
      if (typeof selector === 'function') {
        return selector(mockState);
      }
      return mockState;
    });

    vi.spyOn(portfolioManagerModule, 'usePortfolioManager').mockReturnValue({
      handleEditPosition: mockHandleEditPosition,
    } as unknown as ReturnType<typeof portfolioManagerModule.usePortfolioManager>);
  });

  const renderView = () =>
    render(
      <MemoryRouter>
        <PortfolioView />
      </MemoryRouter>
    );

  it('keeps the top-level portfolio display aggregated by coin', () => {
    renderView();

    expect(
      screen.getAllByText((text) => text.includes('ETH') && text.includes('2 lots')).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('1.500000').length).toBeGreaterThan(0);
    expect(screen.queryByText(/FIFO Lot 1/i)).not.toBeInTheDocument();
  });

  it('expands FIFO lot details for an aggregated asset', () => {
    renderView();

    const toggleButtons = screen.getAllByRole('button', { name: /show 2 lots/i });
    fireEvent.click(toggleButtons[0]);

    expect(screen.getAllByRole('button', { name: /hide lots/i })[0]).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getAllByText(/FIFO Lot 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FIFO Lot 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.000000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.500000').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5% Qualified/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Below 5%/i).length).toBeGreaterThan(0);
  });

  it('keeps reserved sell lots visible in the aggregated portfolio view', () => {
    mockState.portfolio.holdings = [];
    mockState.orders = [
      {
        id: 'reserved-sell',
        type: 'SELL',
        coinId: 'ethereum',
        coinSymbol: 'ETH',
        amount: 1,
        limitPrice: 3200,
        total: 3200,
        status: 'OPEN',
        timestamp: Date.now(),
        lotAllocations: [
          {
            lotId: 'reserved-lot-1',
            coinId: 'ethereum',
            amount: 1,
            averageCost: 2500,
            openedAt: new Date('2026-03-10T10:00:00Z').getTime(),
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      },
    ];

    renderView();

    expect(
      screen.getAllByText((text) => text.includes('ETH') && text.includes('1 lot')).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reserved 1\.000000 ETH/i).length).toBeGreaterThan(0);
  });

  it('uses historical mark prices in the portfolio view when the live price is unavailable', () => {
    mockState.coins = [createCoin({ price: 0, history: [2800, 3100] })];

    renderView();

    expect(screen.getAllByText('$4,650.00').length).toBeGreaterThan(0);
  });
});
