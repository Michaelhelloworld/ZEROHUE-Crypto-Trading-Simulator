import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMarketData } from '../useMarketData';
import { dbService } from '../../services/db';
import { useMarketExecutionStore } from '../../store/useMarketExecutionStore';
import { usePersistenceEpochStore } from '../../store/usePersistenceEpochStore';
import * as useStoreModule from '../../store/useStore';
import { AppState } from '../../store/useStore';
import { LAST_ONLINE_AT_BINANCE_KEY, LAST_ONLINE_AT_COINBASE_KEY } from '../../constants/storage';

// Mock DB and fetch
vi.mock('../../services/db', () => ({
  dbService: {
    getAll: vi.fn(),
    bulkPut: vi.fn(),
    pruneHistory: vi.fn(),
  },
}));

global.fetch = vi.fn();

// Mock WebSocket with state tracking
let wsInstances: MockWebSocket[] = [];
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn(() => {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  });
  send = vi.fn();
  readyState = 1; // OPEN
  constructor(public url: string) {
    wsInstances.push(this);
    // Simulate connection after a tick
    setTimeout(() => this.onopen?.(), 0);
  }
}
global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe('useMarketData', () => {
  let mockState: AppState;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000 * 60);
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.clear();
    wsInstances = [];
    useMarketExecutionStore.getState().resetExecutableSources();
    usePersistenceEpochStore.getState().reset();

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
      binanceStatus: 'disconnected',
      coinbaseStatus: 'disconnected',
      setCoins: vi.fn((updater) => {
        if (typeof updater === 'function') {
          mockState.coins = updater(mockState.coins);
        } else {
          mockState.coins = updater;
        }
      }),
      setBinanceStatus: vi.fn((status) => {
        mockState.binanceStatus =
          typeof status === 'function' ? status(mockState.binanceStatus) : status;
      }),
      setCoinbaseStatus: vi.fn((status) => {
        mockState.coinbaseStatus =
          typeof status === 'function' ? status(mockState.coinbaseStatus) : status;
      }),
      setRegion: vi.fn(),
    } as unknown as AppState;

    vi.spyOn(useStoreModule, 'useStore').mockImplementation(
      (selector?: (state: AppState) => unknown) => {
        if (typeof selector === 'function') return selector(mockState);
        return mockState;
      }
    );
    (useStoreModule.useStore as unknown as { getState: () => AppState }).getState = vi.fn(
      () => mockState
    );

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });
    (dbService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dbService.bulkPut as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should load initial cache and update coins', async () => {
    const cached = [{ coinId: 'bitcoin', history: [45000, 46000], lastUpdated: 0 }];
    (dbService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(cached);

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(10); // Trigger useEffect async calls
    });

    expect(mockState.coins[0].price).toBe(46000);
    expect(mockState.coins[0].history).toEqual([45000, 46000]);
  });

  it('should connect Binance websocket before the initial history request finishes', async () => {
    const pendingHistoryRequest = new Promise<Response>(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('country.is')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ country: 'US' }),
          });
        }
        if (url.includes('/api/v3/klines')) {
          return pendingHistoryRequest;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([]),
        });
      }
    );

    const { unmount } = renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(50);
    });

    expect(wsInstances.some((ws) => ws.url.includes('stream.binance'))).toBe(true);
    unmount();
  });

  it('should preserve a live Binance tick when the initial history response resolves later', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    let resolveBtcHistory: ((response: Response) => void) | null = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('country.is')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ country: 'US' }),
          });
        }
        if (url.includes('symbol=BTCUSDT')) {
          return new Promise<Response>((resolve) => {
            resolveBtcHistory = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([]),
        });
      }
    );

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      await vi.advanceTimersByTime(1);
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            E: 61_000,
            s: 'BTCUSDT',
            c: '51000',
            P: '2.0',
          },
        }),
      });
    });

    expect(mockState.coins[0].price).toBe(51000);

    await act(async () => {
      resolveBtcHistory?.({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          [0, '0', '0', '0', '49000'],
          [1, '0', '0', '0', '50000'],
        ]),
      } as unknown as Response);
      await Promise.resolve();
    });

    expect(mockState.coins[0].price).toBe(51000);
    expect(mockState.coins[0].history).toEqual([49000, 51000]);
    expect(mockState.coins[0].change24h).toBe(2.0);
  });

  it('should handle Binance WebSocket ticker messages', async () => {
    // Inject requestAnimationFrame mock to execute callback immediately
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    // Wait for WS to be created
    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    // Simulate Binance Ticker message
    const msg = {
      data: {
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: '51000',
        P: '2.0',
      },
    };

    await act(async () => {
      binanceWs.onmessage!({ data: JSON.stringify(msg) });
    });

    expect(mockState.coins[0].price).toBe(51000);
    expect(mockState.coins[0].change24h).toBe(2.0);
  });

  it('should apply multiple same-symbol ticker updates in arrival order within one animation frame', async () => {
    let queuedFrame: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = cb;
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const setCoinsMock = mockState.setCoins as unknown as ReturnType<typeof vi.fn>;
    setCoinsMock.mockClear();

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '49999',
            P: '-0.1',
          },
        }),
      });
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '50001',
            P: '0.1',
          },
        }),
      });
    });

    expect(setCoinsMock).not.toHaveBeenCalled();

    await act(async () => {
      queuedFrame?.(0);
    });

    expect(setCoinsMock).toHaveBeenCalledTimes(2);
    expect(setCoinsMock.mock.calls[0][0][0].price).toBe(49999);
    expect(setCoinsMock.mock.calls[1][0][0].price).toBe(50001);
    expect(mockState.coins[0].price).toBe(50001);
  });

  it('flushes queued ticks into store state when the document becomes hidden', async () => {
    let queuedFrame: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = cb;
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const setCoinsMock = mockState.setCoins as unknown as ReturnType<typeof vi.fn>;
    setCoinsMock.mockClear();

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '51000',
            P: '2.0',
          },
        }),
      });
    });

    expect(setCoinsMock).not.toHaveBeenCalled();
    expect(mockState.coins[0].price).toBe(50000);
    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeNull();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(setCoinsMock).toHaveBeenCalledTimes(1);
    expect(mockState.coins[0].price).toBe(51000);
    expect(dbService.bulkPut).toHaveBeenCalled();
    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeTruthy();

    await act(async () => {
      queuedFrame?.(0);
    });

    expect(setCoinsMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('should compute Coinbase 24h change from open_24h in ticker payload', async () => {
    mockState.coins = [
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

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const coinbaseWs = wsInstances.find((ws) => ws.url.includes('ws-feed.exchange.coinbase.com'));
    expect(coinbaseWs).toBeDefined();
    if (!coinbaseWs) throw new Error('coinbase ws is null');

    const msg = {
      type: 'ticker',
      product_id: 'WLFI-USD',
      price: '0.0973',
      open_24h: '0.0928',
    };

    await act(async () => {
      coinbaseWs.onmessage!({ data: JSON.stringify(msg) });
    });

    expect(mockState.coins[0].price).toBe(0.0973);
    expect(mockState.coins[0].change24h).toBeCloseTo(4.8491379, 5);
  });

  it('should persist separate last-online timestamps for each market source', async () => {
    let queuedFrame: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = cb;
      return 1;
    });

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
    ] as unknown as AppState['coins'];

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    const coinbaseWs = wsInstances.find((ws) => ws.url.includes('ws-feed.exchange.coinbase.com'));
    expect(binanceWs).toBeDefined();
    expect(coinbaseWs).toBeDefined();
    if (!binanceWs || !coinbaseWs) throw new Error('expected both ws connections');

    await act(async () => {
      binanceWs.onopen?.();
      coinbaseWs.onopen?.();
    });

    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_ONLINE_AT_COINBASE_KEY)).toBeNull();

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            E: 61_000,
            s: 'BTCUSDT',
            c: '51000',
            P: '2.0',
          },
        }),
      });
      queuedFrame?.(0);
    });

    await act(async () => {
      await vi.advanceTimersByTime(1);
      coinbaseWs.onmessage?.({
        data: JSON.stringify({
          type: 'ticker',
          product_id: 'WLFI-USD',
          sequence: 10,
          time: new Date(62_000).toISOString(),
          price: '0.095',
          open_24h: '0.0928',
        }),
      });
      queuedFrame?.(0);
    });

    const initialBinanceTimestamp = localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY);
    const initialCoinbaseTimestamp = localStorage.getItem(LAST_ONLINE_AT_COINBASE_KEY);
    expect(initialBinanceTimestamp).toBeTruthy();
    expect(initialCoinbaseTimestamp).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTime(16000);
      coinbaseWs.onmessage?.({
        data: JSON.stringify({
          type: 'ticker',
          product_id: 'WLFI-USD',
          sequence: 20,
          time: new Date(78_000).toISOString(),
          price: '0.0973',
          open_24h: '0.0928',
        }),
      });
      queuedFrame?.(0);
    });

    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBe(initialBinanceTimestamp);
    expect(localStorage.getItem(LAST_ONLINE_AT_COINBASE_KEY)).not.toBe(initialCoinbaseTimestamp);
  });

  it('should ignore Binance ticker messages with invalid numeric fields', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    const prevPrice = mockState.coins[0].price;
    const prevChange = mockState.coins[0].change24h;

    const badMsg = {
      data: {
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: 'not-a-number',
        P: 'oops',
      },
    };

    await act(async () => {
      binanceWs.onmessage!({ data: JSON.stringify(badMsg) });
    });

    expect(mockState.coins[0].price).toBe(prevPrice);
    expect(mockState.coins[0].change24h).toBe(prevChange);
  });

  it('ignores out-of-order Binance live ticks based on exchange event time', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            E: 2000,
            s: 'BTCUSDT',
            c: '52000',
            P: '4.0',
          },
        }),
      });
    });

    expect(mockState.coins[0].price).toBe(52000);

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            E: 1500,
            s: 'BTCUSDT',
            c: '48000',
            P: '-4.0',
          },
        }),
      });
    });

    expect(mockState.coins[0].price).toBe(52000);
  });

  it('ignores out-of-order Coinbase live ticks based on sequence numbers', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    mockState.coins = [
      {
        id: 'world-liberty-financial',
        symbol: 'WLFI',
        name: 'World Liberty Financial',
        history: [0.1],
        price: 0.1,
        source: 'COINBASE',
        change24h: 0,
      },
    ] as unknown as AppState['coins'];

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const coinbaseWs = wsInstances.find((ws) => ws.url.includes('ws-feed.exchange.coinbase.com'));
    expect(coinbaseWs).toBeDefined();
    if (!coinbaseWs) throw new Error('coinbase ws is null');

    await act(async () => {
      coinbaseWs.onmessage?.({
        data: JSON.stringify({
          type: 'ticker',
          product_id: 'WLFI-USD',
          sequence: 20,
          time: new Date(2000).toISOString(),
          price: '0.12',
          open_24h: '0.10',
        }),
      });
    });

    expect(mockState.coins[0].price).toBe(0.12);

    await act(async () => {
      coinbaseWs.onmessage?.({
        data: JSON.stringify({
          type: 'ticker',
          product_id: 'WLFI-USD',
          sequence: 10,
          time: new Date(1500).toISOString(),
          price: '0.08',
          open_24h: '0.10',
        }),
      });
    });

    expect(mockState.coins[0].price).toBe(0.12);
  });

  it('should roll the 24h history window forward when a session stays open across hour buckets', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      await vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '53000',
          },
        }),
      });
    });

    expect(mockState.coins[0].history).toEqual([50000, 50000, 53000]);
    expect(mockState.coins[0].change24h).toBeCloseTo(6, 5);
  });

  it('should reconnect a stalled Binance feed even when Coinbase is still active', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    const coinbaseWs = wsInstances.find((ws) => ws.url.includes('ws-feed.exchange.coinbase.com'));
    expect(binanceWs).toBeDefined();
    expect(coinbaseWs).toBeDefined();
    if (!binanceWs || !coinbaseWs) throw new Error('expected both ws connections');

    await act(async () => {
      await vi.advanceTimersByTime(20000);
      coinbaseWs.onmessage?.({
        data: JSON.stringify({
          type: 'ticker',
          product_id: 'WLFI-USD',
          price: '0.0973',
          open_24h: '0.0928',
        }),
      });
      await vi.advanceTimersByTime(20000);
    });

    expect(binanceWs.close).toHaveBeenCalledTimes(1);
    expect(coinbaseWs.close).not.toHaveBeenCalled();
  });

  it('keeps Binance prices non-executable until the first live ticker arrives, then clears readiness on disconnect', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    expect(useMarketExecutionStore.getState().executableSources.BINANCE).toBe(false);

    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(binanceWs).toBeDefined();
    if (!binanceWs) throw new Error('binance ws is null');

    await act(async () => {
      binanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '51000',
            P: '2.0',
          },
        }),
      });
    });

    expect(useMarketExecutionStore.getState().executableSources.BINANCE).toBe(true);

    await act(async () => {
      binanceWs.onclose?.();
    });

    expect(useMarketExecutionStore.getState().executableSources.BINANCE).toBe(false);
  });

  it('should refresh Binance history after a reconnect to backfill missing buckets', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    let btcHistoryFetchCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('country.is')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ country: 'US' }),
          });
        }

        if (url.includes('symbol=BTCUSDT')) {
          btcHistoryFetchCount += 1;
          const payload =
            btcHistoryFetchCount === 1
              ? [
                  [0, '0', '0', '0', '49000'],
                  [1, '0', '0', '0', '50000'],
                ]
              : [
                  [0, '0', '0', '0', '49500'],
                  [1, '0', '0', '0', '51000'],
                ];

          return Promise.resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(payload),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([]),
        });
      }
    );

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    expect(mockState.coins[0].history).toEqual([49000, 50000]);
    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeNull();

    const originalBinanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(originalBinanceWs).toBeDefined();
    if (!originalBinanceWs) throw new Error('binance ws is null');

    await act(async () => {
      originalBinanceWs.onclose?.();
      await vi.advanceTimersByTime(3000);
    });

    const reconnectedBinanceWs = wsInstances
      .filter((ws) => ws.url.includes('stream.binance'))
      .at(-1);
    expect(reconnectedBinanceWs).toBeDefined();
    expect(reconnectedBinanceWs).not.toBe(originalBinanceWs);

    await act(async () => {
      reconnectedBinanceWs?.onopen?.();
      await vi.advanceTimersByTime(200);
    });

    expect(btcHistoryFetchCount).toBeGreaterThanOrEqual(2);
    expect(mockState.coins[0].history).toEqual([49500, 51000]);
    expect(mockState.coins[0].price).toBe(50000);
    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeTruthy();
  });

  it('does not let a late reconnect backfill move the Binance replay watermark backwards', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    let btcHistoryFetchCount = 0;
    let resolveReconnectHistory: ((response: Response) => void) | null = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('country.is')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ country: 'US' }),
          });
        }

        if (url.includes('symbol=BTCUSDT')) {
          btcHistoryFetchCount += 1;
          if (btcHistoryFetchCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: vi.fn().mockResolvedValue([
                [0, '0', '0', '0', '49000'],
                [1, '0', '0', '0', '50000'],
              ]),
            });
          }

          return new Promise<Response>((resolve) => {
            resolveReconnectHistory = resolve;
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([]),
        });
      }
    );

    renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const originalBinanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    expect(originalBinanceWs).toBeDefined();
    if (!originalBinanceWs) throw new Error('binance ws is null');

    await act(async () => {
      originalBinanceWs.onclose?.();
      await vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTime(10);
    });

    const reconnectedBinanceWs = wsInstances
      .filter((ws) => ws.url.includes('stream.binance'))
      .at(-1);
    expect(reconnectedBinanceWs).toBeDefined();
    if (!reconnectedBinanceWs) throw new Error('reconnected binance ws is null');

    await act(async () => {
      await vi.advanceTimersByTime(50);
      reconnectedBinanceWs.onmessage?.({
        data: JSON.stringify({
          data: {
            e: '24hrTicker',
            s: 'BTCUSDT',
            c: '52000',
            P: '4.0',
          },
        }),
      });
    });

    const watermarkAfterLiveTick = Number(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY));
    expect(Number.isFinite(watermarkAfterLiveTick)).toBe(true);

    await act(async () => {
      resolveReconnectHistory?.({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          [0, '0', '0', '0', '49500'],
          [1, '0', '0', '0', '51000'],
        ]),
      } as unknown as Response);
      await Promise.resolve();
    });

    expect(Number(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY))).toBe(watermarkAfterLiveTick);

    randomSpy.mockRestore();
  });

  it('should not schedule reconnect after unmount when sockets close', async () => {
    const { unmount } = renderHook(() => useMarketData());

    await act(async () => {
      await vi.advanceTimersByTime(200);
    });

    const initialCount = wsInstances.length;
    const binanceWs = wsInstances.find((ws) => ws.url.includes('stream.binance'));
    const coinbaseWs = wsInstances.find((ws) => ws.url.includes('ws-feed.exchange.coinbase.com'));
    expect(binanceWs).toBeDefined();
    expect(coinbaseWs).toBeDefined();
    if (!binanceWs || !coinbaseWs) throw new Error('expected both ws connections');

    unmount();

    await act(async () => {
      binanceWs.onclose?.();
      coinbaseWs.onclose?.();
      await vi.advanceTimersByTime(70000);
    });

    expect(wsInstances).toHaveLength(initialCount);
  });
});
