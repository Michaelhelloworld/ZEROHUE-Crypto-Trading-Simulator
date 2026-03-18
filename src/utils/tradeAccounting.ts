import { Coin, Holding, Order, Portfolio } from '../types';
import { isDust } from './math';

type MarkPriceResolver = (
  coinId: string,
  fallbackPrice: number,
  entity: 'holding' | 'order'
) => number;

type StrategyCarrier = Pick<Holding, 'amount' | 'takeProfitPrice' | 'stopLossPrice'>;

export type ProtectiveTriggerType = 'TP' | 'SL';

const calculateTotalEquityWithResolver = (
  portfolio: Portfolio,
  orders: Order[],
  resolveMarkPrice: MarkPriceResolver
) =>
  portfolio.balance +
  portfolio.holdings.reduce((acc, holding) => {
    const markPrice = resolveMarkPrice(holding.coinId, holding.averageCost, 'holding');
    return acc + holding.amount * markPrice;
  }, 0) +
  orders.reduce((acc, order) => {
    if (order.status !== 'OPEN') return acc;
    if (order.type === 'BUY') return acc + order.total;

    const markPrice = resolveMarkPrice(order.coinId, order.limitPrice, 'order');
    return acc + order.amount * markPrice;
  }, 0);

export const calculateLiveTotalEquity = (portfolio: Portfolio, coins: Coin[], orders: Order[]) =>
  calculateTotalEquityWithResolver(portfolio, orders, (coinId, fallbackPrice) => {
    const currentPrice = coins.find((coin) => coin.id === coinId)?.price;
    return currentPrice && currentPrice > 0 ? currentPrice : fallbackPrice;
  });

export const calculateTotalEquityWithOverrides = (
  portfolio: Portfolio,
  coins: Coin[],
  orders: Order[],
  markPriceOverrides: Record<string, number>
) =>
  calculateTotalEquityWithResolver(portfolio, orders, (coinId, fallbackPrice) => {
    const overridePrice = markPriceOverrides[coinId];
    if (Number.isFinite(overridePrice) && overridePrice > 0) {
      return overridePrice;
    }

    const currentPrice = coins.find((coin) => coin.id === coinId)?.price;
    return currentPrice && currentPrice > 0 ? currentPrice : fallbackPrice;
  });

const getStrategyTriggerFlags = (strategy: StrategyCarrier, high: number, low: number) => {
  const isLong = strategy.amount > 0;
  const takeProfitHit = Boolean(
    strategy.takeProfitPrice &&
    strategy.takeProfitPrice > 0 &&
    ((isLong && high >= strategy.takeProfitPrice) || (!isLong && low <= strategy.takeProfitPrice))
  );
  const stopLossHit = Boolean(
    strategy.stopLossPrice &&
    strategy.stopLossPrice > 0 &&
    ((isLong && low <= strategy.stopLossPrice) || (!isLong && high >= strategy.stopLossPrice))
  );

  return { takeProfitHit, stopLossHit };
};

export const resolveStrategyTriggerWithinCandle = (
  strategy: StrategyCarrier,
  high: number,
  low: number
): { triggerType: ProtectiveTriggerType; executionPrice: number } | null => {
  const { takeProfitHit, stopLossHit } = getStrategyTriggerFlags(strategy, high, low);

  // OHLC data does not preserve intra-candle order. When both bounds are hit, settle
  // defensively at the stop-loss price instead of assuming a favorable take-profit fill.
  if (stopLossHit && strategy.stopLossPrice && strategy.stopLossPrice > 0) {
    return { triggerType: 'SL', executionPrice: strategy.stopLossPrice };
  }
  if (takeProfitHit && strategy.takeProfitPrice && strategy.takeProfitPrice > 0) {
    return { triggerType: 'TP', executionPrice: strategy.takeProfitPrice };
  }

  return null;
};

export const resolveStrategyTriggerAtPrice = (
  strategy: StrategyCarrier,
  markPrice: number
): { triggerType: ProtectiveTriggerType; executionPrice: number } | null =>
  resolveStrategyTriggerWithinCandle(strategy, markPrice, markPrice);

export const hasRemainingExposureAfterSellFill = (
  remainingHoldingAmount: number,
  hasOtherOpenSellOrders: boolean
) => !isDust(remainingHoldingAmount) || hasOtherOpenSellOrders;

export const shouldCountValidTradeOnClose = (
  holding: Pick<Holding, 'meetsVolumeCondition' | 'openedAt'>,
  closeTime: number,
  hasRemainingExposure: boolean
) => {
  if (hasRemainingExposure || !holding.meetsVolumeCondition || !holding.openedAt) return false;
  return Math.max(0, closeTime - holding.openedAt) >= 5 * 60 * 1000;
};
