import { Holding, Order, OrderLotAllocation } from '../types';
import { isDust, roundCrypto, roundPrice, roundUSD } from './math';
import { generateUUID } from './uuid';
import { shouldCountValidTradeOnClose } from './tradeAccounting';

const getHoldingSortTime = (holding: Holding) => holding.openedAt ?? Number.MAX_SAFE_INTEGER;

export const ensureHoldingId = (holding: Holding, fallbackId?: string): Holding => ({
  ...holding,
  id: holding.id || fallbackId || generateUUID(),
});

export const getTotalHoldingAmountForCoin = (holdings: Holding[], coinId: string) =>
  holdings
    .filter((holding) => holding.coinId === coinId)
    .reduce((acc, holding) => acc + holding.amount, 0);

export const sortLotsFifo = (holdings: Holding[]) =>
  [...holdings].sort((left, right) => {
    const timeDelta = getHoldingSortTime(left) - getHoldingSortTime(right);
    if (timeDelta !== 0) return timeDelta;
    return (left.id || '').localeCompare(right.id || '');
  });

export const aggregateHoldingsByCoin = (holdings: Holding[]) => {
  const grouped = new Map<string, Holding[]>();

  for (const rawHolding of holdings) {
    if (isDust(rawHolding.amount)) continue;
    const holding = ensureHoldingId(rawHolding);
    const current = grouped.get(holding.coinId);
    if (current) {
      current.push(holding);
      continue;
    }
    grouped.set(holding.coinId, [holding]);
  }

  return [...grouped.entries()].map(([coinId, coinLots]) => {
    const lots = sortLotsFifo(coinLots);
    const totalAmount = roundCrypto(lots.reduce((acc, lot) => acc + lot.amount, 0));
    const totalCostBasis = lots.reduce((acc, lot) => acc + lot.amount * lot.averageCost, 0);
    const takeProfitPrice = lots.every((lot) => lot.takeProfitPrice === lots[0].takeProfitPrice)
      ? lots[0].takeProfitPrice
      : undefined;
    const stopLossPrice = lots.every((lot) => lot.stopLossPrice === lots[0].stopLossPrice)
      ? lots[0].stopLossPrice
      : undefined;

    const earliestOpenedAt = lots.reduce(
      (earliest, lot) =>
        lot.openedAt && lot.openedAt > 0 ? Math.min(earliest, lot.openedAt) : earliest,
      Number.MAX_SAFE_INTEGER
    );

    return {
      id: `aggregate:${coinId}`,
      coinId,
      amount: totalAmount,
      averageCost: totalAmount > 0 ? roundPrice(totalCostBasis / totalAmount) : 0,
      takeProfitPrice,
      stopLossPrice,
      openedAt: earliestOpenedAt === Number.MAX_SAFE_INTEGER ? undefined : earliestOpenedAt,
      meetsVolumeCondition: lots.some((lot) => lot.meetsVolumeCondition),
    } satisfies Holding;
  });
};

export const getAggregateHoldingForCoin = (holdings: Holding[], coinId: string) =>
  aggregateHoldingsByCoin(holdings).find((holding) => holding.coinId === coinId) || null;

export const getInheritedStrategyForCoin = (holdings: Holding[], coinId: string) => {
  const lots = sortLotsFifo(
    holdings
      .filter((holding) => holding.coinId === coinId)
      .map((holding) => ensureHoldingId(holding))
  );
  const strategyLot = lots.find(
    (lot) =>
      (lot.takeProfitPrice && lot.takeProfitPrice > 0) ||
      (lot.stopLossPrice && lot.stopLossPrice > 0)
  );

  return {
    takeProfitPrice: strategyLot?.takeProfitPrice,
    stopLossPrice: strategyLot?.stopLossPrice,
  };
};

export const applyStrategyToCoinLots = (
  holdings: Holding[],
  coinId: string,
  takeProfitPrice: number | undefined,
  stopLossPrice: number | undefined
) =>
  holdings.map((holding) =>
    holding.coinId === coinId ? { ...holding, takeProfitPrice, stopLossPrice } : holding
  );

export interface SellAllocationResult {
  nextHoldings: Holding[];
  lotAllocations: OrderLotAllocation[];
}

export const allocateLotsForSell = (
  holdings: Holding[],
  coinId: string,
  requestedAmount: number
): SellAllocationResult => {
  let remainingAmount = requestedAmount;
  const nextHoldings = holdings.map((holding, index) =>
    ensureHoldingId(holding, `holding-${holding.coinId}-${index}`)
  );
  const fifoLots = sortLotsFifo(nextHoldings).filter(
    (holding) => holding.coinId === coinId && !isDust(holding.amount)
  );
  const lotAllocations: OrderLotAllocation[] = [];

  for (const holding of fifoLots) {
    if (remainingAmount <= 0) break;

    const existingIndex = nextHoldings.findIndex((candidate) => candidate.id === holding.id);
    if (existingIndex < 0) continue;
    const workingHolding = nextHoldings[existingIndex];
    const allocatedAmount = roundCrypto(Math.min(holding.amount, remainingAmount));
    if (allocatedAmount <= 0) continue;

    const nextAmount = roundCrypto(workingHolding.amount - allocatedAmount);
    lotAllocations.push({
      lotId: holding.id!,
      coinId: holding.coinId,
      amount: allocatedAmount,
      averageCost: holding.averageCost,
      takeProfitPrice: holding.takeProfitPrice,
      stopLossPrice: holding.stopLossPrice,
      openedAt: holding.openedAt,
      meetsVolumeCondition: holding.meetsVolumeCondition,
      wasFullLotClose: isDust(nextAmount),
    });

    if (isDust(nextAmount)) {
      nextHoldings.splice(existingIndex, 1);
    } else {
      nextHoldings[existingIndex] = {
        ...workingHolding,
        amount: nextAmount,
      };
    }

    remainingAmount = roundCrypto(remainingAmount - allocatedAmount);
  }

  return {
    nextHoldings,
    lotAllocations,
  };
};

export const restoreLotsFromAllocations = (
  holdings: Holding[],
  lotAllocations: OrderLotAllocation[]
) => {
  const nextHoldings = holdings.map((holding, index) =>
    ensureHoldingId(holding, `holding-${holding.coinId}-${index}`)
  );

  for (const allocation of lotAllocations) {
    const existingIndex = nextHoldings.findIndex((holding) => holding.id === allocation.lotId);
    if (existingIndex >= 0) {
      nextHoldings[existingIndex] = {
        ...nextHoldings[existingIndex],
        amount: roundCrypto(nextHoldings[existingIndex].amount + allocation.amount),
      };
      continue;
    }

    nextHoldings.push({
      id: allocation.lotId,
      coinId: allocation.coinId,
      amount: allocation.amount,
      averageCost: allocation.averageCost,
      takeProfitPrice: allocation.takeProfitPrice,
      stopLossPrice: allocation.stopLossPrice,
      openedAt: allocation.openedAt,
      meetsVolumeCondition: allocation.meetsVolumeCondition,
    });
  }

  return sortLotsFifo(nextHoldings);
};

export const getAllocationsCostBasis = (lotAllocations: OrderLotAllocation[]) =>
  roundUSD(
    lotAllocations.reduce((acc, allocation) => acc + allocation.amount * allocation.averageCost, 0)
  );

export const hasExecutableLotAllocations = (order: Pick<Order, 'type' | 'lotAllocations'>) =>
  order.type !== 'SELL' ||
  Boolean(order.lotAllocations?.some((allocation) => !isDust(allocation.amount)));

export const hasRemainingExposureForLot = (
  lotId: string | undefined,
  holdings: Holding[],
  orders: Order[]
) => {
  if (!lotId) return false;

  const hasActiveHolding = holdings.some(
    (holding) => holding.id === lotId && !isDust(holding.amount)
  );
  if (hasActiveHolding) return true;

  return orders.some(
    (order) =>
      order.status === 'OPEN' &&
      order.type === 'SELL' &&
      order.lotAllocations?.some(
        (allocation) => allocation.lotId === lotId && !isDust(allocation.amount)
      )
  );
};

export const countValidTradesFromAllocations = (
  lotAllocations: OrderLotAllocation[],
  closeTime: number,
  holdings: Holding[],
  orders: Order[]
) =>
  lotAllocations.reduce((acc, allocation) => {
    const hasRemainingExposure = hasRemainingExposureForLot(allocation.lotId, holdings, orders);
    return (
      acc +
      (shouldCountValidTradeOnClose(
        {
          openedAt: allocation.openedAt,
          meetsVolumeCondition: allocation.meetsVolumeCondition,
        },
        closeTime,
        hasRemainingExposure
      )
        ? 1
        : 0)
    );
  }, 0);

export const shouldCountValidTradeForClosedHolding = (
  holding: Pick<Holding, 'id' | 'openedAt' | 'meetsVolumeCondition'>,
  closeTime: number,
  holdings: Holding[],
  orders: Order[]
) =>
  shouldCountValidTradeOnClose(
    {
      openedAt: holding.openedAt,
      meetsVolumeCondition: holding.meetsVolumeCondition,
    },
    closeTime,
    hasRemainingExposureForLot(holding.id, holdings, orders)
  );

export const createHoldingLot = (holding: Omit<Holding, 'id'> & { id?: string }): Holding =>
  ensureHoldingId({
    ...holding,
    amount: roundCrypto(holding.amount),
  });
