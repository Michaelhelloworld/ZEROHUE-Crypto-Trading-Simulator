/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import { usePortfolioManager } from '../usePortfolioManager';
import { Coin, Order } from '../../types';
import { generateUUID } from '../../utils/uuid';
import * as useStoreModule from '../../store/useStore';
import * as localSimulatorStateModule from '../../utils/localSimulatorState';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../utils/localSimulatorState', () => ({
  stageLocalPersistenceTransition: vi.fn(() => true),
  executeLocalPersistenceTransition: vi.fn(async (transition) => {
    localStorage.setItem('zerohue_portfolio', JSON.stringify(transition.nextPortfolio));
    return true;
  }),
}));

const createCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 50000,
  change24h: 2.5,
  history: [50000],
  ...overrides,
});

const createOrder = (overrides: Partial<Order> = {}): Order => ({
  id: generateUUID(),
  type: 'BUY',
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  amount: 0.1,
  limitPrice: 48000,
  total: 4800,
  timestamp: Date.now(),
  status: 'OPEN',
  ...overrides,
});

describe('usePortfolioManager', () => {
  let mockState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(localSimulatorStateModule.stageLocalPersistenceTransition).mockReturnValue(true);
    vi.mocked(localSimulatorStateModule.executeLocalPersistenceTransition).mockResolvedValue(true);

    mockState = {
      coins: [
        createCoin(),
        createCoin({ id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3000 }),
      ],
      portfolio: {
        balance: 40000,
        initialBalance: 50000,
        holdings: [{ coinId: 'bitcoin', amount: 0.5, averageCost: 45000 }],
      },
      orders: [],
      setPortfolio: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.portfolio = updater(mockState.portfolio);
        } else {
          mockState.portfolio = updater;
        }
      }),
      setOrders: vi.fn(),
      setTransactions: vi.fn(),
      isResetModalOpen: false,
      setIsResetModalOpen: vi.fn((val) => {
        mockState.isResetModalOpen = val;
      }),
      selectedHoldingForEdit: null,
      setSelectedHoldingForEdit: vi.fn((val) => {
        mockState.selectedHoldingForEdit = val;
      }),
    };

    vi.spyOn(useStoreModule, 'useStore').mockImplementation((selector?: any) => {
      if (selector) return selector(mockState);
      return mockState;
    });
  });

  const renderManager = () => renderHook(() => usePortfolioManager());

  describe('Computed Values', () => {
    it('should compute portfolioValue correctly (balance + holdings value)', () => {
      const { result } = renderManager();
      // balance=40000 + holdings=(0.5 * 50000)=25000 = 65000
      expect(result.current.portfolioValue).toBe(65000);
    });

    it('should compute lockedInOrders for both BUY and SELL open orders', () => {
      mockState.orders = [
        createOrder({ type: 'BUY', total: 5000, status: 'OPEN' }),
        createOrder({ type: 'SELL', amount: 0.1, coinId: 'bitcoin', status: 'OPEN' }), // 0.1 * 50000 = 5000
        createOrder({ type: 'BUY', total: 2000, status: 'FILLED' }),
      ];
      const { result } = renderManager();
      // BUY(5000) + SELL(5000) = 10000
      expect(result.current.lockedInOrders).toBe(10000);
    });

    it('should compute totalEquity as portfolioValue + lockedInOrders', () => {
      mockState.orders = [createOrder({ type: 'BUY', total: 5000, status: 'OPEN' })];
      const { result } = renderManager();
      expect(result.current.totalEquity).toBe(65000 + 5000);
    });

    it('should compute totalPnL and pnlPercentage correctly', () => {
      const { result } = renderManager();
      // totalEquity=65000, initialBalance=50000
      expect(result.current.totalPnL).toBe(15000);
      expect(result.current.pnlPercentage).toBe(30); // 15000/50000 * 100
    });

    it('should handle empty holdings', () => {
      mockState.portfolio.holdings = [];
      const { result } = renderManager();
      expect(result.current.portfolioValue).toBe(40000); // balance only
    });

    it('should handle missing coin price gracefully', () => {
      mockState.portfolio.holdings = [{ coinId: 'unknown_coin', amount: 10, averageCost: 100 }];
      const { result } = renderManager();
      // unknown coin price = 0, so holdings value = 0
      expect(result.current.portfolioValue).toBe(40000);
    });

    it('should fall back to the latest valid history price for known coins', () => {
      mockState.coins = [
        createCoin({
          price: 0,
          history: [48000, 49000],
        }),
      ];
      const { result } = renderManager();

      expect(result.current.portfolioValue).toBe(64500);
      expect(result.current.totalEquity).toBe(64500);
      expect(result.current.isScoreDataComplete).toBe(true);
    });
  });

  describe('Account Management', () => {
    it('should open reset modal', () => {
      const { result } = renderManager();

      act(() => {
        result.current.handleResetAccount();
      });

      // isResetModalOpen is no longer returned by the hook (now consumed directly from useStore).
      // We verify the hook correctly calls the setter.
      expect(mockState.setIsResetModalOpen).toHaveBeenCalledWith(true);
    });

    it('should confirm reset with specified amount', async () => {
      const { result } = renderManager();

      await act(async () => {
        await result.current.handleConfirmReset(100000);
      });

      expect(mockState.setPortfolio).toHaveBeenCalledWith({
        balance: 100000,
        initialBalance: 100000,
        holdings: [],
        peakBalance: 100000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      expect(mockState.setTransactions).toHaveBeenCalledWith([]);
      expect(mockState.setOrders).toHaveBeenCalledWith([]);
      expect(toast.success).toHaveBeenCalledWith('Account reset with $100,000 balance');
      expect(localSimulatorStateModule.stageLocalPersistenceTransition).toHaveBeenCalledWith({
        version: 1,
        action: 'account_reset',
        nextPortfolio: {
          balance: 100000,
          initialBalance: 100000,
          holdings: [],
          peakBalance: 100000,
          historicalMDD: 0,
          grossProfit: 0,
          grossLoss: 0,
          validTradesCount: 0,
        },
      });
      expect(localSimulatorStateModule.executeLocalPersistenceTransition).toHaveBeenCalledTimes(1);
    });

    it('should keep the current in-memory state when persistent reset fails', async () => {
      const { result } = renderManager();
      mockState.isResetModalOpen = true;
      vi.mocked(localSimulatorStateModule.executeLocalPersistenceTransition).mockResolvedValueOnce(
        false
      );

      await act(async () => {
        await result.current.handleConfirmReset(100000);
      });

      expect(mockState.setPortfolio).not.toHaveBeenCalled();
      expect(mockState.setTransactions).not.toHaveBeenCalled();
      expect(mockState.setOrders).not.toHaveBeenCalled();
      expect(mockState.setIsResetModalOpen).not.toHaveBeenCalledWith(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Account reset failed because device storage could not be cleared.'
      );
    });

    it('should keep the current in-memory state when local simulator persistence cannot be staged', async () => {
      const { result } = renderManager();
      mockState.isResetModalOpen = true;
      vi.mocked(localSimulatorStateModule.stageLocalPersistenceTransition).mockReturnValueOnce(
        false
      );

      await act(async () => {
        await result.current.handleConfirmReset(100000);
      });

      expect(mockState.setPortfolio).not.toHaveBeenCalled();
      expect(mockState.setTransactions).not.toHaveBeenCalled();
      expect(mockState.setOrders).not.toHaveBeenCalled();
      expect(mockState.setIsResetModalOpen).not.toHaveBeenCalledWith(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Account reset failed because device storage could not be cleared.'
      );
      expect(localSimulatorStateModule.executeLocalPersistenceTransition).not.toHaveBeenCalled();
    });
  });

  describe('Score Snapshot Tracking', () => {
    it('should auto-capture score snapshots when enabled outside the analysis page', () => {
      mockState.portfolio = {
        balance: 40000,
        initialBalance: 50000,
        holdings: [{ coinId: 'bitcoin', amount: 0.5, averageCost: 45000 }],
        peakBalance: 50000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      };

      renderHook(() => usePortfolioManager({ autoCaptureScoreSnapshots: true }));

      expect(mockState.setPortfolio).toHaveBeenCalled();
      const updater = mockState.setPortfolio.mock.calls[0][0];
      const nextPortfolio = typeof updater === 'function' ? updater(mockState.portfolio) : updater;

      expect(nextPortfolio.peakBalance).toBe(65000);
      expect(nextPortfolio.historicalMDD).toBe(0);
    });

    it('should keep updating MDD when live price is missing but history still has a valid mark', () => {
      mockState.coins = [
        createCoin({
          price: 0,
          history: [40000],
        }),
      ];
      mockState.portfolio = {
        balance: 10000,
        initialBalance: 50000,
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        peakBalance: 60000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      };

      renderHook(() => usePortfolioManager({ autoCaptureScoreSnapshots: true }));

      const updater = mockState.setPortfolio.mock.calls[0][0];
      const nextPortfolio = typeof updater === 'function' ? updater(mockState.portfolio) : updater;

      expect(nextPortfolio.historicalMDD).toBeCloseTo((60000 - 50000) / 60000, 6);
    });

    it('should freeze score snapshots when no usable mark price exists', () => {
      mockState.coins = [
        createCoin({
          price: 0,
          history: [0, 0],
        }),
      ];
      mockState.portfolio = {
        balance: 10000,
        initialBalance: 50000,
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }],
        peakBalance: 60000,
        historicalMDD: 0.1,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      };

      renderHook(() => usePortfolioManager({ autoCaptureScoreSnapshots: true }));

      const updater = mockState.setPortfolio.mock.calls[0][0];
      const nextPortfolio = typeof updater === 'function' ? updater(mockState.portfolio) : updater;

      expect(nextPortfolio).toBe(mockState.portfolio);
    });
  });

  describe('Position Editing', () => {
    it('should open edit modal for existing holding', () => {
      const { result } = renderManager();
      const coin = mockState.coins[0];

      act(() => {
        result.current.handleEditPosition(coin);
      });

      expect(mockState.setSelectedHoldingForEdit).toHaveBeenCalledWith({
        holding: expect.objectContaining({
          coinId: 'bitcoin',
          amount: 0.5,
          averageCost: 45000,
        }),
        coin,
      });
    });

    it('should not open edit modal for coin with no holding', () => {
      const { result } = renderManager();
      const ethCoin = mockState.coins[1]; // ETH, no holding

      act(() => {
        result.current.handleEditPosition(ethCoin);
      });

      expect(mockState.setSelectedHoldingForEdit).not.toHaveBeenCalled();
    });

    it('should update TP/SL strategy', () => {
      const { result } = renderManager();

      act(() => {
        result.current.handleUpdateStrategy('bitcoin', 60000, 40000);
      });

      expect(mockState.setPortfolio).toHaveBeenCalled();

      const updater = mockState.setPortfolio.mock.calls[0][0];
      const nextPortfolio = typeof updater === 'function' ? updater(mockState.portfolio) : updater;

      const btcHolding = nextPortfolio.holdings.find(
        (h: { coinId: string }) => h.coinId === 'bitcoin'
      );
      expect(btcHolding).toBeDefined();
      expect(btcHolding?.takeProfitPrice).toBe(60000);
      expect(btcHolding?.stopLossPrice).toBe(40000);
    });
  });
});
