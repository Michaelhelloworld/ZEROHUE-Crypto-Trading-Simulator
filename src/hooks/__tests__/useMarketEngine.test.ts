import { describe, it, expect, vi, beforeEach } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, renderHook } from '@testing-library/react';
import { useMarketEngine } from '../useMarketEngine';
import { Coin, Order } from '../../types';
import * as useStoreModule from '../../store/useStore';
import { processTick } from '../../workers/marketEngine.worker';

class MockWorker {
  onmessage: ((event: any) => void) | null = null;
  postMessage(data: any) {
    if (data.type === 'TICK') {
      const result = processTick(data.payload);
      if (result && this.onmessage) {
        this.onmessage({ data: { type: 'TICK_RESULT', payload: result } } as any);
      }
    }
  }
  terminate() {}
}

global.Worker = MockWorker as any;

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create mock coin
const createMockCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 50000,
  change24h: 0,
  history: [50000],
  ...overrides,
});

// Helper to create mock order
const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  type: 'BUY',
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  amount: 1,
  limitPrice: 50000,
  total: 50000,
  timestamp: Date.now(),
  status: 'OPEN',
  ...overrides,
});

describe('useMarketEngine', () => {
  let mockState: any;
  let storeListeners: Set<(state: any, previousState: any) => void>;

  beforeEach(() => {
    storeListeners = new Set();
    mockState = {
      orders: [],
      engineStateVersion: 0,
      setOrders: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.orders = updater(mockState.orders);
        } else {
          mockState.orders = updater;
        }
        mockState.engineStateVersion += 1;
      }),
      portfolio: { balance: 50000, initialBalance: 50000, holdings: [] },
      setPortfolio: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.portfolio = updater(mockState.portfolio);
        } else {
          mockState.portfolio = updater;
        }
        mockState.engineStateVersion += 1;
      }),
      setTransactions: vi.fn(),
      coins: [createMockCoin()],
    };

    vi.spyOn(useStoreModule, 'useStore').mockImplementation((selector?: any) => {
      if (selector) return selector(mockState);
      return mockState;
    });
    (useStoreModule.useStore as unknown as { getState: () => typeof mockState }).getState = vi.fn(
      () => mockState
    );
    (
      useStoreModule.useStore as unknown as {
        subscribe: (
          listener: (state: typeof mockState, previousState: typeof mockState) => void
        ) => () => void;
      }
    ).subscribe = vi.fn((listener) => {
      storeListeners.add(listener);
      return () => {
        storeListeners.delete(listener);
      };
    });
  });

  describe('Order Matching', () => {
    it('stays idle while the live engine is gated during initial replay', () => {
      const order = createMockOrder({ limitPrice: 45000, amount: 1 });
      mockState.orders = [order];
      mockState.coins = [createMockCoin({ price: 44000 })];

      renderHook(() => useMarketEngine(false));

      expect(mockState.setOrders).not.toHaveBeenCalled();
      expect(mockState.setPortfolio).not.toHaveBeenCalled();
    });

    it('should fill BUY order when price drops to limit', () => {
      const order = createMockOrder({ limitPrice: 45000, amount: 1 });
      mockState.orders = [order];
      mockState.coins = [createMockCoin({ price: 44000 })];

      renderHook(() => useMarketEngine());

      // Engine internally checks price and triggers execution
      expect(mockState.setOrders).toHaveBeenCalled();

      const updater = mockState.setOrders.mock.calls[0][0];
      const resultOrders = typeof updater === 'function' ? updater([order]) : updater;
      expect(resultOrders[0].status).toBe('FILLED');
    });

    it('should fill SELL order when price rises to limit', () => {
      const order = createMockOrder({
        type: 'SELL',
        limitPrice: 55000,
        amount: 0.5,
        lotAllocations: [
          {
            lotId: 'lot-sell-fill',
            coinId: 'bitcoin',
            amount: 0.5,
            averageCost: 50000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      });
      mockState.orders = [order];
      mockState.portfolio.holdings = [];
      mockState.coins = [createMockCoin({ price: 56000 })];

      renderHook(() => useMarketEngine());

      expect(mockState.setOrders).toHaveBeenCalled();
      const updater = mockState.setOrders.mock.calls[0][0];
      const resultOrders = typeof updater === 'function' ? updater([order]) : updater;
      expect(resultOrders[0].status).toBe('FILLED');
    });

    it('should NOT fill BUY order when price is above limit', () => {
      const order = createMockOrder({ limitPrice: 45000, amount: 1 });
      mockState.orders = [order];
      mockState.coins = [createMockCoin({ price: 50000 })];

      renderHook(() => useMarketEngine());
      expect(mockState.setOrders).not.toHaveBeenCalled();
    });

    it('should settle limit BUY at configured limit price under gap moves', () => {
      const order = createMockOrder({ limitPrice: 45000, amount: 1, total: 45000 });
      mockState.orders = [order];
      mockState.portfolio.balance = 0;
      mockState.coins = [createMockCoin({ price: 40000 })];

      renderHook(() => useMarketEngine());

      expect(mockState.setOrders).toHaveBeenCalled();
      expect(mockState.setPortfolio).toHaveBeenCalled();

      // Deterministic limit execution: no slippage refund from market gap.
      expect(mockState.portfolio.balance).toBeCloseTo(0);
    });

    it('should re-evaluate immediately when a newly placed limit order is already marketable', () => {
      const { rerender } = renderHook(() => useMarketEngine());

      const order = createMockOrder({ limitPrice: 55000, amount: 1, total: 55000 });
      mockState.orders = [order];
      mockState.portfolio.balance = 0;
      mockState.engineStateVersion += 1;

      rerender();

      expect(mockState.setOrders).toHaveBeenCalled();
      const updater = mockState.setOrders.mock.calls[0][0];
      const resultOrders = typeof updater === 'function' ? updater([order]) : updater;
      expect(resultOrders[0].status).toBe('FILLED');
    });

    it('still processes an earlier trigger even if a later tick returns first', async () => {
      vi.useFakeTimers();
      const OriginalWorker = global.Worker;

      class AsyncMockWorker {
        onmessage: ((event: any) => void) | null = null;
        postMessage(data: any) {
          const delay = data.payload.requestId === 1 ? 20 : 0;
          setTimeout(() => {
            const result = processTick(data.payload);
            if (result && this.onmessage) {
              this.onmessage({ data: { type: 'TICK_RESULT', payload: result } } as any);
            }
          }, delay);
        }
        terminate() {}
      }

      global.Worker = AsyncMockWorker as any;

      try {
        const order = createMockOrder({ limitPrice: 50000, amount: 1 });
        mockState.orders = [order];
        mockState.coins = [createMockCoin({ price: 49999 })];

        const { rerender, unmount } = renderHook(() => useMarketEngine());

        mockState.coins = [createMockCoin({ price: 50001 })];
        rerender();

        await act(async () => {
          vi.runAllTimers();
        });

        expect(mockState.setOrders).toHaveBeenCalled();
        expect(mockState.setPortfolio).toHaveBeenCalled();

        const ordersUpdater = mockState.setOrders.mock.calls[0][0];
        const resultOrders =
          typeof ordersUpdater === 'function' ? ordersUpdater([order]) : ordersUpdater;
        expect(resultOrders[0].status).toBe('FILLED');

        unmount();
      } finally {
        global.Worker = OriginalWorker;
        vi.useRealTimers();
      }
    });
  });

  describe('TP/SL Triggers', () => {
    it('should trigger Take Profit (Long)', () => {
      const holding = {
        coinId: 'bitcoin',
        amount: 1,
        averageCost: 50000,
        takeProfitPrice: 55000,
      };
      mockState.portfolio.holdings = [holding];
      mockState.portfolio.balance = 0;
      mockState.coins = [createMockCoin({ price: 55000 })];

      renderHook(() => useMarketEngine());

      expect(mockState.setOrders).not.toHaveBeenCalled();
      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.holdings).toHaveLength(0);
      expect(mockState.portfolio.balance).toBeCloseTo(54945);
    });

    it('should trigger Stop Loss (Long)', () => {
      const holding = {
        coinId: 'bitcoin',
        amount: 1,
        averageCost: 50000,
        stopLossPrice: 45000,
      };
      mockState.portfolio.holdings = [holding];
      mockState.portfolio.balance = 0;
      mockState.coins = [createMockCoin({ price: 44000 })];

      renderHook(() => useMarketEngine());

      expect(mockState.setPortfolio).toHaveBeenCalled();
      expect(mockState.portfolio.holdings).toHaveLength(0);
      // Stop-loss executes at configured trigger price, not latest market print.
      expect(mockState.portfolio.balance).toBeCloseTo(44955);
    });

    it('should NOT trigger TP/SL if price is within range', () => {
      const holding = {
        coinId: 'bitcoin',
        amount: 1,
        averageCost: 50000,
        takeProfitPrice: 55000,
        stopLossPrice: 45000,
      };
      mockState.portfolio.holdings = [holding];
      mockState.coins = [createMockCoin({ price: 50000 })];

      renderHook(() => useMarketEngine());

      expect(mockState.setPortfolio).not.toHaveBeenCalled();
    });
  });

  describe('Accounting Edge Cases', () => {
    it('settles multiple reserved SELL limits on the same tick without recreating holdings', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10 * 60 * 1000);
      const sellA = createMockOrder({
        id: 'sell-a',
        type: 'SELL',
        amount: 0.4,
        limitPrice: 55000,
        total: 22000,
        lotAllocations: [
          {
            lotId: 'lot-a',
            coinId: 'bitcoin',
            amount: 0.4,
            averageCost: 50000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      });
      const sellB = createMockOrder({
        id: 'sell-b',
        type: 'SELL',
        amount: 0.6,
        limitPrice: 55000,
        total: 33000,
        lotAllocations: [
          {
            lotId: 'lot-b',
            coinId: 'bitcoin',
            amount: 0.6,
            averageCost: 50000,
            openedAt: 2,
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      });

      const result = processTick({
        requestId: 1,
        requestVersion: 0,
        coins: [createMockCoin({ price: 56000 })],
        orders: [sellA, sellB],
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      expect(
        result?.nextOrders?.filter((order) => order.status === 'FILLED').map((order) => order.id)
      ).toEqual(['sell-a', 'sell-b']);
      expect(result?.portfolioUpdates?.holdings).toHaveLength(0);
      expect(result?.portfolioUpdates?.validTradesCount).toBe(2);

      nowSpy.mockRestore();
    });

    it('triggers stop-loss on reserved sell lots and cancels the open limit order', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10 * 60 * 1000);
      const order = createMockOrder({
        id: 'reserved-sell',
        type: 'SELL',
        amount: 1,
        limitPrice: 55000,
        total: 55000,
        lotAllocations: [
          {
            lotId: 'lot-1',
            coinId: 'bitcoin',
            amount: 1,
            averageCost: 50000,
            stopLossPrice: 45000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      });

      const result = processTick({
        requestId: 1,
        requestVersion: 0,
        coins: [createMockCoin({ price: 44000 })],
        orders: [order],
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      expect(result?.nextOrders?.[0].status).toBe('CANCELLED');
      expect(result?.portfolioUpdates?.balance).toBeCloseTo(44955);
      expect(result?.portfolioUpdates?.validTradesCount).toBe(1);
      expect(result?.newTransactions).toHaveLength(1);
      expect(result?.notifications[0]).toMatchObject({ type: 'SL', coinSymbol: 'BTC' });

      nowSpy.mockRestore();
    });

    it('does not count a split-lot SELL fill while sibling reservations remain open', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10 * 60 * 1000);
      const tailOrder = createMockOrder({
        id: 'sell-tail',
        type: 'SELL',
        amount: 0.6,
        limitPrice: 55000,
        total: 33000,
        lotAllocations: [
          {
            lotId: 'lot-1',
            coinId: 'bitcoin',
            amount: 0.6,
            averageCost: 50000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: true,
          },
        ],
      });
      const headOrder = createMockOrder({
        id: 'sell-head',
        type: 'SELL',
        amount: 0.4,
        limitPrice: 60000,
        total: 24000,
        lotAllocations: [
          {
            lotId: 'lot-1',
            coinId: 'bitcoin',
            amount: 0.4,
            averageCost: 50000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: false,
          },
        ],
      });

      const result = processTick({
        requestId: 1,
        requestVersion: 0,
        coins: [createMockCoin({ price: 56000 })],
        orders: [tailOrder, headOrder],
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      expect(result?.portfolioUpdates?.validTradesCount).toBe(0);
      expect(result?.nextOrders?.find((candidate) => candidate.id === 'sell-tail')?.status).toBe(
        'FILLED'
      );
      expect(result?.nextOrders?.find((candidate) => candidate.id === 'sell-head')?.status).toBe(
        'OPEN'
      );

      nowSpy.mockRestore();
    });

    it('counts the final split-lot SELL fill once no exposure remains even if placement metadata was stale', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10 * 60 * 1000);
      const order = createMockOrder({
        id: 'sell-head',
        type: 'SELL',
        amount: 0.4,
        limitPrice: 55000,
        total: 22000,
        lotAllocations: [
          {
            lotId: 'lot-1',
            coinId: 'bitcoin',
            amount: 0.4,
            averageCost: 50000,
            openedAt: 1,
            meetsVolumeCondition: true,
            wasFullLotClose: false,
          },
        ],
      });

      const result = processTick({
        requestId: 1,
        requestVersion: 0,
        coins: [createMockCoin({ price: 56000 })],
        orders: [order],
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      expect(result?.portfolioUpdates?.validTradesCount).toBe(1);
      expect(result?.nextOrders?.[0].status).toBe('FILLED');

      nowSpy.mockRestore();
    });

    it('cancels invalid open SELL limits without allocations instead of settling them', () => {
      const order = createMockOrder({
        id: 'invalid-sell',
        type: 'SELL',
        amount: 0.4,
        limitPrice: 55000,
        total: 22000,
      });

      const result = processTick({
        requestId: 1,
        requestVersion: 0,
        coins: [createMockCoin({ price: 56000 })],
        orders: [order],
        portfolio: {
          balance: 0,
          initialBalance: 50000,
          holdings: [],
          validTradesCount: 0,
          grossProfit: 0,
          grossLoss: 0,
        },
      });

      expect(result?.nextOrders?.[0]).toMatchObject({
        id: 'invalid-sell',
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
      });
      expect(result?.newTransactions).toHaveLength(0);
      expect(result?.portfolioUpdates).toBeNull();
    });
  });
});
