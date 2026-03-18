import { Coin, Holding, Order, Portfolio } from '../types';
import { isDust } from './math';

export interface AccountEquitySnapshot {
  portfolioValue: number;
  lockedInOrders: number;
  totalEquity: number;
  isPriceDataComplete: boolean;
}

export const getHistoricalMarkPrice = (coin?: Pick<Coin, 'history'>) => {
  if (!coin?.history?.length) return null;

  for (let index = coin.history.length - 1; index >= 0; index -= 1) {
    const candidate = coin.history[index];
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return null;
};

export const getMarkPrice = (coin?: Pick<Coin, 'price' | 'history'>) => {
  if (coin && Number.isFinite(coin.price) && coin.price > 0) {
    return coin.price;
  }

  return getHistoricalMarkPrice(coin);
};

export const getHoldingMarketValue = (
  holding: Pick<Holding, 'amount'>,
  coin?: Pick<Coin, 'price' | 'history'>
) => {
  const markPrice = getMarkPrice(coin);
  if (markPrice === null) return null;
  return holding.amount * markPrice;
};

export const getOpenOrderMarketValue = (
  order: Pick<Order, 'status' | 'type' | 'amount' | 'total'>,
  coin?: Pick<Coin, 'price' | 'history'>
) => {
  if (order.status !== 'OPEN') return 0;
  if (order.type === 'BUY') return order.total;

  const markPrice = getMarkPrice(coin);
  if (markPrice === null) return null;
  return order.amount * markPrice;
};

export const calculateAccountEquitySnapshot = (
  portfolio: Pick<Portfolio, 'balance' | 'holdings'>,
  orders: Order[],
  coins: Coin[]
): AccountEquitySnapshot => {
  const coinsById = new Map(coins.map((coin) => [coin.id, coin]));
  let portfolioValue = portfolio.balance;
  let lockedInOrders = 0;
  let isPriceDataComplete = true;

  for (const holding of portfolio.holdings) {
    if (isDust(holding.amount)) continue;

    const marketValue = getHoldingMarketValue(holding, coinsById.get(holding.coinId));
    if (marketValue === null) {
      isPriceDataComplete = false;
      continue;
    }

    portfolioValue += marketValue;
  }

  for (const order of orders) {
    const marketValue = getOpenOrderMarketValue(order, coinsById.get(order.coinId));
    if (marketValue === null) {
      isPriceDataComplete = false;
      continue;
    }

    lockedInOrders += marketValue;
  }

  return {
    portfolioValue,
    lockedInOrders,
    totalEquity: portfolioValue + lockedInOrders,
    isPriceDataComplete,
  };
};
