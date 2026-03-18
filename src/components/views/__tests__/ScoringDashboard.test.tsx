import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScoringDashboard from '../ScoringDashboard';
import { Coin, Order, Portfolio } from '../../../types';

const createCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 50000,
  change24h: 0,
  history: [50000],
  ...overrides,
});

const createPortfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  balance: 1000,
  initialBalance: 1000,
  holdings: [],
  peakBalance: 1000,
  historicalMDD: 0.1,
  grossProfit: 5000,
  grossLoss: 0,
  validTradesCount: 20,
  ...overrides,
});

const createSellOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'sell-1',
  type: 'SELL',
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  amount: 1,
  limitPrice: 120,
  total: 120,
  timestamp: 1,
  status: 'OPEN',
  lotAllocations: [
    {
      lotId: 'lot-1',
      coinId: 'bitcoin',
      amount: 1,
      averageCost: 3080,
      wasFullLotClose: true,
    },
  ],
  ...overrides,
});

describe('ScoringDashboard', () => {
  it('counts floating loss from open SELL lot allocations', () => {
    render(
      <ScoringDashboard
        portfolio={createPortfolio()}
        coins={[createCoin({ price: 80, history: [80] })]}
        orders={[createSellOrder()]}
        accountRoiPercentage={50}
      />
    );

    expect(screen.getByText('44.4')).toBeInTheDocument();
    expect(screen.getByText(/Account ROI: 50.00%/i)).toBeInTheDocument();
  });

  it('shows a frozen-state warning when price data is incomplete', () => {
    render(
      <ScoringDashboard
        portfolio={createPortfolio({
          holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 100 }],
        })}
        coins={[createCoin({ price: 0, history: [0, 0] })]}
        orders={[]}
        accountRoiPercentage={10}
      />
    );

    expect(
      screen.getByText(/Score paused while waiting for fresh mark prices/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });
});
