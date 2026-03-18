import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getBinanceConfig } from '../utils/binanceConfig';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { isDust } from '../utils/math';
import { useStore } from '../store/useStore';
import {
  ALL_REPLAY_SOURCES,
  readLastOnlineAt,
  ReplaySource,
  resolveReplayStartTime,
  sourceToPendingKey,
} from '../utils/replayWindow';
import {
  createOfflineReplayControllerState,
  createReplayRetryRequest,
  getPendingInitialReplaySources,
  getReplayRetryDelay,
  InitialReplayErrorState,
  markReplaySourcesHandled as markReplaySourcesHandledInController,
  markReplayStarted,
  markRetryRequestHandled,
  recordInitialReplayFailure,
  ReplayRetryRequest,
  resetReplayRetryProgress,
  resolveReplaySources,
  skipInitialReplayState,
  syncReplayConnectionState,
} from '../utils/offlineReplayController';
import {
  applyReplayEventsInChronologicalOrder,
  applyReplayEventsToState,
  CandleBar,
  dedupeAndSortCandles,
  hasStrategy,
  processFilledOrder,
  pushGroupedCandidate,
  ReplayCandlesFetchResult,
  ReplayEvent,
  ReplayHoldingCandidate,
  ReplayOrderCandidate,
  resolveHoldingExecutionFromCandles,
  resolveOrderExecutionFromCandles,
  resolveSymbolReplay,
  SymbolReplayResult,
} from '../utils/offlineReplay';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BINANCE_CANDLE_LIMIT = 1000;
const COINBASE_CANDLE_LIMIT = 300;
const MAX_KLINE_PAGES = 12;
const OFFLINE_FALLBACK_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OFFLINE_SYMBOL_CONCURRENCY = 2;
const OFFLINE_FETCH_RETRIES = 2;
const INITIAL_REPLAY_MAX_AUTO_RETRIES = 3;
const getBinanceIntervalStepMs = (interval: '1m' | '1h') =>
  interval === '1m' ? 60_000 : 3_600_000;

const getCoinbaseGranularityStepMs = (granularity: 60 | 3600) =>
  granularity === 60 ? 60_000 : 3_600_000;

const fetchBinanceCandlesBySymbol = async (
  symbol: string,
  config: { restBaseUrl: string },
  interval: '1m' | '1h',
  startTime: number,
  endTime: number
): Promise<ReplayCandlesFetchResult> => {
  try {
    const candles: CandleBar[] = [];
    const stepMs = getBinanceIntervalStepMs(interval);
    let pageStart = startTime;

    for (let page = 0; page < MAX_KLINE_PAGES && pageStart <= endTime; page++) {
      const res = await fetchWithRetry(
        `${config.restBaseUrl}/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&startTime=${pageStart}&endTime=${endTime}&limit=${BINANCE_CANDLE_LIMIT}`,
        undefined,
        { retries: OFFLINE_FETCH_RETRIES, baseDelayMs: 600, timeoutMs: 10000 }
      );
      if (!res.ok) {
        throw new Error(
          `Binance candle fetch failed for ${symbol} (${interval}): HTTP ${res.status}`
        );
      }

      const klines = await res.json();
      if (!Array.isArray(klines)) {
        throw new Error(
          `Binance candle fetch returned invalid payload for ${symbol} (${interval})`
        );
      }
      if (klines.length === 0) break;

      for (const kline of klines) {
        const time = Number(kline[0]);
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        if (!Number.isFinite(time) || !Number.isFinite(high) || !Number.isFinite(low)) continue;
        candles.push({ time, high, low });
      }

      const lastOpenTime = Number(klines[klines.length - 1][0]);
      const nextStart = lastOpenTime + stepMs;
      if (!Number.isFinite(nextStart) || nextStart <= pageStart) break;
      pageStart = nextStart;

      if (klines.length < BINANCE_CANDLE_LIMIT) break;
    }

    return { candles: dedupeAndSortCandles(candles), failed: false };
  } catch (e) {
    console.error('Error fetching Binance candles by symbol', e);
    return { candles: [], failed: true };
  }
};

const fetchCoinbaseCandlesBySymbol = async (
  symbol: string,
  granularity: 60 | 3600,
  startTime: number,
  endTime: number
): Promise<ReplayCandlesFetchResult> => {
  try {
    const candles: CandleBar[] = [];
    const stepMs = getCoinbaseGranularityStepMs(granularity);
    let pageEnd = endTime;

    for (let page = 0; page < MAX_KLINE_PAGES && pageEnd >= startTime; page++) {
      const pageStart = Math.max(startTime, pageEnd - stepMs * (COINBASE_CANDLE_LIMIT - 1));
      const res = await fetchWithRetry(
        `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=${granularity}&start=${new Date(pageStart).toISOString()}&end=${new Date(pageEnd).toISOString()}`,
        undefined,
        { retries: OFFLINE_FETCH_RETRIES, baseDelayMs: 600, timeoutMs: 10000 }
      );
      if (!res.ok) {
        throw new Error(
          `Coinbase candle fetch failed for ${symbol} (${granularity}): HTTP ${res.status}`
        );
      }

      const rawCandles = await res.json();
      if (!Array.isArray(rawCandles)) {
        throw new Error(
          `Coinbase candle fetch returned invalid payload for ${symbol} (${granularity})`
        );
      }
      if (rawCandles.length === 0) break;

      for (const candle of rawCandles) {
        const time = Number(candle[0]) * 1000;
        const low = Number(candle[1]);
        const high = Number(candle[2]);
        if (!Number.isFinite(time) || !Number.isFinite(high) || !Number.isFinite(low)) continue;
        candles.push({ time, high, low });
      }

      const oldestTime = Math.min(
        ...rawCandles.map((candle: number[]) => Number(candle[0]) * 1000)
      );
      if (!Number.isFinite(oldestTime)) break;

      const nextEnd = oldestTime - stepMs;
      if (nextEnd >= pageEnd) break;
      pageEnd = nextEnd;

      if (pageStart === startTime) break;
    }

    return { candles: dedupeAndSortCandles(candles), failed: false };
  } catch (e) {
    console.error('Error fetching Coinbase candles by symbol', e);
    return { candles: [], failed: true };
  }
};

/**
 * Checks for limit orders and TP/SL triggers that may have executed while the user was offline.
 * Syncs with Binance/Coinbase public kline data from the order/holding open time.
 */
export const useOfflineOrderExecution = (isHydrated = true) => {
  const orders = useStore((state) => state.orders);
  const portfolio = useStore((state) => state.portfolio);
  const coins = useStore((state) => state.coins);
  const binanceStatus = useStore((state) => state.binanceStatus);
  const coinbaseStatus = useStore((state) => state.coinbaseStatus);
  const replayControllerRef = useRef(createOfflineReplayControllerState());
  const [isInitialReplaySettled, setIsInitialReplaySettled] = useState(false);
  const [initialReplayError, setInitialReplayError] = useState<InitialReplayErrorState | null>(
    null
  );
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayInFlightRef = useRef(false);
  const [retryRequest, setRetryRequest] = useState<ReplayRetryRequest | null>(null);

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const retryInitialReplay = () => {
    const replayController = replayControllerRef.current;
    const pendingSources = getPendingInitialReplaySources(replayController);
    const sources = pendingSources.length > 0 ? pendingSources : [...ALL_REPLAY_SOURCES];

    clearRetryTimeout();
    resetReplayRetryProgress(replayController);
    setInitialReplayError(null);
    setIsInitialReplaySettled(false);
    setRetryRequest(createReplayRetryRequest(replayController, sources));
  };

  const skipInitialReplay = () => {
    const replayController = replayControllerRef.current;
    clearRetryTimeout();
    skipInitialReplayState(replayController);
    setInitialReplayError(null);
    setIsInitialReplaySettled(true);
    toast.error('Started without offline sync. Restored state may be stale until you retry sync.');
  };

  useEffect(() => {
    return () => {
      clearRetryTimeout();
    };
  }, []);

  useEffect(() => {
    const binanceConnected = binanceStatus === 'connected';
    const coinbaseConnected = coinbaseStatus === 'connected';
    const replayController = replayControllerRef.current;
    const reconnectReplaySources = syncReplayConnectionState(replayController, {
      binance: binanceConnected,
      coinbase: coinbaseConnected,
    });

    if (
      !isHydrated ||
      replayInFlightRef.current ||
      (initialReplayError && !isInitialReplaySettled)
    ) {
      return;
    }

    const replaySources = resolveReplaySources(
      replayController,
      retryRequest,
      isInitialReplaySettled,
      reconnectReplaySources
    );

    if (replaySources.length === 0) {
      return;
    }

    markReplayStarted(replayController);

    markRetryRequestHandled(replayController, retryRequest);

    replayInFlightRef.current = true;

    const markReplaySourcesHandled = (sources: ReplaySource[]) => {
      if (markReplaySourcesHandledInController(replayController, sources)) {
        resetReplayRetryProgress(replayController);
        setInitialReplayError(null);
        setIsInitialReplaySettled(true);
      }
    };

    const scheduleReplayRetry = (sources: ReplaySource[], delayMs?: number) => {
      clearRetryTimeout();
      const delay = getReplayRetryDelay(replayController, delayMs);

      retryTimeoutRef.current = setTimeout(() => {
        setRetryRequest(createReplayRetryRequest(replayController, sources));
      }, delay);
    };

    const exhaustInitialReplayRetries = (sources: ReplaySource[]) => {
      const nextError = recordInitialReplayFailure(
        replayController,
        sources,
        INITIAL_REPLAY_MAX_AUTO_RETRIES,
        isInitialReplaySettled
      );
      if (!nextError) {
        return false;
      }

      clearRetryTimeout();
      setInitialReplayError(nextError);
      return true;
    };

    const checkOfflineOrders = async (): Promise<ReplaySource[]> => {
      const openOrders = orders.filter((o) => o.status === 'OPEN');
      const triggerableHoldings = portfolio.holdings.filter(
        (holding) => !isDust(holding.amount) && hasStrategy(holding)
      );
      const now = Date.now();
      const lastOnlineAtBySource: Record<ReplaySource, number | null> = {
        BINANCE: readLastOnlineAt('BINANCE'),
        COINBASE: readLastOnlineAt('COINBASE'),
      };
      const getReplayStartTime = (baseStartTime: number, source: ReplaySource) =>
        resolveReplayStartTime(baseStartTime, lastOnlineAtBySource[source], now);

      if (openOrders.length === 0 && triggerableHoldings.length === 0) {
        markReplaySourcesHandled(replaySources);
        return [];
      }

      const replaySourceSet = new Set<ReplaySource>(replaySources);
      const coinSourceMap = new Map(coins.map((c) => [c.symbol, c.source]));
      const coinMapById = new Map(coins.map((c) => [c.id, c]));
      const orderCandidates: ReplayOrderCandidate[] = openOrders
        .map((order) => {
          const source: ReplaySource =
            coinSourceMap.get(order.coinSymbol) === 'COINBASE' ? 'COINBASE' : 'BINANCE';
          if (!replaySourceSet.has(source)) return null;

          return {
            order,
            replayStartTime: getReplayStartTime(order.timestamp, source),
            source,
          } satisfies ReplayOrderCandidate;
        })
        .filter((candidate): candidate is ReplayOrderCandidate => Boolean(candidate));
      const holdingCandidates: ReplayHoldingCandidate[] = triggerableHoldings
        .map((holding) => {
          const coin = coinMapById.get(holding.coinId);
          if (!coin) return null;

          const source: ReplaySource = coin.source === 'COINBASE' ? 'COINBASE' : 'BINANCE';
          if (!replaySourceSet.has(source)) return null;

          const holdingStartTime =
            holding.openedAt && holding.openedAt > 0
              ? holding.openedAt
              : now - OFFLINE_FALLBACK_LOOKBACK_MS;
          return {
            holding,
            coinSymbol: coin.symbol,
            replayStartTime: getReplayStartTime(holdingStartTime, source),
            source,
          } satisfies ReplayHoldingCandidate;
        })
        .filter((candidate): candidate is ReplayHoldingCandidate => Boolean(candidate));

      if (orderCandidates.length === 0 && holdingCandidates.length === 0) {
        markReplaySourcesHandled(replaySources);
        return [];
      }

      const binanceOrdersBySymbol = new Map<string, ReplayOrderCandidate[]>();
      const coinbaseOrdersBySymbol = new Map<string, ReplayOrderCandidate[]>();
      const binanceHoldingsBySymbol = new Map<string, ReplayHoldingCandidate[]>();
      const coinbaseHoldingsBySymbol = new Map<string, ReplayHoldingCandidate[]>();

      for (const candidate of orderCandidates) {
        if (candidate.source === 'COINBASE') {
          pushGroupedCandidate(coinbaseOrdersBySymbol, candidate.order.coinSymbol, candidate);
        } else {
          pushGroupedCandidate(binanceOrdersBySymbol, candidate.order.coinSymbol, candidate);
        }
      }

      for (const candidate of holdingCandidates) {
        if (candidate.source === 'COINBASE') {
          pushGroupedCandidate(coinbaseHoldingsBySymbol, candidate.coinSymbol, candidate);
        } else {
          pushGroupedCandidate(binanceHoldingsBySymbol, candidate.coinSymbol, candidate);
        }
      }

      const replayEvents: ReplayEvent[] = [];
      const handledSources = new Set<ReplaySource>();
      const failedSources = new Set<ReplaySource>();

      const appendReplayResults = (replayResults: SymbolReplayResult[]) => {
        for (const replayResult of replayResults) {
          replayEvents.push(...replayResult.events);
        }
      };

      const hasBinanceCandidates =
        binanceOrdersBySymbol.size > 0 || binanceHoldingsBySymbol.size > 0;
      if (replaySourceSet.has('BINANCE')) {
        if (!hasBinanceCandidates) {
          handledSources.add('BINANCE');
        } else {
          try {
            const config = await getBinanceConfig();

            const symbols = [
              ...new Set<string>([
                ...binanceOrdersBySymbol.keys(),
                ...binanceHoldingsBySymbol.keys(),
              ]),
            ];

            const replayResults = await mapWithConcurrency(
              symbols,
              OFFLINE_SYMBOL_CONCURRENCY,
              async (symbol): Promise<SymbolReplayResult> => {
                const symbolOrderCandidates = binanceOrdersBySymbol.get(symbol) || [];
                const symbolHoldingCandidates = binanceHoldingsBySymbol.get(symbol) || [];
                const symbolReplayStarts = [
                  ...symbolOrderCandidates.map((candidate) => candidate.replayStartTime),
                  ...symbolHoldingCandidates.map((candidate) => candidate.replayStartTime),
                ];
                const recentStarts = symbolReplayStarts.filter(
                  (startTime) => now - startTime < ONE_DAY_MS
                );
                const oldStarts = symbolReplayStarts.filter(
                  (startTime) => now - startTime >= ONE_DAY_MS
                );

                const recentFetchResult =
                  recentStarts.length > 0
                    ? await fetchBinanceCandlesBySymbol(
                        symbol,
                        config,
                        '1m',
                        Math.min(...recentStarts),
                        now
                      )
                    : { candles: [], failed: false };
                const oldFetchResult =
                  oldStarts.length > 0
                    ? await fetchBinanceCandlesBySymbol(
                        symbol,
                        config,
                        '1h',
                        Math.min(...oldStarts),
                        now
                      )
                    : { candles: [], failed: false };

                const hadFetchFailure = recentFetchResult.failed || oldFetchResult.failed;
                if (hadFetchFailure) {
                  return { events: [], hadFetchFailure: true };
                }

                return resolveSymbolReplay(
                  symbolOrderCandidates,
                  symbolHoldingCandidates,
                  dedupeAndSortCandles([...recentFetchResult.candles, ...oldFetchResult.candles])
                );
              }
            );

            if (replayResults.some((result) => result.hadFetchFailure)) {
              console.error(
                'Retrying Binance offline replay after symbol-level candle fetch failure'
              );
              failedSources.add('BINANCE');
            } else {
              appendReplayResults(replayResults);
              handledSources.add('BINANCE');
            }
          } catch (error) {
            console.error('Error replaying Binance offline orders', error);
            failedSources.add('BINANCE');
          }
        }
      }

      const hasCoinbaseCandidates =
        coinbaseOrdersBySymbol.size > 0 || coinbaseHoldingsBySymbol.size > 0;
      if (replaySourceSet.has('COINBASE')) {
        if (!hasCoinbaseCandidates) {
          handledSources.add('COINBASE');
        } else {
          try {
            const symbols = [
              ...new Set<string>([
                ...coinbaseOrdersBySymbol.keys(),
                ...coinbaseHoldingsBySymbol.keys(),
              ]),
            ];

            const replayResults = await mapWithConcurrency(
              symbols,
              OFFLINE_SYMBOL_CONCURRENCY,
              async (symbol): Promise<SymbolReplayResult> => {
                const symbolOrderCandidates = coinbaseOrdersBySymbol.get(symbol) || [];
                const symbolHoldingCandidates = coinbaseHoldingsBySymbol.get(symbol) || [];
                const symbolReplayStarts = [
                  ...symbolOrderCandidates.map((candidate) => candidate.replayStartTime),
                  ...symbolHoldingCandidates.map((candidate) => candidate.replayStartTime),
                ];
                const recentStarts = symbolReplayStarts.filter(
                  (startTime) => now - startTime < ONE_DAY_MS
                );
                const oldStarts = symbolReplayStarts.filter(
                  (startTime) => now - startTime >= ONE_DAY_MS
                );

                const recentFetchResult =
                  recentStarts.length > 0
                    ? await fetchCoinbaseCandlesBySymbol(symbol, 60, Math.min(...recentStarts), now)
                    : { candles: [], failed: false };
                const oldFetchResult =
                  oldStarts.length > 0
                    ? await fetchCoinbaseCandlesBySymbol(symbol, 3600, Math.min(...oldStarts), now)
                    : { candles: [], failed: false };

                const hadFetchFailure = recentFetchResult.failed || oldFetchResult.failed;
                if (hadFetchFailure) {
                  return { events: [], hadFetchFailure: true };
                }

                return resolveSymbolReplay(
                  symbolOrderCandidates,
                  symbolHoldingCandidates,
                  dedupeAndSortCandles([...recentFetchResult.candles, ...oldFetchResult.candles])
                );
              }
            );

            if (replayResults.some((result) => result.hadFetchFailure)) {
              console.error(
                'Retrying Coinbase offline replay after symbol-level candle fetch failure'
              );
              failedSources.add('COINBASE');
            } else {
              appendReplayResults(replayResults);
              handledSources.add('COINBASE');
            }
          } catch (error) {
            console.error('Error replaying Coinbase offline orders', error);
            failedSources.add('COINBASE');
          }
        }
      }

      let filledCount = 0;
      let triggeredHoldingCount = 0;

      useStore.setState((state) => {
        const replayResult = applyReplayEventsToState(
          replayEvents,
          state.orders,
          state.portfolio,
          state.coins
        );
        filledCount = replayResult.filledCount;
        triggeredHoldingCount = replayResult.triggeredHoldingCount;
        const cancelledCount = replayResult.cancelledCount;

        if (filledCount === 0 && triggeredHoldingCount === 0 && cancelledCount === 0) {
          return state;
        }

        const sortedTransactions = [...replayResult.newTransactions].sort(
          (left, right) => right.timestamp - left.timestamp
        );

        return {
          ...state,
          orders: replayResult.nextOrders,
          portfolio: replayResult.nextPortfolio,
          transactions: [...sortedTransactions, ...state.transactions],
          engineStateVersion: state.engineStateVersion + 1,
        };
      });

      if (filledCount > 0 || triggeredHoldingCount > 0) {
        const summaryParts: string[] = [];
        if (filledCount > 0) {
          summaryParts.push(
            `${filledCount} offline limit order${filledCount === 1 ? '' : 's'} filled`
          );
        }
        if (triggeredHoldingCount > 0) {
          summaryParts.push(
            `${triggeredHoldingCount} TP/SL trigger${triggeredHoldingCount === 1 ? '' : 's'} executed`
          );
        }

        toast.success(
          (t) => (
            <div className="flex flex-col gap-1 cursor-default">
              <span className="font-bold flex items-center justify-between">
                System Sync
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  title="Dismiss"
                  className="p-1 hover:bg-white/10 rounded-md transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
              <span className="text-xs text-slate-300">
                {summaryParts.join(' and ')} while you were away. Check history for details.
              </span>
            </div>
          ),
          { duration: 8000 }
        );
      }
      markReplaySourcesHandled([...handledSources]);
      return [...failedSources];
    };

    checkOfflineOrders()
      .then((failedSources) => {
        clearRetryTimeout();

        if (failedSources.length > 0) {
          const failedInitialSources = failedSources.filter(
            (source) => replayController.initialReplayPendingSources[sourceToPendingKey(source)]
          );
          if (
            failedInitialSources.length > 0 &&
            exhaustInitialReplayRetries(failedInitialSources)
          ) {
            return;
          }

          scheduleReplayRetry([...new Set(failedSources)]);
          return;
        }

        const remainingInitialReplaySources = getPendingInitialReplaySources(replayController);
        if (remainingInitialReplaySources.length > 0) {
          scheduleReplayRetry(remainingInitialReplaySources, 0);
          return;
        }

        resetReplayRetryProgress(replayController);
        setInitialReplayError(null);
        setIsInitialReplaySettled(true);
      })
      .catch((error) => {
        console.error('Error checking offline orders', error);
        const pendingInitialReplaySources = getPendingInitialReplaySources(replayController);
        if (
          pendingInitialReplaySources.length > 0 &&
          exhaustInitialReplayRetries(pendingInitialReplaySources)
        ) {
          return;
        }
        scheduleReplayRetry(replaySources);
      })
      .finally(() => {
        replayInFlightRef.current = false;
      });
  }, [
    binanceStatus,
    coinbaseStatus,
    coins,
    isHydrated,
    orders,
    portfolio.holdings,
    retryRequest,
    initialReplayError,
    isInitialReplaySettled,
  ]);

  return { isInitialReplaySettled, initialReplayError, retryInitialReplay, skipInitialReplay };
};

// Test-only exports for deterministic offline replay assertions.
export const __offlineExecutionInternals = {
  applyReplayEventsToState,
  applyReplayEventsInChronologicalOrder,
  processFilledOrder,
  resolveOrderExecutionFromCandles,
  resolveHoldingExecutionFromCandles,
  resolveSymbolReplay,
};
