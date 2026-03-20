import { useEffect, useCallback, useRef } from 'react';
import { Coin } from '../types';
import { INITIAL_COINS } from '../constants/data';
import {
  LAST_ONLINE_AT_KEY,
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
} from '../constants/storage';
import { clearBinanceRegionCache, getBinanceConfig } from '../utils/binanceConfig';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { dbService } from '../services/db';
import { useMarketExecutionStore } from '../store/useMarketExecutionStore';
import { useStore } from '../store/useStore';
import { isCurrentTabPersistenceWritable } from '../utils/persistenceEpoch';
import { safeStorage } from '../utils/safeStorage';
import {
  applyQueuedUpdatesToCoins,
  buildHistorySavePayload,
  getHistoryBucketStart,
  LiveUpdateSnapshot,
  mergeHistoricalSnapshot as mergeMarketHistorySnapshot,
} from '../utils/marketHistory';

const BINANCE_COINS = INITIAL_COINS.filter((c) => c.source !== 'COINBASE');
const COINBASE_COINS = INITIAL_COINS.filter((c) => c.source === 'COINBASE');
const INIT_FETCH_CONCURRENCY = 3;
type MarketSource = 'BINANCE' | 'COINBASE';
interface PendingMarketUpdate {
  symbol: string;
  data: { price: number; change?: number };
  receivedAt: number;
  source: MarketSource;
}

export const useMarketData = () => {
  const coins = useStore((state) => state.coins);
  const setCoins = useStore((state) => state.setCoins);
  const setBinanceStatus = useStore((state) => state.setBinanceStatus);
  const setCoinbaseStatus = useStore((state) => state.setCoinbaseStatus);
  const setRegion = useStore((state) => state.setRegion);
  const setSourceExecutable = useMarketExecutionStore((state) => state.setSourceExecutable);
  const resetExecutableSources = useMarketExecutionStore((state) => state.resetExecutableSources);

  // Use a ref for pending updates to batch them with RequestAnimationFrame
  const pendingUpdates = useRef<PendingMarketUpdate[]>([]);
  const latestLiveUpdatesRef = useRef(new Map<string, LiveUpdateSnapshot>());
  const lastAppliedSnapshotStartRef = useRef(new Map<string, number>());
  const historyBucketStartRef = useRef(new Map<string, number>());
  const rafId = useRef<number | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const lastOnlineAtSaveRef = useRef<{ global: number; BINANCE: number; COINBASE: number }>({
    global: 0,
    BINANCE: 0,
    COINBASE: 0,
  });
  const binanceWSRef = useRef<WebSocket | null>(null);
  const coinbaseWSRef = useRef<WebSocket | null>(null);
  // Watchdog & Interval tracking
  const lastBinanceMessageTime = useRef<number>(Date.now());
  const lastCoinbaseMessageTime = useRef<number>(Date.now());
  const pruneCounter = useRef<number>(0);
  const lastBinanceEventTimeRef = useRef(new Map<string, number>());
  const lastCoinbaseEventRef = useRef(
    new Map<string, { sequence: number | null; eventTime: number | null }>()
  );

  const persistHistorySnapshot = useCallback(
    (coinsSnapshot: Coin[], now: number, force = false) => {
      if (!force && now - lastSaveTimeRef.current <= 10000) {
        return;
      }

      lastSaveTimeRef.current = now;
      const historyToSave = buildHistorySavePayload(coinsSnapshot, now);

      dbService
        .bulkPut('market_history', historyToSave)
        .catch((e) => console.error('Failed to save history', e));

      pruneCounter.current++;
      if (pruneCounter.current >= 360) {
        pruneCounter.current = 0;
        dbService.pruneHistory(7).catch(() => {});
      }
    },
    []
  );

  const cancelScheduledFlush = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const persistLastOnlineAt = useCallback(
    (source: MarketSource, timestamp = Date.now(), force = false) => {
      if (typeof window === 'undefined') return;
      if (!isCurrentTabPersistenceWritable()) return;

      try {
        const sourceKey =
          source === 'BINANCE' ? LAST_ONLINE_AT_BINANCE_KEY : LAST_ONLINE_AT_COINBASE_KEY;
        const latestSourceTimestamp = Math.max(lastOnlineAtSaveRef.current[source], timestamp);
        const latestGlobalTimestamp = Math.max(lastOnlineAtSaveRef.current.global, timestamp);

        if (
          latestSourceTimestamp > lastOnlineAtSaveRef.current[source] &&
          (force || timestamp - lastOnlineAtSaveRef.current[source] >= 15000)
        ) {
          lastOnlineAtSaveRef.current[source] = latestSourceTimestamp;
          safeStorage.setItem(sourceKey, String(latestSourceTimestamp));
        }

        if (
          latestGlobalTimestamp > lastOnlineAtSaveRef.current.global &&
          (force || timestamp - lastOnlineAtSaveRef.current.global >= 15000)
        ) {
          lastOnlineAtSaveRef.current.global = latestGlobalTimestamp;
          safeStorage.setItem(LAST_ONLINE_AT_KEY, String(latestGlobalTimestamp));
        }
      } catch {
        // Ignore storage failures; replay will fall back to order/holding timestamps.
      }
    },
    []
  );

  const flushUpdates = useCallback(
    (forcePersist = false) => {
      if (pendingUpdates.current.length === 0) return;

      const queuedUpdates = pendingUpdates.current.splice(0, pendingUpdates.current.length);
      const latestSourceWatermarks: Record<MarketSource, number> = {
        BINANCE: 0,
        COINBASE: 0,
      };

      const now = Date.now();
      let nextCoins: Coin[] = useStore.getState().coins;
      let nextHistoryBucketStarts = new Map(historyBucketStartRef.current);

      // Apply queued market ticks in-order so intra-frame price touches still reach the engine.
      for (const queuedUpdate of queuedUpdates) {
        latestSourceWatermarks[queuedUpdate.source] = Math.max(
          latestSourceWatermarks[queuedUpdate.source],
          queuedUpdate.receivedAt
        );
        const appliedUpdates = applyQueuedUpdatesToCoins(
          nextCoins,
          new Map([[queuedUpdate.symbol, queuedUpdate.data]]),
          latestLiveUpdatesRef.current,
          queuedUpdate.receivedAt,
          nextHistoryBucketStarts
        );

        nextHistoryBucketStarts = appliedUpdates.historyBucketStarts;
        nextCoins = appliedUpdates.coins;
        setCoins(nextCoins);
      }

      historyBucketStartRef.current = nextHistoryBucketStarts;

      (Object.entries(latestSourceWatermarks) as Array<[MarketSource, number]>).forEach(
        ([source, watermark]) => {
          if (watermark > 0) {
            persistLastOnlineAt(source, watermark, forcePersist);
          }
        }
      );

      persistHistorySnapshot(nextCoins, now, forcePersist);
    },
    [persistHistorySnapshot, persistLastOnlineAt, setCoins]
  );

  const queueUpdate = useCallback(
    (
      symbol: string,
      data: { price: number; change?: number },
      receivedAt = Date.now(),
      source: MarketSource
    ) => {
      latestLiveUpdatesRef.current.set(symbol, {
        price: data.price,
        change: data.change,
        receivedAt,
      });
      pendingUpdates.current.push({ symbol, data, receivedAt, source });
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          flushUpdates();
        });
      }
    },
    [flushUpdates]
  );

  const mergeHistoricalSnapshot = useCallback(
    (
      coin: Coin,
      history: number[],
      requestStartedAt: number,
      historyTimestamp = requestStartedAt,
      options?: { preserveCurrentPrice?: boolean }
    ) => {
      const mergeResult = mergeMarketHistorySnapshot({
        coin,
        history,
        requestStartedAt,
        historyTimestamp,
        lastAppliedStart: lastAppliedSnapshotStartRef.current.get(coin.symbol),
        liveUpdate: latestLiveUpdatesRef.current.get(coin.symbol),
      });

      if (mergeResult.applied) {
        lastAppliedSnapshotStartRef.current.set(
          coin.symbol,
          mergeResult.appliedRequestStart ?? requestStartedAt
        );
      }
      if (mergeResult.bucketStart !== undefined) {
        historyBucketStartRef.current.set(coin.symbol, mergeResult.bucketStart);
      }

      if (options?.preserveCurrentPrice && Number.isFinite(coin.price) && coin.price > 0) {
        const openPrice = mergeResult.coin.history[0] ?? coin.price;
        return {
          ...mergeResult.coin,
          price: coin.price,
          change24h:
            openPrice === 0
              ? mergeResult.coin.change24h
              : ((coin.price - openPrice) / openPrice) * 100,
        };
      }

      return mergeResult.coin;
    },
    []
  );

  const shouldAcceptBinanceEvent = useCallback((symbol: string, eventTime: number | null) => {
    if (!eventTime || !Number.isFinite(eventTime) || eventTime <= 0) {
      return true;
    }

    const previousEventTime = lastBinanceEventTimeRef.current.get(symbol);
    if (previousEventTime !== undefined && eventTime <= previousEventTime) {
      return false;
    }

    lastBinanceEventTimeRef.current.set(symbol, eventTime);
    return true;
  }, []);

  const shouldAcceptCoinbaseEvent = useCallback(
    (symbol: string, sequence: number | null, eventTime: number | null) => {
      const previousEvent = lastCoinbaseEventRef.current.get(symbol);

      if (sequence && Number.isFinite(sequence) && sequence > 0) {
        if (previousEvent?.sequence !== null && previousEvent?.sequence !== undefined) {
          if (sequence <= previousEvent.sequence) {
            return false;
          }
        }

        lastCoinbaseEventRef.current.set(symbol, {
          sequence,
          eventTime:
            eventTime && Number.isFinite(eventTime) && eventTime > 0
              ? eventTime
              : (previousEvent?.eventTime ?? null),
        });
        return true;
      }

      if (eventTime && Number.isFinite(eventTime) && eventTime > 0) {
        if (previousEvent?.eventTime !== null && previousEvent?.eventTime !== undefined) {
          if (eventTime <= previousEvent.eventTime) {
            return false;
          }
        }

        lastCoinbaseEventRef.current.set(symbol, {
          sequence: previousEvent?.sequence ?? null,
          eventTime,
        });
      }

      return true;
    },
    []
  );

  useEffect(() => {
    resetExecutableSources();

    return () => {
      resetExecutableSources();
    };
  }, [resetExecutableSources]);

  useEffect(() => {
    const currentBucketStart = getHistoryBucketStart(Date.now());
    coins.forEach((coin) => {
      if (coin.history.length > 0 && !historyBucketStartRef.current.has(coin.symbol)) {
        historyBucketStartRef.current.set(coin.symbol, currentBucketStart);
      }
    });
  }, [coins]);

  // --- Market Data Initialization (Cache First) ---
  useEffect(() => {
    const loadCache = async () => {
      const requestStartedAt = Date.now();
      try {
        const cachedHistory = await dbService.getAll('market_history');
        if (cachedHistory && cachedHistory.length > 0) {
          setCoins((prevCoins) =>
            prevCoins.map((coin) => {
              const cache = cachedHistory.find((c) => c.coinId === coin.id);
              if (cache && cache.history.length > 0) {
                return mergeHistoricalSnapshot(
                  coin,
                  cache.history,
                  requestStartedAt,
                  cache.lastUpdated
                );
              }
              return coin;
            })
          );
        }
      } catch (err) {
        console.error('Failed to load market data cache', err);
      }
    };

    loadCache();
  }, [mergeHistoricalSnapshot, setCoins]);

  // --- Binance Flow ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    let hasConnectedOnce = false;
    const shouldInvalidateRegionCache = (attempts: number) => attempts === 3 || attempts % 10 === 0;

    const scheduleBinanceReconnect = () => {
      if (!isMounted) return;
      setSourceExecutable('BINANCE', false);
      setBinanceStatus('disconnected');
      const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      reconnectAttempts++;
      if (shouldInvalidateRegionCache(reconnectAttempts)) {
        clearBinanceRegionCache();
        console.warn(
          `[Binance] Reconnect failed ${reconnectAttempts} times. Cleared region cache for re-detection.`
        );
      }
      reconnectTimeout = setTimeout(() => {
        void connectBinance();
      }, delay);
    };

    const fetchBinanceHistory = async (options?: {
      advanceReplayWatermark?: boolean;
      preserveCurrentPrice?: boolean;
    }) => {
      const requestStartedAt = Date.now();
      try {
        const config = await getBinanceConfig();
        setRegion(config.region);

        const results = await mapWithConcurrency(
          BINANCE_COINS,
          INIT_FETCH_CONCURRENCY,
          async (coin) => {
            try {
              const res = await fetchWithRetry(
                `${config.restBaseUrl}/api/v3/klines?symbol=${coin.symbol}USDT&interval=1h&limit=24`,
                undefined,
                { retries: 2, baseDelayMs: 500, timeoutMs: 8000 }
              );
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              const data = await res.json();
              if (!Array.isArray(data)) return null;
              const history = data
                .map((k: (string | number)[]) => parseFloat(k[4] as string))
                .filter((price) => Number.isFinite(price));
              return { symbol: coin.symbol, history };
            } catch (e) {
              console.error(`Failed to fetch Binance history for ${coin.symbol}`, e);
              return null;
            }
          }
        );

        const didReceiveHistory = results.some((result) => result && result.history.length > 0);

        setCoins((prevCoins) =>
          prevCoins.map((coin) => {
            if (coin.source === 'COINBASE') return coin;
            const match = results.find((r) => r?.symbol === coin.symbol);
            if (match && match.history.length > 0) {
              return mergeHistoricalSnapshot(
                coin,
                match.history,
                requestStartedAt,
                requestStartedAt,
                {
                  preserveCurrentPrice: options?.preserveCurrentPrice,
                }
              );
            }
            return coin;
          })
        );

        if (options?.advanceReplayWatermark && didReceiveHistory) {
          persistLastOnlineAt('BINANCE', requestStartedAt, true);
        }
      } catch (err) {
        console.error('Error in Binance init', err);
      }
    };

    const connectBinance = async () => {
      setBinanceStatus('connecting');

      try {
        const config = await getBinanceConfig();
        if (!isMounted) return;

        setRegion(config.region);
        const streams = BINANCE_COINS.map((c) => `${c.symbol.toLowerCase()}usdt@ticker`).join('/');

        const wsUrl = `${config.wsBaseUrl}/stream?streams=${streams}`;
        ws = new WebSocket(wsUrl);
        binanceWSRef.current = ws;

        ws.onopen = () => {
          const shouldRefreshHistory = hasConnectedOnce;
          hasConnectedOnce = true;
          setSourceExecutable('BINANCE', false);
          setBinanceStatus('connected');
          reconnectAttempts = 0;
          lastBinanceMessageTime.current = Date.now();
          if (shouldRefreshHistory) {
            void fetchBinanceHistory({
              advanceReplayWatermark: true,
              preserveCurrentPrice: true,
            });
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.data && message.data.e === '24hrTicker') {
              const data = message.data;
              const symbol = data.s.replace('USDT', '');
              const price = parseFloat(data.c);
              if (!Number.isFinite(price)) return;
              const eventTime = Number(data.E);
              if (
                !shouldAcceptBinanceEvent(
                  symbol,
                  Number.isFinite(eventTime) && eventTime > 0 ? eventTime : null
                )
              ) {
                return;
              }
              const parsedChange = parseFloat(data.P);
              const change = Number.isFinite(parsedChange) ? parsedChange : undefined;

              const receivedAt = Date.now();
              lastBinanceMessageTime.current = receivedAt; // Heartbeat update
              setSourceExecutable('BINANCE', true);

              queueUpdate(
                symbol,
                {
                  price,
                  change,
                },
                receivedAt,
                'BINANCE'
              );
            }
          } catch (err) {
            console.error('Binance WS parse error', err);
          }
        };

        ws.onerror = () => {
          setSourceExecutable('BINANCE', false);
          setBinanceStatus('disconnected');
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setSourceExecutable('BINANCE', false);
          scheduleBinanceReconnect();
        };
      } catch (error) {
        console.error('Failed to connect Binance websocket', error);
        setSourceExecutable('BINANCE', false);
        scheduleBinanceReconnect();
      }
    };

    void fetchBinanceHistory();
    void connectBinance();

    return () => {
      isMounted = false;
      setSourceExecutable('BINANCE', false);
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [
    mergeHistoricalSnapshot,
    persistLastOnlineAt,
    queueUpdate,
    setBinanceStatus,
    setCoins,
    setRegion,
    setSourceExecutable,
    shouldAcceptBinanceEvent,
  ]);

  // --- Coinbase Flow ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    let hasConnectedOnce = false;

    const fetchCoinbaseHistory = async (options?: {
      advanceReplayWatermark?: boolean;
      preserveCurrentPrice?: boolean;
    }) => {
      const requestStartedAt = Date.now();
      if (COINBASE_COINS.length === 0) return;

      const results = await mapWithConcurrency(
        COINBASE_COINS,
        INIT_FETCH_CONCURRENCY,
        async (coin) => {
          try {
            const res = await fetchWithRetry(
              `https://api.exchange.coinbase.com/products/${coin.symbol}-USD/candles?granularity=3600`,
              undefined,
              { retries: 2, baseDelayMs: 500, timeoutMs: 8000 }
            );
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!Array.isArray(data)) return null;
            const candles = data.slice(0, 24).reverse();
            const history = candles
              .map((c: number[]) => Number(c[4]))
              .filter((price) => Number.isFinite(price));
            return { symbol: coin.symbol, history };
          } catch (e) {
            console.error(`Failed to fetch Coinbase history for ${coin.symbol}`, e);
            return null;
          }
        }
      );

      const didReceiveHistory = results.some((result) => result && result.history.length > 0);

      setCoins((prevCoins) =>
        prevCoins.map((coin) => {
          if (coin.source !== 'COINBASE') return coin;
          const match = results.find((r) => r?.symbol === coin.symbol);
          if (match && match.history.length > 0) {
            return mergeHistoricalSnapshot(
              coin,
              match.history,
              requestStartedAt,
              requestStartedAt,
              {
                preserveCurrentPrice: options?.preserveCurrentPrice,
              }
            );
          }
          return coin;
        })
      );

      if (options?.advanceReplayWatermark && didReceiveHistory) {
        persistLastOnlineAt('COINBASE', requestStartedAt, true);
      }
    };

    const connectCoinbase = () => {
      setCoinbaseStatus('connecting');
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      coinbaseWSRef.current = ws;

      ws.onopen = () => {
        const shouldRefreshHistory = hasConnectedOnce;
        hasConnectedOnce = true;
        setSourceExecutable('COINBASE', false);
        setCoinbaseStatus('connected');
        reconnectAttempts = 0;
        lastCoinbaseMessageTime.current = Date.now();

        const productIds = COINBASE_COINS.map((c) => `${c.symbol}-USD`);

        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: productIds,
            channels: ['ticker'],
          })
        );

        if (shouldRefreshHistory) {
          void fetchCoinbaseHistory({
            advanceReplayWatermark: true,
            preserveCurrentPrice: true,
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ticker' && data.product_id) {
            const symbol = data.product_id.split('-')[0];
            const price = parseFloat(data.price);
            if (!Number.isFinite(price)) return;
            const sequence = Number(data.sequence);
            const eventTime = Date.parse(String(data.time ?? ''));
            if (
              !shouldAcceptCoinbaseEvent(
                symbol,
                Number.isFinite(sequence) && sequence > 0 ? sequence : null,
                Number.isFinite(eventTime) && eventTime > 0 ? eventTime : null
              )
            ) {
              return;
            }

            const receivedAt = Date.now();
            lastCoinbaseMessageTime.current = receivedAt; // Heartbeat update
            setSourceExecutable('COINBASE', true);

            const open24h = parseFloat(data.open_24h);
            const change =
              Number.isFinite(open24h) && open24h > 0
                ? ((price - open24h) / open24h) * 100
                : undefined;

            queueUpdate(symbol, { price, change }, receivedAt, 'COINBASE');
          }
        } catch (e) {
          console.error('Coinbase WS parse error', e);
        }
      };

      ws.onerror = () => {
        setSourceExecutable('COINBASE', false);
        setCoinbaseStatus('disconnected');
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setSourceExecutable('COINBASE', false);
        setCoinbaseStatus('disconnected');
        const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connectCoinbase, delay);
      };
    };

    void fetchCoinbaseHistory();
    connectCoinbase();

    return () => {
      isMounted = false;
      setSourceExecutable('COINBASE', false);
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [
    mergeHistoricalSnapshot,
    persistLastOnlineAt,
    queueUpdate,
    setCoinbaseStatus,
    setCoins,
    setSourceExecutable,
    shouldAcceptCoinbaseEvent,
  ]);

  // --- Connection Watchdog (Heartbeat) ---
  useEffect(() => {
    const checkHeartbeat = setInterval(() => {
      const now = Date.now();
      const { binanceStatus, coinbaseStatus } = useStore.getState();

      if (binanceStatus === 'connected' && now - lastBinanceMessageTime.current > 30000) {
        console.warn('Watchdog: Binance data stalled for 30s. Triggering reconnection.');
        if (binanceWSRef.current) {
          binanceWSRef.current.close();
          lastBinanceMessageTime.current = now; // Reset timer to allow handshake window
        }
      }

      if (coinbaseStatus === 'connected' && now - lastCoinbaseMessageTime.current > 30000) {
        console.warn('Watchdog: Coinbase data stalled for 30s. Triggering reconnection.');
        if (coinbaseWSRef.current) {
          coinbaseWSRef.current.close();
          lastCoinbaseMessageTime.current = now; // Reset timer to allow handshake window
        }
      }
    }, 10000);

    return () => clearInterval(checkHeartbeat);
  }, []);

  // --- Final Flush on Hide/Close (best-effort only) ---
  useEffect(() => {
    const flushPendingHistory = () => {
      cancelScheduledFlush();
      flushUpdates(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingHistory();
      }
    };

    window.addEventListener('beforeunload', flushPendingHistory);
    window.addEventListener('pagehide', flushPendingHistory);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushPendingHistory);
      window.removeEventListener('pagehide', flushPendingHistory);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushPendingHistory();
      cancelScheduledFlush();
    };
  }, [cancelScheduledFlush, flushUpdates]);

  return {};
};
