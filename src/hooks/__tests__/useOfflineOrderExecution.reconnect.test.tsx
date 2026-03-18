import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOfflineOrderExecution } from '../useOfflineOrderExecution';
import {
  LAST_ONLINE_AT_KEY,
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
} from '../../constants/storage';
import * as useStoreModule from '../../store/useStore';
import { AppState } from '../../store/useStore';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { getBinanceConfig } from '../../utils/binanceConfig';

vi.mock('../../utils/binanceConfig', () => ({
  getBinanceConfig: vi.fn().mockResolvedValue({
    restBaseUrl: 'https://example.com',
    wsBaseUrl: 'wss://example.com',
    region: 'GLOBAL',
  }),
}));

vi.mock('../../utils/fetchWithRetry', () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../utils/mapWithConcurrency', () => ({
  mapWithConcurrency: async <T, R>(items: T[], _limit: number, mapper: (item: T) => Promise<R>) =>
    Promise.all(items.map((item) => mapper(item))),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('useOfflineOrderExecution reconnect behavior', () => {
  let mockState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    localStorage.setItem(LAST_ONLINE_AT_KEY, '1000');
    vi.mocked(getBinanceConfig).mockResolvedValue({
      restBaseUrl: 'https://example.com',
      wsBaseUrl: 'wss://example.com',
      region: 'GLOBAL',
    });
    vi.mocked(fetchWithRetry).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);

    mockState = {
      coins: [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          history: [50000],
          price: 50000,
          source: 'BINANCE',
          change24h: 0,
        },
      ],
      region: 'GLOBAL',
      binanceStatus: 'disconnected',
      coinbaseStatus: 'disconnected',
      engineStateVersion: 0,
      portfolio: {
        balance: 1000,
        initialBalance: 1000,
        holdings: [],
      },
      orders: [
        {
          id: 'offline-buy',
          type: 'BUY',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount: 1,
          limitPrice: 100,
          total: 100,
          timestamp: 1,
          status: 'OPEN',
        },
      ],
      transactions: [],
      setCoins: vi.fn(),
      setRegion: vi.fn(),
      setBinanceStatus: vi.fn(),
      setCoinbaseStatus: vi.fn(),
      setPortfolio: vi.fn(),
      setOrders: vi.fn(),
      setTransactions: vi.fn(),
      isResetModalOpen: false,
      setIsResetModalOpen: vi.fn(),
      selectedHoldingForEdit: null,
      setSelectedHoldingForEdit: vi.fn(),
    } as AppState;

    vi.spyOn(useStoreModule, 'useStore').mockImplementation(
      (selector?: (state: AppState) => unknown) => {
        if (typeof selector === 'function') return selector(mockState);
        return mockState;
      }
    );
    (
      useStoreModule.useStore as unknown as {
        getState: () => AppState;
        setState: (updater: AppState | ((state: AppState) => AppState)) => void;
      }
    ).getState = vi.fn(() => mockState);
    (
      useStoreModule.useStore as unknown as {
        getState: () => AppState;
        setState: (updater: AppState | ((state: AppState) => AppState)) => void;
      }
    ).setState = vi.fn((updater) => {
      const nextState = typeof updater === 'function' ? updater(mockState) : updater;
      if (nextState && nextState !== mockState) {
        mockState = nextState;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the initial offline replay without waiting for websocket connectivity', async () => {
    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });
  });

  it('bumps engineStateVersion when replay applies fills into the store', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([[2000, '0', '120', '90', '0']]),
    } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(mockState.transactions).toHaveLength(1);
    });

    expect(mockState.engineStateVersion).toBe(1);
  });

  it('retries the initial replay after a transient setup failure', async () => {
    vi.mocked(getBinanceConfig)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({
        restBaseUrl: 'https://example.com',
        wsBaseUrl: 'wss://example.com',
        region: 'GLOBAL',
      });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(
      () => {
        expect(getBinanceConfig).toHaveBeenCalledTimes(2);
        expect(fetchWithRetry).toHaveBeenCalledTimes(1);
      },
      { timeout: 4000 }
    );

    consoleSpy.mockRestore();
  });

  it('surfaces an initial replay error after repeated startup failures instead of spinning forever', async () => {
    vi.useFakeTimers();
    vi.mocked(getBinanceConfig).mockRejectedValue(new Error('binance unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useOfflineOrderExecution(true));

    await act(async () => {
      await Promise.resolve();
    });
    expect(getBinanceConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(getBinanceConfig).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getBinanceConfig).toHaveBeenCalledTimes(3);
    expect(result.current.initialReplayError).toMatchObject({
      sources: ['BINANCE'],
      attemptCount: 3,
    });
    expect(result.current.isInitialReplaySettled).toBe(false);

    consoleSpy.mockRestore();
  }, 10000);

  it('lets the user explicitly skip a failed initial replay and unblock startup', async () => {
    vi.useFakeTimers();
    vi.mocked(getBinanceConfig).mockRejectedValue(new Error('binance unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useOfflineOrderExecution(true));

    await act(async () => {
      await Promise.resolve();
    });
    expect(getBinanceConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(getBinanceConfig).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.initialReplayError).not.toBeNull();

    act(() => {
      result.current.skipInitialReplay();
    });

    expect(result.current.isInitialReplaySettled).toBe(true);
    expect(result.current.initialReplayError).toBeNull();

    consoleSpy.mockRestore();
  }, 10000);

  it('uses the source-specific last-online timestamp for Binance replay windows', async () => {
    localStorage.setItem(LAST_ONLINE_AT_KEY, '9000');
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, '1000');
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, '9000');

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });

    const [firstUrl] = vi.mocked(fetchWithRetry).mock.calls[0];
    expect(String(firstUrl)).toContain('startTime=1000');
  });

  it('does not fall back to the global last-online timestamp once source-aware keys exist', async () => {
    localStorage.setItem(LAST_ONLINE_AT_KEY, '9000');
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, '1000');

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });

    const [firstUrl] = vi.mocked(fetchWithRetry).mock.calls[0];
    expect(String(firstUrl)).toContain('startTime=1');
    expect(String(firstUrl)).not.toContain('startTime=9000');
  });

  it('still replays Coinbase orders when Binance setup fails', async () => {
    mockState.coins = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        history: [50000],
        price: 50000,
        source: 'BINANCE',
        change24h: 0,
      },
      {
        id: 'world-liberty-financial',
        symbol: 'WLFI',
        name: 'World Liberty Financial',
        history: [0.1],
        price: 0.1,
        source: 'COINBASE',
        change24h: 0,
      },
    ] as AppState['coins'];
    mockState.orders = [
      {
        id: 'offline-buy-binance',
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
        id: 'offline-buy-coinbase',
        type: 'BUY',
        coinId: 'world-liberty-financial',
        coinSymbol: 'WLFI',
        amount: 10,
        limitPrice: 0.09,
        total: 0.9,
        timestamp: 1,
        status: 'OPEN',
      },
    ] as AppState['orders'];

    vi.mocked(getBinanceConfig).mockRejectedValue(new Error('binance unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(
        vi
          .mocked(fetchWithRetry)
          .mock.calls.some(([url]) => String(url).includes('products/WLFI-USD/candles'))
      ).toBe(true);
    });

    consoleSpy.mockRestore();
  });

  it('retries a source when a symbol-level candle fetch fails before applying replay events', async () => {
    mockState.coins = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        history: [50000],
        price: 50000,
        source: 'BINANCE',
        change24h: 0,
      },
      {
        id: 'ethereum',
        symbol: 'ETH',
        name: 'Ethereum',
        history: [3000],
        price: 3000,
        source: 'BINANCE',
        change24h: 0,
      },
    ] as AppState['coins'];
    mockState.orders = [
      {
        id: 'offline-buy-btc',
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
        id: 'offline-buy-eth',
        type: 'BUY',
        coinId: 'ethereum',
        coinSymbol: 'ETH',
        amount: 1,
        limitPrice: 200,
        total: 200,
        timestamp: 1,
        status: 'OPEN',
      },
    ] as AppState['orders'];

    let ethFetchAttempts = 0;
    vi.mocked(fetchWithRetry).mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('symbol=BTCUSDT')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[2000, '0', '120', '90', '0']]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      if (requestUrl.includes('symbol=ETHUSDT')) {
        ethFetchAttempts += 1;
        if (ethFetchAttempts === 1) {
          return Promise.reject(new Error('temporary ETH candle failure'));
        }
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[3000, '0', '240', '180', '0']]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });
    expect(mockState.transactions).toHaveLength(0);

    await waitFor(
      () => {
        expect(fetchWithRetry).toHaveBeenCalledTimes(4);
        expect(mockState.transactions).toHaveLength(2);
      },
      { timeout: 4000 }
    );

    expect(mockState.transactions.map((tx) => tx.coinSymbol)).toEqual(['ETH', 'BTC']);
    expect(mockState.transactions.map((tx) => tx.timestamp)).toEqual([3000, 2000]);

    consoleSpy.mockRestore();
  });

  it('prepends offline replay transactions newest-first after chronological application', async () => {
    mockState.coins = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        history: [50000],
        price: 50000,
        source: 'BINANCE',
        change24h: 0,
      },
      {
        id: 'world-liberty-financial',
        symbol: 'WLFI',
        name: 'World Liberty Financial',
        history: [0.1],
        price: 0.1,
        source: 'COINBASE',
        change24h: 0,
      },
    ] as AppState['coins'];
    mockState.orders = [
      {
        id: 'offline-buy-binance',
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
        id: 'offline-buy-coinbase',
        type: 'BUY',
        coinId: 'world-liberty-financial',
        coinSymbol: 'WLFI',
        amount: 10,
        limitPrice: 0.05,
        total: 0.5,
        timestamp: 1,
        status: 'OPEN',
      },
    ] as AppState['orders'];
    vi.mocked(fetchWithRetry).mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('symbol=BTCUSDT')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[2000, '0', '120', '90', '0']]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      if (requestUrl.includes('products/WLFI-USD/candles')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[1, 0.01, 0.08, 0, 0, 0]]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
    });

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(mockState.transactions).toHaveLength(2);
    });

    expect(mockState.transactions.map((tx) => tx.coinSymbol)).toEqual(['BTC', 'WLFI']);
    expect(mockState.transactions.map((tx) => tx.timestamp)).toEqual([2000, 1000]);
  });

  it('replays each source independently when they reconnect at different times', async () => {
    mockState.coins = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        history: [50000],
        price: 50000,
        source: 'BINANCE',
        change24h: 0,
      },
      {
        id: 'world-liberty-financial',
        symbol: 'WLFI',
        name: 'World Liberty Financial',
        history: [0.1],
        price: 0.1,
        source: 'COINBASE',
        change24h: 0,
      },
    ] as AppState['coins'];
    mockState.orders = [
      {
        id: 'offline-buy-binance',
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
        id: 'offline-buy-coinbase',
        type: 'BUY',
        coinId: 'world-liberty-financial',
        coinSymbol: 'WLFI',
        amount: 10,
        limitPrice: 0.09,
        total: 0.9,
        timestamp: 1,
        status: 'OPEN',
      },
    ] as AppState['orders'];
    mockState.binanceStatus = 'connected';
    mockState.coinbaseStatus = 'connected';

    const { rerender } = renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    vi.mocked(fetchWithRetry).mockClear();

    mockState.binanceStatus = 'disconnected';
    mockState.coinbaseStatus = 'disconnected';
    rerender();

    mockState.binanceStatus = 'connected';
    rerender();

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });
    expect(String(vi.mocked(fetchWithRetry).mock.calls[0][0])).toContain('symbol=BTCUSDT');

    vi.mocked(fetchWithRetry).mockClear();

    mockState.coinbaseStatus = 'connected';
    rerender();

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });
    expect(String(vi.mocked(fetchWithRetry).mock.calls[0][0])).toContain(
      'products/WLFI-USD/candles'
    );
  });
});
