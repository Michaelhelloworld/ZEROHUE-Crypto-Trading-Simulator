import { Coin } from '../types';

export interface LiveUpdateSnapshot {
  price: number;
  change?: number;
  receivedAt: number;
}

export interface QueuedMarketUpdate {
  price: number;
  change?: number;
}

export const HISTORY_WINDOW_SIZE = 24;
export const HISTORY_BUCKET_MS = 60 * 60 * 1000;

export const getHistoryBucketStart = (timestamp: number) =>
  Math.floor(timestamp / HISTORY_BUCKET_MS) * HISTORY_BUCKET_MS;

export const trimHistoryWindow = (history: number[]) =>
  history.length > HISTORY_WINDOW_SIZE ? history.slice(-HISTORY_WINDOW_SIZE) : history;

export const applyLiveUpdateToCoin = (
  coin: Coin,
  update: QueuedMarketUpdate,
  receivedAt: number,
  lastBucketStart?: number
) => {
  const nextBucketStart = getHistoryBucketStart(receivedAt);
  let nextHistory = [...coin.history];

  if (nextHistory.length === 0) {
    nextHistory = [update.price];
  } else {
    const effectiveLastBucketStart = lastBucketStart ?? nextBucketStart;
    const bucketsElapsed = Math.max(
      0,
      Math.floor((nextBucketStart - effectiveLastBucketStart) / HISTORY_BUCKET_MS)
    );
    const carryForwardPrice = nextHistory[nextHistory.length - 1] ?? update.price;

    for (let bucketIndex = 0; bucketIndex < bucketsElapsed; bucketIndex += 1) {
      nextHistory.push(carryForwardPrice);
    }

    nextHistory = trimHistoryWindow(nextHistory);
    if (nextHistory.length === 0) {
      nextHistory.push(update.price);
    }
    nextHistory[nextHistory.length - 1] = update.price;
  }

  const openPrice = nextHistory[0] || update.price;
  const change =
    update.change !== undefined
      ? update.change
      : openPrice === 0
        ? 0
        : ((update.price - openPrice) / openPrice) * 100;

  return {
    coin: {
      ...coin,
      price: update.price,
      change24h: change,
      history: nextHistory,
    },
    bucketStart: nextBucketStart,
  };
};

export const applyQueuedUpdatesToCoins = (
  coins: Coin[],
  updates: Map<string, QueuedMarketUpdate>,
  latestLiveUpdates: Map<string, LiveUpdateSnapshot>,
  fallbackReceivedAt: number,
  historyBucketStarts: Map<string, number>
) => {
  const nextBucketStarts = new Map(historyBucketStarts);
  const nextCoins = coins.map((coin) => {
    const update = updates.get(coin.symbol);
    if (!update) return coin;

    const liveSnapshot = latestLiveUpdates.get(coin.symbol);
    const appliedUpdate = applyLiveUpdateToCoin(
      coin,
      update,
      liveSnapshot?.receivedAt ?? fallbackReceivedAt,
      nextBucketStarts.get(coin.symbol)
    );

    nextBucketStarts.set(coin.symbol, appliedUpdate.bucketStart);
    return appliedUpdate.coin;
  });

  return {
    coins: nextCoins,
    historyBucketStarts: nextBucketStarts,
  };
};

export const mergeHistoricalSnapshot = ({
  coin,
  history,
  requestStartedAt,
  historyTimestamp = requestStartedAt,
  lastAppliedStart,
  liveUpdate,
}: {
  coin: Coin;
  history: number[];
  requestStartedAt: number;
  historyTimestamp?: number;
  lastAppliedStart?: number;
  liveUpdate?: LiveUpdateSnapshot;
}) => {
  if (history.length === 0) {
    return {
      coin,
      applied: false,
      bucketStart: lastAppliedStart,
      appliedRequestStart: lastAppliedStart,
    };
  }

  const safeLastAppliedStart = lastAppliedStart ?? Number.NEGATIVE_INFINITY;
  if (requestStartedAt < safeLastAppliedStart) {
    return {
      coin,
      applied: false,
      bucketStart: getHistoryBucketStart(historyTimestamp),
      appliedRequestStart: safeLastAppliedStart,
    };
  }

  const nextHistory = trimHistoryWindow([...history]);
  const hasNewerLiveUpdate = Boolean(liveUpdate && liveUpdate.receivedAt > requestStartedAt);
  const openPrice = nextHistory[0];
  const latestPrice = nextHistory[nextHistory.length - 1] ?? coin.price;
  const baseCoin = {
    ...coin,
    history: nextHistory,
    price: latestPrice,
    change24h: openPrice === 0 ? 0 : ((latestPrice - openPrice) / openPrice) * 100,
  };
  const bucketStart = getHistoryBucketStart(historyTimestamp);

  if (hasNewerLiveUpdate && liveUpdate) {
    const appliedUpdate = applyLiveUpdateToCoin(
      baseCoin,
      { price: liveUpdate.price, change: liveUpdate.change },
      liveUpdate.receivedAt,
      bucketStart
    );

    return {
      coin: appliedUpdate.coin,
      applied: true,
      bucketStart: appliedUpdate.bucketStart,
      appliedRequestStart: requestStartedAt,
    };
  }

  return {
    coin: baseCoin,
    applied: true,
    bucketStart,
    appliedRequestStart: requestStartedAt,
  };
};

export const buildHistorySavePayload = (coins: Coin[], timestamp: number) =>
  coins.map((coin) => ({
    coinId: coin.id,
    history: coin.history,
    lastUpdated: timestamp,
  }));
