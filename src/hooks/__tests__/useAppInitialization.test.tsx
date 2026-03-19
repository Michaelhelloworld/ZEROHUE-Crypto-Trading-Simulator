import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppInitialization } from '../useAppInitialization';
import * as useStoreModule from '../../store/useStore';
import { AppState } from '../../store/useStore';
import { dbService } from '../../services/db';
import * as offlineExecutionModule from '../useOfflineOrderExecution';
import * as marketEngineModule from '../useMarketEngine';

vi.mock('../../services/db', () => ({
  dbService: {
    pruneHistory: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    replaceAll: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../useIDBSync', () => ({ useIDBSync: vi.fn() }));
vi.mock('../useMarketData', () => ({ useMarketData: vi.fn() }));
vi.mock('../useOfflineOrderExecution', () => ({ useOfflineOrderExecution: vi.fn() }));
vi.mock('../useMarketEngine', () => ({ useMarketEngine: vi.fn() }));

describe('useAppInitialization resilience', () => {
  let mockState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockState = {
      coins: [],
      region: 'GLOBAL',
      binanceStatus: 'disconnected',
      coinbaseStatus: 'disconnected',
      engineStateVersion: 0,
      setCoins: vi.fn(),
      setRegion: vi.fn(),
      setBinanceStatus: vi.fn(),
      setCoinbaseStatus: vi.fn(),
      portfolio: {
        balance: 50000,
        initialBalance: 50000,
        holdings: [],
        peakBalance: 50000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      },
      orders: [],
      transactions: [],
      setPortfolio: vi.fn((updater) => {
        mockState.portfolio =
          typeof updater === 'function' ? updater(mockState.portfolio) : updater;
      }),
      setOrders: vi.fn((updater) => {
        mockState.orders = typeof updater === 'function' ? updater(mockState.orders) : updater;
      }),
      setTransactions: vi.fn((updater) => {
        mockState.transactions =
          typeof updater === 'function' ? updater(mockState.transactions) : updater;
      }),
      isResetModalOpen: false,
      setIsResetModalOpen: vi.fn(),
      selectedHoldingForEdit: null,
      setSelectedHoldingForEdit: vi.fn(),
    } as AppState;

    localStorage.setItem('zerohue_portfolio', JSON.stringify(mockState.portfolio));

    vi.spyOn(useStoreModule, 'useStore').mockImplementation(
      (selector?: (state: AppState) => unknown) => {
        if (typeof selector === 'function') return selector(mockState);
        return mockState;
      }
    );
  });

  it('keeps the live market engine gated until the initial offline replay settles', async () => {
    vi.mocked(offlineExecutionModule.useOfflineOrderExecution).mockReturnValue({
      isInitialReplaySettled: false,
      initialReplayError: null,
      retryInitialReplay: vi.fn(),
      skipInitialReplay: vi.fn(),
    });

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(marketEngineModule.useMarketEngine).toHaveBeenCalledWith(false);
      expect(result.current.initializationStage).toBe('replay_pending');
    });
  });

  it('forwards initial replay errors and recovery actions to the app shell', async () => {
    const retryInitialReplay = vi.fn();
    const skipInitialReplay = vi.fn();
    vi.mocked(offlineExecutionModule.useOfflineOrderExecution).mockReturnValue({
      isInitialReplaySettled: false,
      initialReplayError: {
        sources: ['BINANCE'],
        attemptCount: 3,
      },
      retryInitialReplay,
      skipInitialReplay,
    });

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.initialReplayError).toMatchObject({
        sources: ['BINANCE'],
        attemptCount: 3,
      });
      expect(result.current.initializationStage).toBe('replay_error');
    });

    result.current.retryInitialReplay();
    result.current.skipInitialReplay();

    expect(retryInitialReplay).toHaveBeenCalledTimes(1);
    expect(skipInitialReplay).toHaveBeenCalledTimes(1);
  });

  it('reports the app as ready only after hydration and initial replay both settle', async () => {
    vi.mocked(offlineExecutionModule.useOfflineOrderExecution).mockReturnValue({
      isInitialReplaySettled: true,
      initialReplayError: null,
      retryInitialReplay: vi.fn(),
      skipInitialReplay: vi.fn(),
    });

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.initializationStage).toBe('ready');
      expect(marketEngineModule.useMarketEngine).toHaveBeenCalledWith(true);
    });
  });

  it('ignores deprecated localStorage order and transaction arrays during hydration', async () => {
    const oldTransactions = [
      {
        id: 'tx-1',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        pricePerCoin: 100,
        total: 100,
        timestamp: 1,
      },
    ];
    const oldOrders = [
      {
        id: 'ord-1',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 100,
        total: 100,
        timestamp: 1,
        status: 'OPEN',
      },
    ];

    localStorage.setItem('zerohue_transactions', JSON.stringify(oldTransactions));
    localStorage.setItem('zerohue_orders', JSON.stringify(oldOrders));

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(dbService.getAll).toHaveBeenCalledWith('orders');
      expect(dbService.getAll).toHaveBeenCalledWith('transactions');
    });

    expect(dbService.replaceAll).not.toHaveBeenCalled();
    expect(mockState.transactions).toEqual([]);
    expect(mockState.orders).toEqual([]);
    expect(localStorage.getItem('zerohue_transactions')).toBe(JSON.stringify(oldTransactions));
    expect(localStorage.getItem('zerohue_orders')).toBe(JSON.stringify(oldOrders));
  });

  it('still hydrates orders and transactions when market-history pruning fails', async () => {
    const persistedOrders = [
      {
        id: 'ord-live',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 100,
        total: 100,
        timestamp: 1,
        status: 'OPEN',
      },
    ];
    const persistedTransactions = [
      {
        id: 'tx-live',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        pricePerCoin: 100,
        total: 100,
        fee: 0.1,
        timestamp: 1,
      },
    ];

    vi.mocked(dbService.pruneHistory).mockRejectedValueOnce(new Error('prune failed'));
    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return persistedOrders;
      if (storeName === 'transactions') return persistedTransactions;
      return [];
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual(persistedOrders);
      expect(mockState.transactions).toEqual(persistedTransactions);
    });

    consoleSpy.mockRestore();
  });

  it('sorts hydrated orders and transactions newest-first before restoring state', async () => {
    const persistedOrders = [
      {
        id: 'ord-old',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 100,
        total: 100,
        timestamp: 1,
        status: 'OPEN',
      },
      {
        id: 'ord-new',
        type: 'SELL',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 0.5,
        limitPrice: 120,
        total: 60,
        timestamp: 5,
        status: 'FILLED',
      },
    ];
    const persistedTransactions = [
      {
        id: 'tx-old',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        pricePerCoin: 100,
        total: 100,
        fee: 0.1,
        timestamp: 1,
      },
      {
        id: 'tx-new',
        type: 'SELL',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 0.5,
        pricePerCoin: 120,
        total: 60,
        fee: 0.06,
        timestamp: 5,
      },
    ];

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return persistedOrders;
      if (storeName === 'transactions') return persistedTransactions;
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders.map((order) => order.id)).toEqual(['ord-new', 'ord-old']);
      expect(mockState.transactions.map((transaction) => transaction.id)).toEqual([
        'tx-new',
        'tx-old',
      ]);
    });
  });

  it('drops malformed persisted orders and transactions instead of hydrating them into state', async () => {
    const validOrder = {
      id: 'ord-valid',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 5,
      status: 'OPEN' as const,
    };
    const validTransaction = {
      id: 'tx-valid',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.5,
      pricePerCoin: 120,
      total: 60,
      fee: 0.06,
      timestamp: 5,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') {
        return [{ id: 'ord-bad', timestamp: 1 }, validOrder];
      }
      if (storeName === 'transactions') {
        return [{ id: 'tx-bad', timestamp: 1 }, validTransaction];
      }
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([validOrder]);
      expect(mockState.transactions).toEqual([validTransaction]);
    });
  });

  it('normalizes parseable but malformed portfolio payloads before restoring state', async () => {
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        balance: 42000,
        initialBalance: 'bad-data',
        holdings: [
          {
            coinId: 'bitcoin',
            amount: 1.25,
            averageCost: 30000,
            takeProfitPrice: 35000,
            stopLossPrice: 28000,
            openedAt: 123,
            meetsVolumeCondition: true,
          },
          {
            coinId: 'ethereum',
            amount: 'oops',
            averageCost: 2000,
          },
        ],
        peakBalance: 41000,
        historicalMDD: -0.5,
        grossProfit: 'nan',
        grossLoss: 5.5,
        validTradesCount: 3.8,
      })
    );

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.portfolio.balance).toBe(42000);
      expect(mockState.portfolio.initialBalance).toBe(50000);
      expect(mockState.portfolio.peakBalance).toBe(50000);
      expect(mockState.portfolio.historicalMDD).toBe(0);
      expect(mockState.portfolio.grossProfit).toBe(0);
      expect(mockState.portfolio.grossLoss).toBe(5.5);
      expect(mockState.portfolio.validTradesCount).toBe(3);
      expect(mockState.portfolio.holdings).toEqual([
        expect.objectContaining({
          coinId: 'bitcoin',
          amount: 1.25,
          averageCost: 30000,
          takeProfitPrice: 35000,
          stopLossPrice: 28000,
          openedAt: 123,
          meetsVolumeCondition: true,
        }),
      ]);
    });
  });

  it('replaces an unreadable portfolio payload with the default portfolio', async () => {
    localStorage.setItem('zerohue_portfolio', '{bad-json');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(mockState.portfolio).toEqual({
        balance: 50000,
        initialBalance: 50000,
        holdings: [],
        peakBalance: 50000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
    });

    expect(JSON.parse(localStorage.getItem('zerohue_portfolio') || 'null')).toEqual(
      mockState.portfolio
    );

    consoleSpy.mockRestore();
  });

  it('cancels open orders when portfolio hydration falls back to defaults after unreadable storage', async () => {
    localStorage.setItem('zerohue_portfolio', '{bad-json');
    const persistedOpenBuyOrder = {
      id: 'ord-open-buy',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [persistedOpenBuyOrder];
      return [];
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.portfolio).toEqual({
        balance: 50000,
        initialBalance: 50000,
        holdings: [],
        peakBalance: 50000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      expect(mockState.orders).toEqual([
        expect.objectContaining({
          id: 'ord-open-buy',
          status: 'CANCELLED',
          amount: 0,
          total: 0,
          lotAllocations: [],
        }),
      ]);
    });

    expect(dbService.replaceAll).toHaveBeenCalledWith('orders', [
      expect.objectContaining({
        id: 'ord-open-buy',
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
      }),
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Recovered portfolio state could not safely preserve open orders. Open orders were cancelled to avoid cash and holdings mismatches.'
    );

    warnSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('cancels open orders when portfolio storage is missing but IndexedDB still contains open orders', async () => {
    localStorage.removeItem('zerohue_portfolio');
    const persistedOpenBuyOrder = {
      id: 'ord-missing-portfolio',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [persistedOpenBuyOrder];
      return [];
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.portfolio).toEqual({
        balance: 50000,
        initialBalance: 50000,
        holdings: [],
        peakBalance: 50000,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      expect(mockState.orders).toEqual([
        expect.objectContaining({
          id: 'ord-missing-portfolio',
          status: 'CANCELLED',
          amount: 0,
          total: 0,
          lotAllocations: [],
        }),
      ]);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Recovered portfolio state could not safely preserve open orders. Open orders were cancelled to avoid cash and holdings mismatches.'
    );

    warnSpy.mockRestore();
  });

  it('cancels open orders when a parseable portfolio normalizes into an unsafe balance state', async () => {
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        balance: -100,
        initialBalance: -200,
        holdings: [],
      })
    );
    const persistedOpenBuyOrder = {
      id: 'ord-unsafe-portfolio',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [persistedOpenBuyOrder];
      return [];
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.portfolio.balance).toBe(50000);
      expect(mockState.orders).toEqual([
        expect.objectContaining({
          id: 'ord-unsafe-portfolio',
          status: 'CANCELLED',
          amount: 0,
          total: 0,
          lotAllocations: [],
        }),
      ]);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Recovered portfolio state could not safely preserve open orders. Open orders were cancelled to avoid cash and holdings mismatches.'
    );

    warnSpy.mockRestore();
  });

  it('cancels open orders when portfolio holdings lose trusted lot ids during hydration', async () => {
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        balance: 50000,
        initialBalance: 50000,
        holdings: [
          {
            coinId: 'bitcoin',
            amount: 1,
            averageCost: 30000,
            openedAt: 10,
            meetsVolumeCondition: true,
          },
        ],
      })
    );
    const persistedOpenSellOrder = {
      id: 'ord-untrusted-lot-id',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
      lotAllocations: [
        {
          lotId: 'legacy-lot-id',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 30000,
          openedAt: 10,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
      ],
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [persistedOpenSellOrder];
      return [];
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([
        expect.objectContaining({
          id: 'ord-untrusted-lot-id',
          status: 'CANCELLED',
          amount: 0,
          total: 0,
          lotAllocations: [],
        }),
      ]);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Recovered portfolio state could not safely preserve open orders. Open orders were cancelled to avoid cash and holdings mismatches.'
    );

    warnSpy.mockRestore();
  });

  it('drops unsupported negative and zero-size portfolio holdings during hydration', async () => {
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        balance: -100,
        initialBalance: -200,
        holdings: [
          {
            coinId: 'bitcoin',
            amount: -1,
            averageCost: 30000,
          },
          {
            coinId: 'ethereum',
            amount: 0,
            averageCost: 2000,
            takeProfitPrice: -10,
            stopLossPrice: 1500,
          },
        ],
        historicalMDD: 1.5,
      })
    );

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.portfolio.balance).toBe(50000);
      expect(mockState.portfolio.initialBalance).toBe(50000);
      expect(mockState.portfolio.historicalMDD).toBe(0);
      expect(mockState.portfolio.holdings).toEqual([]);
    });

    expect(localStorage.getItem('zerohue_portfolio')).toContain('"holdings":[]');
  });

  it('does not rebuild holdings from transaction history when portfolio storage is empty', async () => {
    localStorage.removeItem('zerohue_portfolio');
    const persistedTransactions = [
      {
        id: 'tx-shib-buy',
        type: 'BUY',
        coinId: 'shiba-inu',
        coinSymbol: 'SHIB',
        amount: 1000000,
        pricePerCoin: 0.00001234,
        total: 12.34,
        fee: 0.01,
        timestamp: 100,
      },
    ];

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'transactions') return persistedTransactions;
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.transactions).toEqual(persistedTransactions);
      expect(mockState.portfolio.holdings).toEqual([]);
    });
  });

  it('overwrites stale in-memory orders and transactions when IndexedDB hydrates empty arrays', async () => {
    mockState.orders = [
      {
        id: 'ord-stale',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 100,
        total: 100,
        timestamp: 1,
        status: 'OPEN',
      },
    ];
    mockState.transactions = [
      {
        id: 'tx-stale',
        type: 'BUY',
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        amount: 1,
        pricePerCoin: 100,
        total: 100,
        fee: 0.1,
        timestamp: 1,
      },
    ];
    vi.mocked(dbService.getAll).mockResolvedValue([]);

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([]);
      expect(mockState.transactions).toEqual([]);
    });
  });

  it('drops deprecated open SELL orders without lot allocations and rewrites sanitized IDB data', async () => {
    const invalidOpenSellOrder = {
      id: 'ord-invalid-sell',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.5,
      limitPrice: 120,
      total: 60,
      timestamp: 5,
      status: 'OPEN' as const,
    };
    const validBuyOrder = {
      id: 'ord-valid-buy',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [invalidOpenSellOrder, validBuyOrder];
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([validBuyOrder]);
    });

    await waitFor(() => {
      expect(dbService.replaceAll).toHaveBeenCalledWith('orders', [validBuyOrder]);
    });
  });

  it('still hydrates sanitized orders when IndexedDB rewrite fails after a successful read', async () => {
    const invalidOpenSellOrder = {
      id: 'ord-invalid-sell',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.5,
      limitPrice: 120,
      total: 60,
      timestamp: 5,
      status: 'OPEN' as const,
    };
    const validBuyOrder = {
      id: 'ord-valid-buy',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [invalidOpenSellOrder, validBuyOrder];
      return [];
    });
    vi.mocked(dbService.replaceAll).mockRejectedValueOnce(new Error('rewrite failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([validBuyOrder]);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to rewrite sanitized orders in IndexedDB',
        expect.any(Error)
      );
    });
    expect(result.current.isHydrated).toBe(true);

    consoleSpy.mockRestore();
  });

  it('waits for sanitized order rewrites to finish before marking hydration complete', async () => {
    const invalidOpenSellOrder = {
      id: 'ord-invalid-sell',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.5,
      limitPrice: 120,
      total: 60,
      timestamp: 5,
      status: 'OPEN' as const,
    };
    const validBuyOrder = {
      id: 'ord-valid-buy',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN' as const,
    };

    let resolveRewrite: ((value: boolean) => void) | undefined;
    const rewritePromise = new Promise<boolean>((resolve) => {
      resolveRewrite = resolve;
    });

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [invalidOpenSellOrder, validBuyOrder];
      return [];
    });
    vi.mocked(dbService.replaceAll).mockImplementationOnce(() => rewritePromise);

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([validBuyOrder]);
    });

    expect(result.current.isHydrated).toBe(false);

    resolveRewrite?.(true);

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });
  });

  it('rewrites orders when only nested lot allocations are sanitized', async () => {
    const validAllocation = {
      lotId: 'lot-valid',
      coinId: 'bitcoin',
      amount: 0.4,
      averageCost: 95,
      openedAt: 10,
      meetsVolumeCondition: true,
      wasFullLotClose: false,
    };
    const orderWithMixedAllocations = {
      id: 'ord-sell',
      type: 'SELL' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 120,
      total: 120,
      timestamp: 5,
      status: 'OPEN' as const,
      lotAllocations: [
        validAllocation,
        {
          lotId: 'lot-invalid',
          coinId: 'bitcoin',
          amount: 0,
          averageCost: 90,
          wasFullLotClose: false,
        },
      ],
    };
    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [orderWithMixedAllocations];
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([
        expect.objectContaining({
          id: 'ord-sell',
          type: 'SELL',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount: 0.4,
          limitPrice: 120,
          total: 48,
          timestamp: 5,
          status: 'OPEN',
          lotAllocations: [expect.objectContaining(validAllocation)],
        }),
      ]);
    });

    await waitFor(() => {
      expect(dbService.replaceAll).toHaveBeenCalledWith(
        'orders',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ord-sell',
            lotAllocations: [expect.objectContaining(validAllocation)],
          }),
        ])
      );
    });
  });

  it('preserves zero-sized cancelled orders during hydration so order history survives refreshes', async () => {
    const cancelledOrder = {
      id: 'ord-cancelled-zero',
      type: 'BUY' as const,
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0,
      limitPrice: 100,
      total: 0,
      timestamp: 5,
      status: 'CANCELLED' as const,
      updatedAt: 6,
    };

    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [cancelledOrder];
      return [];
    });

    renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(mockState.orders).toEqual([cancelledOrder]);
    });
  });

  it('blocks startup when open orders cannot be hydrated from IndexedDB', async () => {
    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') {
        throw new Error('idb unavailable');
      }

      return [];
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.initializationStage).toBe('hydration_error');
      expect(result.current.hydrationError).toMatchObject({
        code: 'orders_unavailable',
      });
    });

    expect(result.current.isHydrated).toBe(false);
    expect(marketEngineModule.useMarketEngine).toHaveBeenCalledWith(false);

    consoleSpy.mockRestore();
  });

  it('blocks startup when transaction history cannot be hydrated from IndexedDB', async () => {
    const staleOrders = [{ id: 'ord-old' }];
    const staleTransactions = [{ id: 'tx-old' }];

    localStorage.setItem('zerohue_orders', JSON.stringify(staleOrders));
    localStorage.setItem('zerohue_transactions', JSON.stringify(staleTransactions));
    vi.mocked(dbService.getAll).mockImplementation(async (storeName) => {
      if (storeName === 'orders') return [];
      if (storeName === 'transactions') {
        throw new Error('idb unavailable');
      }

      return [];
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppInitialization());

    await waitFor(() => {
      expect(result.current.initializationStage).toBe('hydration_error');
      expect(result.current.hydrationError).toMatchObject({
        code: 'transactions_unavailable',
      });
      expect(mockState.orders).toEqual([]);
      expect(mockState.transactions).toEqual([]);
    });

    expect(result.current.isHydrated).toBe(false);
    expect(marketEngineModule.useMarketEngine).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('zerohue_orders')).toBe(JSON.stringify(staleOrders));
    expect(localStorage.getItem('zerohue_transactions')).toBe(JSON.stringify(staleTransactions));

    consoleSpy.mockRestore();
  });
});
