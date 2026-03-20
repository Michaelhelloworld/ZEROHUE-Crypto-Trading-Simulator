import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  __offlineReplayFetchTestUtils,
  useOfflineOrderExecution,
} from '../useOfflineOrderExecution';
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
          timestamp: Date.now() - 10 * 60 * 1000,
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

  it('rejects malformed replay candles before they can drive offline fills', () => {
    const malformedCandlesResult = __offlineReplayFetchTestUtils.normalizeFetchedReplayCandles(
      [
        {
          time: 0,
          open: 100,
          high: 90,
          low: 110,
          close: 100,
        },
      ],
      60_000,
      0,
      0
    );

    expect(malformedCandlesResult).toEqual({
      candles: [],
      failed: true,
    });
  });

  it('fills no-trade replay gaps with carry-forward candles but rejects discontinuous missing buckets', () => {
    const filledGapResult = __offlineReplayFetchTestUtils.normalizeFetchedReplayCandles(
      [
        {
          time: 0,
          open: 100,
          high: 105,
          low: 95,
          close: 101,
        },
        {
          time: 120_000,
          open: 101,
          high: 103,
          low: 100,
          close: 102,
        },
      ],
      60_000,
      0,
      120_000
    );

    expect(filledGapResult.failed).toBe(false);
    expect(filledGapResult.candles).toEqual([
      { time: 0, high: 105, low: 95 },
      { time: 60_000, high: 101, low: 101 },
      { time: 120_000, high: 103, low: 100 },
    ]);

    const discontinuousGapResult = __offlineReplayFetchTestUtils.normalizeFetchedReplayCandles(
      [
        {
          time: 0,
          open: 100,
          high: 105,
          low: 95,
          close: 101,
        },
        {
          time: 120_000,
          open: 110,
          high: 112,
          low: 109,
          close: 111,
        },
      ],
      60_000,
      0,
      120_000
    );

    expect(discontinuousGapResult).toEqual({
      candles: [],
      failed: true,
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
    const candleTime = Date.now() - 60_000;
    vi.mocked(fetchWithRetry).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([[candleTime, '100', '120', '90', '110']]),
    } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
    mockState.orders = [
      {
        ...mockState.orders[0],
        timestamp: candleTime,
      },
    ];

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
    const sourceSpecificStart = Date.now() - 5 * 60_000 - 12_345;
    const expectedStartTime = Math.floor(sourceSpecificStart / 60_000) * 60_000;
    localStorage.setItem(LAST_ONLINE_AT_KEY, String(sourceSpecificStart + 30_000));
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, String(sourceSpecificStart));
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, String(sourceSpecificStart + 30_000));

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });

    const [firstUrl] = vi.mocked(fetchWithRetry).mock.calls[0];
    expect(String(firstUrl)).toContain(`startTime=${expectedStartTime}`);
  });

  it('captures the initial last-online snapshot before the startup session can overwrite it', async () => {
    const sourceSpecificStart = Date.now() - 5 * 60_000 - 12_345;
    const expectedStartTime = Math.floor(sourceSpecificStart / 60_000) * 60_000;
    localStorage.setItem(LAST_ONLINE_AT_KEY, String(sourceSpecificStart + 30_000));
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, String(sourceSpecificStart));
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, String(sourceSpecificStart + 30_000));

    renderHook(() => useOfflineOrderExecution(true));
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, String(Date.now()));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });

    const [firstUrl] = vi.mocked(fetchWithRetry).mock.calls[0];
    expect(String(firstUrl)).toContain(`startTime=${expectedStartTime}`);
  });

  it('does not fall back to the global last-online timestamp once source-aware keys exist', async () => {
    localStorage.setItem(LAST_ONLINE_AT_KEY, '9000');
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, '1000');
    mockState.orders = [
      {
        ...mockState.orders[0],
        timestamp: 1,
      },
    ];

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    const requestUrls = vi.mocked(fetchWithRetry).mock.calls.map(([url]) => String(url));
    expect(
      requestUrls.some((url) => url.includes('interval=1h') && url.includes('startTime=0'))
    ).toBe(true);
    expect(requestUrls.some((url) => url.includes('startTime=9000'))).toBe(false);
  });

  it('rounds long replay windows down to the start of the hour bucket', async () => {
    const oldStart = Date.now() - (25 * 60 * 60 * 1000 + 12_345);
    const expectedHourStartTime = Math.floor(oldStart / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const expectedRecentStartTime =
      Math.floor((Date.now() - 24 * 60 * 60 * 1000) / (60 * 1000)) * (60 * 1000);
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, String(oldStart));
    mockState.orders = [
      {
        ...mockState.orders[0],
        timestamp: 1,
      },
    ];

    renderHook(() => useOfflineOrderExecution(true));

    await waitFor(() => {
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    const requestUrls = vi.mocked(fetchWithRetry).mock.calls.map(([url]) => String(url));
    expect(
      requestUrls.some(
        (url) => url.includes('interval=1h') && url.includes(`startTime=${expectedHourStartTime}`)
      )
    ).toBe(true);
    expect(
      requestUrls.some(
        (url) => url.includes('interval=1m') && url.includes(`startTime=${expectedRecentStartTime}`)
      )
    ).toBe(true);
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
    const currentMinuteStart = Math.floor(Date.now() / (60 * 1000)) * (60 * 1000);
    const btcCandleTime = currentMinuteStart - 2 * 60 * 1000;
    const ethCandleTime = currentMinuteStart - 60 * 1000;

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
        timestamp: btcCandleTime,
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
        timestamp: ethCandleTime,
        status: 'OPEN',
      },
    ] as AppState['orders'];

    let ethFetchAttempts = 0;
    vi.mocked(fetchWithRetry).mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('symbol=BTCUSDT')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[btcCandleTime, '100', '120', '90', '110']]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      if (requestUrl.includes('symbol=ETHUSDT')) {
        ethFetchAttempts += 1;
        if (ethFetchAttempts === 1) {
          return Promise.reject(new Error('temporary ETH candle failure'));
        }
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[ethCandleTime, '200', '240', '180', '220']]),
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
    expect(mockState.transactions.map((tx) => tx.timestamp)).toEqual([
      ethCandleTime,
      btcCandleTime,
    ]);

    consoleSpy.mockRestore();
  });

  it('prepends offline replay transactions newest-first after chronological application', async () => {
    const currentMinuteStart = Math.floor(Date.now() / (60 * 1000)) * (60 * 1000);
    const btcCandleTime = currentMinuteStart - 2 * 60 * 1000;
    const coinbaseCandleTime = currentMinuteStart - 60 * 1000;

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
        timestamp: btcCandleTime,
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
        timestamp: coinbaseCandleTime,
        status: 'OPEN',
      },
    ] as AppState['orders'];
    vi.mocked(fetchWithRetry).mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('symbol=BTCUSDT')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[btcCandleTime, '100', '120', '90', '110']]),
        } as unknown as Awaited<ReturnType<typeof fetchWithRetry>>);
      }
      if (requestUrl.includes('products/WLFI-USD/candles')) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([[coinbaseCandleTime / 1000, 0.01, 0.08, 0.05, 0.06, 0]]),
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

    expect(mockState.transactions.map((tx) => tx.coinSymbol)).toEqual(['WLFI', 'BTC']);
    expect(mockState.transactions.map((tx) => tx.timestamp)).toEqual([
      coinbaseCandleTime,
      btcCandleTime,
    ]);
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
        timestamp: Date.now() - 5 * 60 * 1000,
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
        timestamp: Date.now() - 5 * 60 * 1000,
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
