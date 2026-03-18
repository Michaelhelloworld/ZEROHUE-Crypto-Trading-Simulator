/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradeExecution } from '../useTradeExecution';
import { Coin, Order, Portfolio } from '../../types';
import toast from 'react-hot-toast';
import * as useStoreModule from '../../store/useStore';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 50000,
  change24h: 0,
  history: [50000],
  ...overrides,
});

describe('useTradeExecution', () => {
  let mockState: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockState = {
      coins: [createCoin()],
      portfolio: { balance: 50000, initialBalance: 50000, holdings: [] },
      orders: [],
      setPortfolio: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.portfolio = updater(mockState.portfolio);
        } else {
          mockState.portfolio = updater;
        }
      }),
      setOrders: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.orders = updater(mockState.orders);
        } else {
          mockState.orders = updater;
        }
      }),
      setTransactions: vi.fn((_updater) => {
        // mock state is simplified for transactions
      }),
    };

    vi.spyOn(useStoreModule, 'useStore').mockImplementation((selector?: any) => {
      // For this test, assume if there is a selector we might be selecting single values
      // But standard usage uses getState() or bare useStore()
      if (selector) return selector(mockState);
      return mockState;
    });

    // Also mock getState for actions using it
    useStoreModule.useStore.getState = vi.fn(() => mockState) as any;
  });

  afterEach(() => {
    // Advance timers to release the 500ms isExecuting module-level lock
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
  });

  const renderTradeHook = (overrides: Partial<{ portfolio: Portfolio; orders: Order[] }> = {}) => {
    if (overrides.portfolio) mockState.portfolio = overrides.portfolio;
    if (overrides.orders) mockState.orders = overrides.orders;
    return renderHook(() => useTradeExecution());
  };

  // --- Market Order Tests ---

  describe('Market Buy', () => {
    it('should execute market BUY and update portfolio', () => {
      const { result } = renderTradeHook();

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'BUY', 0.5, 'MARKET');
      });

      expect(mockState.setTransactions).toHaveBeenCalledTimes(1);
      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.balance).toBeLessThan(50000);
      expect(mockState.portfolio.holdings).toHaveLength(1);
      expect(mockState.portfolio.holdings[0].coinId).toBe('bitcoin');
    });

    it('should preserve a non-zero average cost for low-priced assets', () => {
      mockState.coins = [
        createCoin({
          id: 'shiba-inu',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          price: 0.00001234,
          history: [0.00001234],
        }),
      ];
      const { result } = renderTradeHook();

      act(() => {
        result.current.handleExecuteTrade('shiba-inu', 'BUY', 1000000, 'MARKET');
      });

      expect(mockState.portfolio.holdings).toHaveLength(1);
      expect(mockState.portfolio.holdings[0].averageCost).toBeCloseTo(0.00001235, 8);
    });

    it('should add to existing holding on market BUY', () => {
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'BUY', 0.5, 'MARKET');
      });

      expect(mockState.portfolio.holdings).toHaveLength(2);
      expect(
        mockState.portfolio.holdings.reduce(
          (acc: number, holding: { amount: number }) => acc + holding.amount,
          0
        )
      ).toBeGreaterThan(1);
    });

    it('uses open orders when checking the 5% volume threshold', () => {
      const { result } = renderTradeHook({
        portfolio: {
          balance: 40000,
          initialBalance: 50000,
          holdings: [],
        },
        orders: [
          {
            id: 'locked-buy',
            type: 'BUY',
            coinId: 'ethereum',
            coinSymbol: 'ETH',
            amount: 5,
            limitPrice: 2000,
            total: 10000,
            timestamp: Date.now(),
            status: 'OPEN',
          },
        ],
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'BUY', 0.046, 'MARKET');
      });

      expect(mockState.portfolio.holdings[0].meetsVolumeCondition).toBe(false);
    });
  });

  describe('Market Sell', () => {
    it('should execute market SELL and update portfolio', () => {
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 0.5, 'MARKET');
      });

      expect(mockState.setTransactions).toHaveBeenCalledTimes(1);
      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.balance).toBeGreaterThan(50000);
      expect(mockState.portfolio.holdings[0].amount).toBe(0.5);
    });

    it('should remove holding when selling entire amount', () => {
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 1, 'MARKET');
      });

      expect(mockState.portfolio.holdings).toHaveLength(0);
    });

    it('does not count a partial market sell as a closed position', () => {
      vi.setSystemTime(new Date(10 * 60 * 1000));
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [
            {
              coinId: 'bitcoin',
              amount: 1,
              averageCost: 45000,
              openedAt: 1,
              meetsVolumeCondition: true,
            },
          ],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 0.5, 'MARKET');
      });

      expect(mockState.portfolio.validTradesCount).toBe(0);
      expect(mockState.portfolio.holdings[0].openedAt).toBe(1);
      expect(mockState.portfolio.holdings[0].meetsVolumeCondition).toBe(true);
    });

    it('does not count a market sell as fully closed while a sibling open SELL order still reserves the same lot', () => {
      vi.setSystemTime(new Date(10 * 60 * 1000));
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [
            {
              id: 'lot-1',
              coinId: 'bitcoin',
              amount: 0.6,
              averageCost: 45000,
              openedAt: 1,
              meetsVolumeCondition: true,
            },
          ],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
        orders: [
          {
            id: 'sell-head',
            type: 'SELL',
            coinId: 'bitcoin',
            coinSymbol: 'BTC',
            amount: 0.4,
            limitPrice: 55000,
            total: 22000,
            timestamp: Date.now(),
            status: 'OPEN',
            lotAllocations: [
              {
                lotId: 'lot-1',
                coinId: 'bitcoin',
                amount: 0.4,
                averageCost: 45000,
                openedAt: 1,
                meetsVolumeCondition: true,
                wasFullLotClose: false,
              },
            ],
          },
        ],
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 0.6, 'MARKET');
      });

      expect(mockState.portfolio.holdings).toHaveLength(0);
      expect(mockState.portfolio.validTradesCount).toBe(0);
    });

    it('uses FIFO lots when realizing market SELL cost basis', () => {
      mockState.coins = [createCoin({ price: 300 })];
      const { result } = renderTradeHook({
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [
            { id: 'lot-1', coinId: 'bitcoin', amount: 1, averageCost: 100 },
            { id: 'lot-2', coinId: 'bitcoin', amount: 1, averageCost: 200 },
          ],
          grossProfit: 0,
          grossLoss: 0,
          validTradesCount: 0,
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 1.5, 'MARKET');
      });

      expect(mockState.portfolio.holdings).toHaveLength(1);
      expect(mockState.portfolio.holdings[0].id).toBe('lot-2');
      expect(mockState.portfolio.holdings[0].amount).toBe(0.5);
      expect(mockState.portfolio.holdings[0].averageCost).toBe(200);
      expect(mockState.portfolio.grossProfit).toBeCloseTo(249.55, 2);
    });
  });

  // --- Limit Order Tests ---

  describe('Limit Buy', () => {
    it('should create limit BUY order and lock balance', () => {
      const { result } = renderTradeHook();

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'BUY', 0.5, 'LIMIT', 48000);
      });

      expect(mockState.setOrders).toHaveBeenCalled();
      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.balance).toBe(50000 - 0.5 * 48000);
    });

    it('should reject limit BUY when insufficient balance', () => {
      const lowBalancePortfolio = { balance: 1000, initialBalance: 50000, holdings: [] };
      const { result } = renderTradeHook({ portfolio: lowBalancePortfolio });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'BUY', 0.5, 'LIMIT', 48000);
      });

      expect(toast.error).toHaveBeenCalledWith('Insufficient balance for limit order');
    });
  });

  describe('Limit Sell', () => {
    it('should create limit SELL order and lock tokens', () => {
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        },
      });

      act(() => {
        result.current.handleExecuteTrade('bitcoin', 'SELL', 0.5, 'LIMIT', 55000);
      });

      expect(mockState.setOrders).toHaveBeenCalled();
      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.holdings[0].amount).toBe(0.5);
    });
  });

  // --- Cancel Order Tests ---

  describe('Cancel Order', () => {
    it('should return locked balance when cancelling BUY order', () => {
      const buyOrder: Order = {
        id: 'ord-1',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 0.5,
        limitPrice: 48000,
        total: 24000,
        timestamp: Date.now(),
        status: 'OPEN',
      };
      const lockedPortfolio = { balance: 26000, initialBalance: 50000, holdings: [] };
      const { result } = renderTradeHook({ portfolio: lockedPortfolio, orders: [buyOrder] });

      act(() => {
        result.current.handleCancelOrder('ord-1');
      });

      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.balance).toBe(50000);
    });

    it('should return locked tokens when cancelling SELL order', () => {
      const sellOrder: Order = {
        id: 'ord-2',
        type: 'SELL',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 0.5,
        limitPrice: 55000,
        total: 27500,
        lotAllocations: [
          {
            lotId: 'lot-1',
            coinId: 'bitcoin',
            amount: 0.5,
            averageCost: 45000,
            wasFullLotClose: false,
          },
        ],
        timestamp: Date.now(),
        status: 'OPEN',
      };
      const { result } = renderTradeHook({
        portfolio: {
          balance: 50000,
          initialBalance: 50000,
          holdings: [{ coinId: 'bitcoin', amount: 0.5, averageCost: 45000 }],
        },
        orders: [sellOrder],
      });

      act(() => {
        result.current.handleCancelOrder('ord-2');
      });

      expect(
        mockState.portfolio.holdings.reduce(
          (acc: number, holding: { amount: number }) => acc + holding.amount,
          0
        )
      ).toBe(1);
    });

    it('should not cancel already filled order', () => {
      const filledOrder: Order = {
        id: 'ord-3',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 0.5,
        limitPrice: 48000,
        total: 24000,
        timestamp: Date.now(),
        status: 'FILLED',
      };
      const { result } = renderTradeHook({ orders: [filledOrder] });

      act(() => {
        result.current.handleCancelOrder('ord-3');
      });

      expect(mockState.setPortfolio).not.toHaveBeenCalled();
      expect(mockState.setOrders).not.toHaveBeenCalled();
    });
  });

  // --- Edge Cases ---

  describe('Edge Cases', () => {
    it('should do nothing for non-existent coin', () => {
      const { result } = renderTradeHook();

      act(() => {
        result.current.handleExecuteTrade('nonexistent', 'BUY', 1, 'MARKET');
      });

      expect(mockState.setPortfolio).not.toHaveBeenCalled();
      expect(mockState.setTransactions).not.toHaveBeenCalled();
    });
  });
});
