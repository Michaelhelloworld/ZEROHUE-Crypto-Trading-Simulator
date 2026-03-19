import { dbService, ZEROHUESchema } from '../services/db';
import { DEFAULT_PORTFOLIO } from '../store/useStore';
import { Holding, Order, OrderLotAllocation, Portfolio, Transaction } from '../types';
import { isDust, roundCrypto, roundUSD } from './math';
import { generateUUID } from './uuid';
import { safeStorage } from './safeStorage';

interface NormalizationResult<T> {
  value: T;
  dirty: boolean;
}

interface NullableNormalizationResult<T> {
  value: T | null;
  dirty: boolean;
}

export class PersistedAppHydrationError extends Error {
  code: 'orders_unavailable' | 'transactions_unavailable';

  constructor(message: string, code: 'orders_unavailable' | 'transactions_unavailable') {
    super(message);
    this.name = 'PersistedAppHydrationError';
    this.code = code;
  }
}

const sortByNewestFirst = <T extends { timestamp: number }>(items: T[]) =>
  [...items].sort((left, right) => right.timestamp - left.timestamp);

export const createDefaultPortfolio = (): Portfolio => ({
  ...DEFAULT_PORTFOLIO,
  holdings: [],
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasOwn = (candidate: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(candidate, key);

const hasOnlyKnownKeys = (candidate: Record<string, unknown>, knownKeys: readonly string[]) =>
  Object.keys(candidate).every((key) => knownKeys.includes(key));

const normalizeOptionalPositiveFiniteNumber = (
  candidate: Record<string, unknown>,
  key: string
): NormalizationResult<number | undefined> => {
  if (!hasOwn(candidate, key) || candidate[key] == null) {
    return { value: undefined, dirty: false };
  }

  return isPositiveFiniteNumber(candidate[key])
    ? { value: candidate[key], dirty: false }
    : { value: undefined, dirty: true };
};

const normalizeOptionalPositiveInteger = (
  candidate: Record<string, unknown>,
  key: string
): NormalizationResult<number | undefined> => {
  if (!hasOwn(candidate, key) || candidate[key] == null) {
    return { value: undefined, dirty: false };
  }

  const value = candidate[key];
  if (!isPositiveFiniteNumber(value)) {
    return { value: undefined, dirty: true };
  }

  const normalizedValue = Math.floor(value);
  return {
    value: normalizedValue,
    dirty: normalizedValue !== value,
  };
};

const normalizeHolding = (value: unknown): NullableNormalizationResult<Holding> => {
  if (!value || typeof value !== 'object') return { value: null, dirty: true };

  const candidate = value as Record<string, unknown>;
  let dirty = !hasOnlyKnownKeys(candidate, [
    'id',
    'coinId',
    'amount',
    'averageCost',
    'takeProfitPrice',
    'stopLossPrice',
    'openedAt',
    'meetsVolumeCondition',
  ]);
  if (typeof candidate.coinId !== 'string' || !candidate.coinId)
    return { value: null, dirty: true };
  if (
    !isNonNegativeFiniteNumber(candidate.amount) ||
    !isNonNegativeFiniteNumber(candidate.averageCost)
  ) {
    return { value: null, dirty: true };
  }
  if (isDust(candidate.amount)) return { value: null, dirty: true };

  const id = isNonEmptyString(candidate.id) ? candidate.id : generateUUID();
  dirty ||= !isNonEmptyString(candidate.id);

  const takeProfitPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'takeProfitPrice');
  const stopLossPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'stopLossPrice');
  const openedAt = normalizeOptionalPositiveInteger(candidate, 'openedAt');
  dirty ||= takeProfitPrice.dirty || stopLossPrice.dirty || openedAt.dirty;

  const meetsVolumeCondition =
    typeof candidate.meetsVolumeCondition === 'boolean' ? candidate.meetsVolumeCondition : false;
  dirty ||= typeof candidate.meetsVolumeCondition !== 'boolean';

  return {
    value: {
      id,
      coinId: candidate.coinId,
      amount: candidate.amount,
      averageCost: candidate.averageCost,
      takeProfitPrice: takeProfitPrice.value,
      stopLossPrice: stopLossPrice.value,
      openedAt: openedAt.value,
      meetsVolumeCondition,
    },
    dirty,
  };
};

const normalizeOrderLotAllocation = (
  value: unknown
): NullableNormalizationResult<OrderLotAllocation> => {
  if (!value || typeof value !== 'object') return { value: null, dirty: true };

  const candidate = value as Record<string, unknown>;
  let dirty = !hasOnlyKnownKeys(candidate, [
    'lotId',
    'coinId',
    'amount',
    'averageCost',
    'takeProfitPrice',
    'stopLossPrice',
    'openedAt',
    'meetsVolumeCondition',
    'wasFullLotClose',
  ]);
  if (!isNonEmptyString(candidate.lotId) || !isNonEmptyString(candidate.coinId)) {
    return { value: null, dirty: true };
  }
  if (
    !isPositiveFiniteNumber(candidate.amount) ||
    !isNonNegativeFiniteNumber(candidate.averageCost)
  ) {
    return { value: null, dirty: true };
  }
  if (typeof candidate.wasFullLotClose !== 'boolean') return { value: null, dirty: true };

  const takeProfitPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'takeProfitPrice');
  const stopLossPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'stopLossPrice');
  const openedAt = normalizeOptionalPositiveInteger(candidate, 'openedAt');
  dirty ||= takeProfitPrice.dirty || stopLossPrice.dirty || openedAt.dirty;

  const meetsVolumeCondition =
    typeof candidate.meetsVolumeCondition === 'boolean' ? candidate.meetsVolumeCondition : false;
  dirty ||= typeof candidate.meetsVolumeCondition !== 'boolean';

  return {
    value: {
      lotId: candidate.lotId,
      coinId: candidate.coinId,
      amount: candidate.amount,
      averageCost: candidate.averageCost,
      takeProfitPrice: takeProfitPrice.value,
      stopLossPrice: stopLossPrice.value,
      openedAt: openedAt.value,
      meetsVolumeCondition,
      wasFullLotClose: candidate.wasFullLotClose,
    },
    dirty,
  };
};

const normalizePortfolioResult = (value: unknown): NormalizationResult<Portfolio> => {
  const defaults = createDefaultPortfolio();
  if (!value || typeof value !== 'object') return { value: defaults, dirty: true };

  const candidate = value as Record<string, unknown>;
  const initialBalance = isNonNegativeFiniteNumber(candidate.initialBalance)
    ? candidate.initialBalance
    : defaults.initialBalance;
  const balance = isNonNegativeFiniteNumber(candidate.balance) ? candidate.balance : initialBalance;
  const peakBalanceCandidate = isNonNegativeFiniteNumber(candidate.peakBalance)
    ? candidate.peakBalance
    : Number.NEGATIVE_INFINITY;

  let dirty = !hasOnlyKnownKeys(candidate, [
    'balance',
    'initialBalance',
    'holdings',
    'peakBalance',
    'historicalMDD',
    'grossProfit',
    'grossLoss',
    'validTradesCount',
  ]);

  dirty ||= !isNonNegativeFiniteNumber(candidate.initialBalance);
  dirty ||= !isNonNegativeFiniteNumber(candidate.balance);
  dirty ||= !isNonNegativeFiniteNumber(candidate.peakBalance);
  dirty ||= !(
    isFiniteNumber(candidate.historicalMDD) &&
    candidate.historicalMDD >= 0 &&
    candidate.historicalMDD <= 1
  );
  dirty ||= !isNonNegativeFiniteNumber(candidate.grossProfit);
  dirty ||= !isNonNegativeFiniteNumber(candidate.grossLoss);
  dirty ||= !isNonNegativeFiniteNumber(candidate.validTradesCount);

  const holdings = Array.isArray(candidate.holdings)
    ? candidate.holdings.reduce<Holding[]>((acc, item) => {
        const normalizedHolding = normalizeHolding(item);
        dirty ||= normalizedHolding.dirty;
        if (normalizedHolding.value) acc.push(normalizedHolding.value);
        return acc;
      }, [])
    : [];
  dirty ||= candidate.holdings !== undefined && !Array.isArray(candidate.holdings);

  const normalizedPeakBalance = Math.max(balance, initialBalance, peakBalanceCandidate);
  dirty ||= normalizedPeakBalance !== peakBalanceCandidate;

  const historicalMDD =
    isFiniteNumber(candidate.historicalMDD) &&
    candidate.historicalMDD >= 0 &&
    candidate.historicalMDD <= 1
      ? candidate.historicalMDD
      : defaults.historicalMDD;
  const grossProfit = isNonNegativeFiniteNumber(candidate.grossProfit)
    ? candidate.grossProfit
    : defaults.grossProfit;
  const grossLoss = isNonNegativeFiniteNumber(candidate.grossLoss)
    ? candidate.grossLoss
    : defaults.grossLoss;
  const validTradesCount = isNonNegativeFiniteNumber(candidate.validTradesCount)
    ? Math.floor(candidate.validTradesCount)
    : defaults.validTradesCount;
  dirty ||= isNonNegativeFiniteNumber(candidate.validTradesCount)
    ? validTradesCount !== candidate.validTradesCount
    : false;

  return {
    value: {
      ...defaults,
      balance,
      initialBalance,
      holdings,
      peakBalance: normalizedPeakBalance,
      historicalMDD,
      grossProfit,
      grossLoss,
      validTradesCount,
    },
    dirty,
  };
};

export const normalizePortfolio = (value: unknown): Portfolio =>
  normalizePortfolioResult(value).value;

const hasTrustedHoldingIds = (rawHoldings: unknown, normalizedHoldings: Holding[]) => {
  if (!Array.isArray(rawHoldings) || rawHoldings.length !== normalizedHoldings.length) {
    return false;
  }

  const rawIds = rawHoldings.map((holding) =>
    holding && typeof holding === 'object' ? (holding as Record<string, unknown>).id : undefined
  );
  if (!rawIds.every((id) => isNonEmptyString(id))) {
    return false;
  }

  return new Set(rawIds as string[]).size === rawIds.length;
};

const requiresOpenOrderReconciliation = (rawPortfolio: unknown, normalizedPortfolio: Portfolio) => {
  if (!rawPortfolio || typeof rawPortfolio !== 'object') {
    return true;
  }

  const candidate = rawPortfolio as Record<string, unknown>;
  const hasTrustedBalances =
    isNonNegativeFiniteNumber(candidate.balance) &&
    isNonNegativeFiniteNumber(candidate.initialBalance);
  const rawHoldings = candidate.holdings;
  const hasTrustedHoldings = hasTrustedHoldingIds(rawHoldings, normalizedPortfolio.holdings);

  return !hasTrustedBalances || !hasTrustedHoldings;
};

const normalizeOrder = (value: unknown): NullableNormalizationResult<Order> => {
  if (!value || typeof value !== 'object') return { value: null, dirty: true };

  const candidate = value as Record<string, unknown>;
  const status = candidate.status;
  let dirty = !hasOnlyKnownKeys(candidate, [
    'id',
    'type',
    'coinId',
    'coinSymbol',
    'amount',
    'limitPrice',
    'total',
    'takeProfitPrice',
    'stopLossPrice',
    'lotAllocations',
    'timestamp',
    'status',
    'updatedAt',
  ]);
  if (
    !isNonEmptyString(candidate.id) ||
    !isNonEmptyString(candidate.coinId) ||
    !isNonEmptyString(candidate.coinSymbol)
  ) {
    return { value: null, dirty: true };
  }
  if (candidate.type !== 'BUY' && candidate.type !== 'SELL') return { value: null, dirty: true };
  if (!isPositiveFiniteNumber(candidate.limitPrice)) return { value: null, dirty: true };
  if (status !== 'OPEN' && status !== 'FILLED' && status !== 'CANCELLED') {
    return { value: null, dirty: true };
  }

  const allowsZeroSizedCancellation = status === 'CANCELLED';
  const hasValidAmount = allowsZeroSizedCancellation
    ? isNonNegativeFiniteNumber(candidate.amount)
    : isPositiveFiniteNumber(candidate.amount);
  const hasValidTotal = allowsZeroSizedCancellation
    ? isNonNegativeFiniteNumber(candidate.total)
    : isPositiveFiniteNumber(candidate.total);

  if (!hasValidAmount) return { value: null, dirty: true };
  if (!hasValidTotal) return { value: null, dirty: true };

  const timestamp = normalizeOptionalPositiveInteger(candidate, 'timestamp');
  if (!timestamp.value) return { value: null, dirty: true };
  dirty ||= timestamp.dirty;

  const normalizedLotAllocations = Array.isArray(candidate.lotAllocations)
    ? candidate.lotAllocations.reduce<OrderLotAllocation[]>((acc, item) => {
        const normalizedAllocation = normalizeOrderLotAllocation(item);
        dirty ||= normalizedAllocation.dirty;
        if (normalizedAllocation.value) acc.push(normalizedAllocation.value);
        return acc;
      }, [])
    : undefined;
  dirty ||= candidate.lotAllocations !== undefined && !Array.isArray(candidate.lotAllocations);

  if (
    candidate.type === 'SELL' &&
    status === 'OPEN' &&
    (!normalizedLotAllocations || normalizedLotAllocations.length === 0)
  ) {
    return { value: null, dirty: true };
  }

  const normalizedSellAmount =
    candidate.type === 'SELL' && normalizedLotAllocations
      ? roundCrypto(
          normalizedLotAllocations.reduce((acc, allocation) => acc + allocation.amount, 0)
        )
      : null;
  const normalizedSellTotal =
    candidate.type === 'SELL' && normalizedSellAmount !== null
      ? roundUSD(normalizedSellAmount * candidate.limitPrice)
      : null;
  if (
    candidate.type === 'SELL' &&
    status === 'OPEN' &&
    normalizedSellAmount !== null &&
    normalizedSellTotal !== null
  ) {
    dirty ||= normalizedSellAmount !== candidate.amount || normalizedSellTotal !== candidate.total;
  }
  const normalizedOrderAmount =
    candidate.type === 'SELL' &&
    status === 'OPEN' &&
    normalizedSellAmount !== null &&
    normalizedSellTotal !== null
      ? normalizedSellAmount
      : (candidate.amount as number);
  const normalizedOrderTotal =
    candidate.type === 'SELL' &&
    status === 'OPEN' &&
    normalizedSellAmount !== null &&
    normalizedSellTotal !== null
      ? normalizedSellTotal
      : (candidate.total as number);

  const takeProfitPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'takeProfitPrice');
  const stopLossPrice = normalizeOptionalPositiveFiniteNumber(candidate, 'stopLossPrice');
  const updatedAt = normalizeOptionalPositiveInteger(candidate, 'updatedAt');
  dirty ||= takeProfitPrice.dirty || stopLossPrice.dirty || updatedAt.dirty;

  return {
    value: {
      id: candidate.id,
      type: candidate.type,
      coinId: candidate.coinId,
      coinSymbol: candidate.coinSymbol,
      amount: normalizedOrderAmount,
      limitPrice: candidate.limitPrice,
      total: normalizedOrderTotal,
      takeProfitPrice: takeProfitPrice.value,
      stopLossPrice: stopLossPrice.value,
      lotAllocations: normalizedLotAllocations,
      timestamp: timestamp.value,
      status,
      updatedAt: updatedAt.value,
    },
    dirty,
  };
};

const normalizeTransaction = (value: unknown): NullableNormalizationResult<Transaction> => {
  if (!value || typeof value !== 'object') return { value: null, dirty: true };

  const candidate = value as Record<string, unknown>;
  let dirty = !hasOnlyKnownKeys(candidate, [
    'id',
    'type',
    'coinId',
    'coinSymbol',
    'amount',
    'pricePerCoin',
    'total',
    'fee',
    'timestamp',
    'updatedAt',
  ]);
  if (
    !isNonEmptyString(candidate.id) ||
    !isNonEmptyString(candidate.coinId) ||
    !isNonEmptyString(candidate.coinSymbol)
  ) {
    return { value: null, dirty: true };
  }
  if (candidate.type !== 'BUY' && candidate.type !== 'SELL') return { value: null, dirty: true };
  if (!isPositiveFiniteNumber(candidate.amount)) return { value: null, dirty: true };
  if (!isPositiveFiniteNumber(candidate.pricePerCoin)) return { value: null, dirty: true };
  if (!isPositiveFiniteNumber(candidate.total)) return { value: null, dirty: true };

  const timestamp = normalizeOptionalPositiveInteger(candidate, 'timestamp');
  if (!timestamp.value) return { value: null, dirty: true };
  dirty ||= timestamp.dirty;

  const fee = candidate.fee;
  if (fee !== undefined && fee !== null && !isNonNegativeFiniteNumber(fee)) {
    return { value: null, dirty: true };
  }

  const updatedAt = normalizeOptionalPositiveInteger(candidate, 'updatedAt');
  dirty ||= updatedAt.dirty;

  return {
    value: {
      id: candidate.id,
      type: candidate.type,
      coinId: candidate.coinId,
      coinSymbol: candidate.coinSymbol,
      amount: candidate.amount,
      pricePerCoin: candidate.pricePerCoin,
      total: candidate.total,
      fee: typeof fee === 'number' ? fee : undefined,
      timestamp: timestamp.value,
      updatedAt: updatedAt.value,
    },
    dirty,
  };
};

const normalizePersistedArray = <T extends 'orders' | 'transactions'>(
  storeName: T,
  value: unknown
): NormalizationResult<ZEROHUESchema[T]['value'][]> => {
  if (!Array.isArray(value)) return { value: [], dirty: value !== undefined };

  if (storeName === 'orders') {
    let dirty = false;
    const items = value.reduce<Order[]>((acc, item) => {
      const normalizedOrder = normalizeOrder(item);
      dirty ||= normalizedOrder.dirty;
      if (normalizedOrder.value) acc.push(normalizedOrder.value);
      return acc;
    }, []);

    return {
      value: sortByNewestFirst(items) as ZEROHUESchema[T]['value'][],
      dirty,
    };
  }

  let dirty = false;
  const items = value.reduce<Transaction[]>((acc, item) => {
    const normalizedTransaction = normalizeTransaction(item);
    dirty ||= normalizedTransaction.dirty;
    if (normalizedTransaction.value) acc.push(normalizedTransaction.value);
    return acc;
  }, []);

  return {
    value: sortByNewestFirst(items) as ZEROHUESchema[T]['value'][],
    dirty,
  };
};

export const hydrateIDBArray = async <T extends 'orders' | 'transactions'>(
  storeName: T,
  onHydrated: (items: ZEROHUESchema[T]['value'][]) => void
): Promise<{ items: ZEROHUESchema[T]['value'][]; failed: boolean }> => {
  try {
    const rawItems = await dbService.getAll(storeName);
    const { value: items, dirty } = normalizePersistedArray(storeName, rawItems);

    onHydrated(items);
    if (dirty) {
      await dbService.replaceAll(storeName, items).catch((error) => {
        console.error(`Failed to rewrite sanitized ${storeName} in IndexedDB`, error);
      });
    }
    return { items, failed: false };
  } catch (error) {
    console.error(`Failed to hydrate ${storeName} from IndexedDB`, error);
    return { items: [], failed: true };
  }
};

const reconcileOpenOrdersForFallbackPortfolio = (orders: Order[]): NormalizationResult<Order[]> => {
  const updatedAt = Date.now();
  let dirty = false;

  return {
    value: orders.map((order) => {
      if (order.status !== 'OPEN') return order;

      dirty = true;
      return {
        ...order,
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
        updatedAt,
      };
    }),
    dirty,
  };
};

export const hydratePersistedAppState = async ({
  applyPortfolio,
  applyOrders,
  applyTransactions,
}: {
  applyPortfolio: (portfolio: Portfolio) => void;
  applyOrders: (orders: Order[]) => void;
  applyTransactions: (transactions: Transaction[]) => void;
}) => {
  dbService.pruneHistory().catch((error) => {
    console.error('Failed to prune market history', error);
  });

  const storedPortfolio = safeStorage.getItem('zerohue_portfolio');
  let shouldReconcileOpenOrders = false;
  if (storedPortfolio) {
    try {
      const parsedPortfolio = JSON.parse(storedPortfolio);
      const normalizedPortfolio = normalizePortfolioResult(parsedPortfolio);
      shouldReconcileOpenOrders = requiresOpenOrderReconciliation(
        parsedPortfolio,
        normalizedPortfolio.value
      );
      applyPortfolio(normalizedPortfolio.value);
      if (normalizedPortfolio.dirty) {
        safeStorage.setItem('zerohue_portfolio', JSON.stringify(normalizedPortfolio.value));
      }
    } catch (error) {
      console.error('Failed to parse portfolio', error);
      const fallbackPortfolio = createDefaultPortfolio();
      shouldReconcileOpenOrders = true;
      applyPortfolio(fallbackPortfolio);
      safeStorage.setItem('zerohue_portfolio', JSON.stringify(fallbackPortfolio));
    }
  } else {
    shouldReconcileOpenOrders = true;
    applyPortfolio(createDefaultPortfolio());
  }

  const hydratedOrdersResult = await hydrateIDBArray('orders', applyOrders);
  if (hydratedOrdersResult.failed) {
    throw new PersistedAppHydrationError(
      'Failed to hydrate open orders from IndexedDB. Startup was blocked to avoid a split portfolio and order state.',
      'orders_unavailable'
    );
  }

  const hydratedOrders = hydratedOrdersResult.items;
  if (shouldReconcileOpenOrders) {
    const reconciledOrders = reconcileOpenOrdersForFallbackPortfolio(hydratedOrders);

    if (reconciledOrders.dirty) {
      console.warn(
        'Recovered portfolio state could not safely preserve open orders. Open orders were cancelled to avoid cash and holdings mismatches.'
      );
      applyOrders(reconciledOrders.value);
      await dbService.replaceAll('orders', reconciledOrders.value).catch((error) => {
        console.error('Failed to rewrite reconciled orders after portfolio fallback', error);
      });
    }
  }

  const hydratedTransactionsResult = await hydrateIDBArray('transactions', applyTransactions);
  if (hydratedTransactionsResult.failed) {
    throw new PersistedAppHydrationError(
      'Failed to hydrate transaction history from IndexedDB. Startup was blocked because restored history and scoring data would be incomplete.',
      'transactions_unavailable'
    );
  }
};
