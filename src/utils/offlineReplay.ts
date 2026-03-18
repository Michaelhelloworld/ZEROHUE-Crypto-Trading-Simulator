import { TRADING_FEE_RATE } from '../constants/data';
import { Coin, Holding, Order, OrderLotAllocation, Portfolio, Transaction } from '../types';
import { roundCrypto, roundPrice, roundUSD, isDust } from './math';
import {
  calculateTotalEquityWithOverrides,
  ProtectiveTriggerType,
  resolveStrategyTriggerWithinCandle,
} from './tradeAccounting';
import {
  countValidTradesFromAllocations,
  createHoldingLot,
  getAllocationsCostBasis,
  hasExecutableLotAllocations,
  shouldCountValidTradeForClosedHolding,
} from './lotAccounting';
import { generateUUID } from './uuid';
import { ReplaySource } from './replayWindow';

interface OfflineExecutionCheckResult {
  executed: boolean;
  executionPrice: number;
  executionTime: number;
}

interface OfflineHoldingTriggerResult extends OfflineExecutionCheckResult {
  triggerType: ProtectiveTriggerType | null;
}

export interface CandleBar {
  time: number;
  high: number;
  low: number;
}

export interface ReplayCandlesFetchResult {
  candles: CandleBar[];
  failed: boolean;
}

export interface ReplayOrderCandidate {
  order: Order;
  replayStartTime: number;
  source: ReplaySource;
}

export interface ReplayHoldingCandidate {
  holding: Holding;
  coinSymbol: string;
  replayStartTime: number;
  source: ReplaySource;
}

interface ReplayHoldingState {
  holding: Holding;
  coinSymbol: string;
  replayStartTime: number;
}

export interface ReservedLotTriggerExecution {
  allocation: OrderLotAllocation;
  executionPrice: number;
  triggerType: ProtectiveTriggerType;
}

interface ReservedOrderCandleResolution {
  protectiveExecutions: ReservedLotTriggerExecution[];
  limitFillOrder: Order | null;
}

export interface SymbolReplayResult {
  events: Array<
    | {
        type: 'FILL';
        order: Order;
        executionPrice: number;
        executionTime: number;
      }
    | {
        type: 'TRIGGER';
        holding: Holding;
        coinSymbol: string;
        executionPrice: number;
        executionTime: number;
      }
    | {
        type: 'ORDER_TRIGGER';
        orderId: string;
        coinId: string;
        coinSymbol: string;
        executionTime: number;
        executions: ReservedLotTriggerExecution[];
      }
    | {
        type: 'CANCEL';
        orderId: string;
        executionTime: number;
      }
  >;
  hadFetchFailure?: boolean;
}

export type ReplayEvent = SymbolReplayResult['events'][number];

const cloneOrdersSnapshot = (orders: Order[]) =>
  orders.map((order) => ({
    ...order,
    lotAllocations: order.lotAllocations?.map((allocation) => ({ ...allocation })),
  }));

export const hasStrategy = (holding: Holding) =>
  (holding.takeProfitPrice && holding.takeProfitPrice > 0) ||
  (holding.stopLossPrice && holding.stopLossPrice > 0);

export const createHoldingFromFilledBuy = (
  order: Order,
  executionPrice: number,
  executionTime: number,
  isBigEnough = false
): Holding => {
  const effectiveAmount = order.amount * (1 - TRADING_FEE_RATE);

  return createHoldingLot({
    coinId: order.coinId,
    amount: roundCrypto(effectiveAmount),
    averageCost: roundPrice(executionPrice / (1 - TRADING_FEE_RATE)),
    takeProfitPrice: order.takeProfitPrice,
    stopLossPrice: order.stopLossPrice,
    openedAt: executionTime,
    meetsVolumeCondition: isBigEnough,
  });
};

export const getRemainingOrderAfterReservedExecutions = (
  order: Order,
  executions: ReservedLotTriggerExecution[],
  executionTime: number
): Order | null => {
  if (!order.lotAllocations?.length) return null;

  const triggeredLotIds = new Set(executions.map((execution) => execution.allocation.lotId));
  const remainingAllocations = order.lotAllocations.filter(
    (allocation) => !triggeredLotIds.has(allocation.lotId)
  );

  if (remainingAllocations.length === 0) {
    return null;
  }

  const remainingAmount = roundCrypto(
    remainingAllocations.reduce((acc, allocation) => acc + allocation.amount, 0)
  );

  return {
    ...order,
    amount: remainingAmount,
    total: roundUSD(remainingAmount * order.limitPrice),
    lotAllocations: remainingAllocations,
    updatedAt: executionTime,
  };
};

export const resolveReservedOrderTriggers = (
  order: Order,
  high: number,
  low: number
): ReservedLotTriggerExecution[] => {
  if (order.type !== 'SELL' || !order.lotAllocations?.length) return [];

  return order.lotAllocations.flatMap((allocation) => {
    if (isDust(allocation.amount)) return [];

    const trigger = resolveStrategyTriggerWithinCandle(
      {
        amount: allocation.amount,
        takeProfitPrice: allocation.takeProfitPrice,
        stopLossPrice: allocation.stopLossPrice,
      },
      high,
      low
    );

    return trigger
      ? [
          {
            allocation: { ...allocation },
            executionPrice: trigger.executionPrice,
            triggerType: trigger.triggerType,
          },
        ]
      : [];
  });
};

export const resolveReservedOrderExecutionsWithinCandle = (
  order: Order,
  high: number,
  low: number
): ReservedOrderCandleResolution => {
  const limitTriggered = order.type === 'SELL' && high >= order.limitPrice;
  if (order.type !== 'SELL') {
    return { protectiveExecutions: [], limitFillOrder: null };
  }

  if (!hasExecutableLotAllocations(order)) {
    return {
      protectiveExecutions: [],
      limitFillOrder: null,
    };
  }

  const protectiveExecutions = resolveReservedOrderTriggers(order, high, low).filter(
    (execution) => !limitTriggered || execution.executionPrice < order.limitPrice
  );
  const limitFillOrder = limitTriggered
    ? protectiveExecutions.length > 0
      ? getRemainingOrderAfterReservedExecutions(order, protectiveExecutions, 0)
      : {
          ...order,
          updatedAt: undefined,
        }
    : null;

  return {
    protectiveExecutions,
    limitFillOrder:
      limitFillOrder && !isDust(limitFillOrder.amount)
        ? {
            ...limitFillOrder,
            updatedAt: undefined,
          }
        : null,
  };
};

export const resolveHoldingTrigger = (
  holding: Holding,
  high: number,
  low: number
): { triggerType: ProtectiveTriggerType; executionPrice: number } | null =>
  resolveStrategyTriggerWithinCandle(holding, high, low);

export const resolveSymbolReplay = (
  orderCandidates: ReplayOrderCandidate[],
  holdingCandidates: ReplayHoldingCandidate[],
  candles: CandleBar[]
): SymbolReplayResult => {
  const pendingOrders: ReplayOrderCandidate[] = orderCandidates.map((candidate) => ({
    ...candidate,
    order: {
      ...candidate.order,
      lotAllocations: candidate.order.lotAllocations?.map((allocation) => ({ ...allocation })),
    },
  }));
  const workingHoldings: ReplayHoldingState[] = holdingCandidates.map((candidate, index) => ({
    holding: { ...candidate.holding, id: candidate.holding.id || `replay-holding-${index}` },
    coinSymbol: candidate.coinSymbol,
    replayStartTime: candidate.replayStartTime,
  }));

  const events: SymbolReplayResult['events'] = [];

  for (let index = 0; index < pendingOrders.length; index += 1) {
    const candidate = pendingOrders[index];
    if (candidate.order.type !== 'SELL' || hasExecutableLotAllocations(candidate.order)) {
      continue;
    }

    events.push({
      type: 'CANCEL',
      orderId: candidate.order.id,
      executionTime: candidate.replayStartTime,
    });
    pendingOrders.splice(index, 1);
    index -= 1;
  }

  for (const candle of candles) {
    for (let index = 0; index < pendingOrders.length; index += 1) {
      const candidate = pendingOrders[index];
      if (candle.time < candidate.replayStartTime) continue;

      const order = candidate.order;
      if (order.type === 'BUY' && candle.low <= order.limitPrice) {
        events.push({
          type: 'FILL',
          order,
          executionPrice: order.limitPrice,
          executionTime: candle.time,
        });

        workingHoldings.push({
          holding: createHoldingFromFilledBuy(order, order.limitPrice, candle.time),
          coinSymbol: order.coinSymbol,
          replayStartTime: candle.time + 1,
        });

        pendingOrders.splice(index, 1);
        index -= 1;
        continue;
      }

      const { protectiveExecutions, limitFillOrder } = resolveReservedOrderExecutionsWithinCandle(
        order,
        candle.high,
        candle.low
      );
      if (protectiveExecutions.length > 0) {
        events.push({
          type: 'ORDER_TRIGGER',
          orderId: order.id,
          coinId: order.coinId,
          coinSymbol: order.coinSymbol,
          executionTime: candle.time,
          executions: protectiveExecutions,
        });
      }

      if (limitFillOrder) {
        events.push({
          type: 'FILL',
          order: {
            ...limitFillOrder,
            updatedAt: candle.time,
          },
          executionPrice: order.limitPrice,
          executionTime: candle.time,
        });
        pendingOrders.splice(index, 1);
        index -= 1;
        continue;
      }

      if (protectiveExecutions.length === 0) continue;

      const remainingOrder = getRemainingOrderAfterReservedExecutions(
        order,
        protectiveExecutions,
        candle.time
      );
      if (!remainingOrder) {
        pendingOrders.splice(index, 1);
        index -= 1;
        continue;
      }

      pendingOrders[index] = {
        ...candidate,
        order: remainingOrder,
      };
    }

    for (let holdingIndex = 0; holdingIndex < workingHoldings.length; holdingIndex += 1) {
      const workingHolding = workingHoldings[holdingIndex];
      if (
        isDust(workingHolding.holding.amount) ||
        candle.time < workingHolding.replayStartTime ||
        !hasStrategy(workingHolding.holding)
      ) {
        continue;
      }

      const trigger = resolveHoldingTrigger(workingHolding.holding, candle.high, candle.low);
      if (!trigger) continue;

      events.push({
        type: 'TRIGGER',
        holding: { ...workingHolding.holding },
        coinSymbol: workingHolding.coinSymbol,
        executionPrice: trigger.executionPrice,
        executionTime: candle.time,
      });

      workingHoldings.splice(holdingIndex, 1);
      holdingIndex -= 1;
    }
  }

  return { events };
};

export const processFilledOrder = (
  order: Order,
  executionPrice: number,
  executionTime: number,
  newOrders: Order[],
  newTransactions: Transaction[],
  portfolioUpdates: Array<(prev: Portfolio) => Portfolio>,
  coins: Coin[]
): 'FILLED' | 'CANCELLED' | 'SKIPPED' => {
  const orderIndex = newOrders.findIndex((candidate) => candidate.id === order.id);
  if (orderIndex < 0) return 'SKIPPED';

  const currentOrder = newOrders[orderIndex];
  if (currentOrder.status !== 'OPEN') return 'SKIPPED';

  if (currentOrder.type === 'SELL' && !hasExecutableLotAllocations(currentOrder)) {
    newOrders[orderIndex] = {
      ...currentOrder,
      status: 'CANCELLED',
      amount: 0,
      total: 0,
      lotAllocations: [],
      updatedAt: executionTime,
    };
    return 'CANCELLED';
  }

  newOrders[orderIndex] = {
    ...currentOrder,
    status: 'FILLED',
    updatedAt: executionTime,
  };
  const ordersSnapshot = cloneOrdersSnapshot(newOrders);

  const totalValue = roundUSD(order.amount * executionPrice);
  const fee = roundUSD(totalValue * TRADING_FEE_RATE);

  newTransactions.push({
    id: generateUUID(),
    type: order.type,
    coinId: order.coinId,
    coinSymbol: order.coinSymbol,
    amount: order.amount,
    pricePerCoin: executionPrice,
    total: totalValue,
    fee,
    timestamp: executionTime,
    updatedAt: executionTime,
  });

  if (order.type === 'BUY') {
    portfolioUpdates.push((prev: Portfolio) => {
      const next = { ...prev, holdings: [...prev.holdings] };
      const lockedAmount = order.total;
      const actualCost = totalValue;
      if (lockedAmount > actualCost) {
        next.balance = roundUSD(next.balance + (lockedAmount - actualCost));
      }

      const openOrdersBeforeFill = ordersSnapshot.map((candidate, index) =>
        index === orderIndex ? order : candidate
      );
      const totalEquity = calculateTotalEquityWithOverrides(prev, coins, openOrdersBeforeFill, {
        [order.coinId]: executionPrice,
      });
      const isBigEnough = actualCost >= totalEquity * 0.05;
      next.holdings.push(
        createHoldingFromFilledBuy(order, executionPrice, executionTime, isBigEnough)
      );
      return next;
    });
    return 'FILLED';
  }

  portfolioUpdates.push((prev: Portfolio) => {
    const next = { ...prev, holdings: [...prev.holdings] };
    const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
    const lotAllocations = order.lotAllocations || [];
    const costBasis =
      lotAllocations.length > 0
        ? getAllocationsCostBasis(lotAllocations)
        : order.amount * executionPrice;
    const realizedPnL = proceeds - costBasis;

    let newGrossProfit = next.grossProfit || 0;
    let newGrossLoss = next.grossLoss || 0;
    if (realizedPnL > 0) newGrossProfit += realizedPnL;
    if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

    next.grossProfit = newGrossProfit;
    next.grossLoss = newGrossLoss;
    next.validTradesCount =
      (next.validTradesCount || 0) +
      countValidTradesFromAllocations(lotAllocations, executionTime, next.holdings, ordersSnapshot);

    next.balance = roundUSD(next.balance + proceeds);
    return next;
  });
  return 'FILLED';
};

export const updateOrderAfterReservedTrigger = (
  order: Order,
  executions: ReservedLotTriggerExecution[],
  executionTime: number
): Order => {
  const remainingOrder = getRemainingOrderAfterReservedExecutions(order, executions, executionTime);
  if (!remainingOrder) {
    return {
      ...order,
      status: 'CANCELLED',
      amount: 0,
      total: 0,
      lotAllocations: [],
      updatedAt: executionTime,
    };
  }

  return remainingOrder;
};

export const applyReservedExecutionsToPortfolio = (
  portfolio: Portfolio,
  coinSymbol: string,
  executions: ReservedLotTriggerExecution[],
  executionTime: number,
  newTransactions: Transaction[],
  openOrders: Order[]
) => {
  let nextPortfolio = portfolio;
  let appliedCount = 0;

  for (const execution of executions) {
    const { allocation, executionPrice } = execution;
    if (isDust(allocation.amount)) continue;

    const totalValue = roundUSD(allocation.amount * executionPrice);
    const fee = roundUSD(totalValue * TRADING_FEE_RATE);
    newTransactions.push({
      id: generateUUID(),
      type: 'SELL',
      coinId: allocation.coinId,
      coinSymbol,
      amount: allocation.amount,
      pricePerCoin: executionPrice,
      total: totalValue,
      fee,
      timestamp: executionTime,
      updatedAt: executionTime,
    });

    const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
    const costBasis = roundUSD(allocation.amount * allocation.averageCost);
    const realizedPnL = proceeds - costBasis;

    let newGrossProfit = nextPortfolio.grossProfit || 0;
    let newGrossLoss = nextPortfolio.grossLoss || 0;
    if (realizedPnL > 0) newGrossProfit += realizedPnL;
    if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

    nextPortfolio = {
      ...nextPortfolio,
      grossProfit: newGrossProfit,
      grossLoss: newGrossLoss,
      balance: roundUSD(nextPortfolio.balance + proceeds),
      validTradesCount:
        (nextPortfolio.validTradesCount || 0) +
        countValidTradesFromAllocations(
          [allocation],
          executionTime,
          nextPortfolio.holdings,
          openOrders
        ),
    };
    appliedCount += 1;
  }

  return { nextPortfolio, appliedCount };
};

export const processReservedOrderTrigger = (
  orderId: string,
  coinSymbol: string,
  executions: ReservedLotTriggerExecution[],
  executionTime: number,
  newOrders: Order[],
  newTransactions: Transaction[],
  portfolioUpdates: Array<(prev: Portfolio) => Portfolio>
) => {
  const orderIndex = newOrders.findIndex((order) => order.id === orderId);
  if (orderIndex < 0) return;

  const order = newOrders[orderIndex];
  if (order.status !== 'OPEN') return;

  const allowedLotIds = new Set(order.lotAllocations?.map((allocation) => allocation.lotId) || []);
  const safeExecutions = executions.filter((execution) =>
    allowedLotIds.has(execution.allocation.lotId)
  );
  if (safeExecutions.length === 0) return;

  newOrders[orderIndex] = updateOrderAfterReservedTrigger(order, safeExecutions, executionTime);
  const ordersSnapshot = cloneOrdersSnapshot(newOrders);
  portfolioUpdates.push(
    (prev: Portfolio) =>
      applyReservedExecutionsToPortfolio(
        prev,
        coinSymbol,
        safeExecutions,
        executionTime,
        newTransactions,
        ordersSnapshot
      ).nextPortfolio
  );
};

export const applyReservedOrderTriggerToState = (
  orderId: string,
  coinSymbol: string,
  executions: ReservedLotTriggerExecution[],
  executionTime: number,
  nextOrders: Order[],
  nextPortfolio: Portfolio,
  newTransactions: Transaction[]
) => {
  const orderIndex = nextOrders.findIndex((order) => order.id === orderId);
  if (orderIndex < 0) return 0;

  const order = nextOrders[orderIndex];
  if (order.status !== 'OPEN') return 0;

  const allowedLotIds = new Set(order.lotAllocations?.map((allocation) => allocation.lotId) || []);
  const safeExecutions = executions.filter((execution) =>
    allowedLotIds.has(execution.allocation.lotId)
  );
  if (safeExecutions.length === 0) return 0;

  nextOrders[orderIndex] = updateOrderAfterReservedTrigger(order, safeExecutions, executionTime);
  const appliedResult = applyReservedExecutionsToPortfolio(
    nextPortfolio,
    coinSymbol,
    safeExecutions,
    executionTime,
    newTransactions,
    nextOrders
  );

  nextPortfolio.balance = appliedResult.nextPortfolio.balance;
  nextPortfolio.grossProfit = appliedResult.nextPortfolio.grossProfit;
  nextPortfolio.grossLoss = appliedResult.nextPortfolio.grossLoss;
  nextPortfolio.validTradesCount = appliedResult.nextPortfolio.validTradesCount;

  return appliedResult.appliedCount;
};

export const processTriggeredHolding = (
  holding: Holding,
  coinSymbol: string,
  executionPrice: number,
  executionTime: number,
  newOrders: Order[],
  newTransactions: Transaction[],
  portfolioUpdates: Array<(prev: Portfolio) => Portfolio>
) => {
  const ordersSnapshot = cloneOrdersSnapshot(newOrders);
  const isLong = holding.amount > 0;
  const currentPositionValue = holding.amount * executionPrice;
  const fee = roundUSD(currentPositionValue * TRADING_FEE_RATE);

  newTransactions.push({
    id: generateUUID(),
    type: isLong ? 'SELL' : 'BUY',
    coinId: holding.coinId,
    coinSymbol,
    amount: Math.abs(holding.amount),
    pricePerCoin: executionPrice,
    total: currentPositionValue,
    fee,
    timestamp: executionTime,
    updatedAt: executionTime,
  });

  portfolioUpdates.push((prev: Portfolio) => {
    const next = { ...prev, holdings: [...prev.holdings] };
    const holdingIndex = next.holdings.findIndex((candidate) => candidate.id === holding.id);
    if (holdingIndex < 0) return next;

    const currentHolding = next.holdings[holdingIndex];
    const closedValue = currentHolding.amount * executionPrice;
    const proceeds = roundUSD(closedValue * (1 - TRADING_FEE_RATE));
    const costBasis = currentHolding.amount * currentHolding.averageCost;
    const realizedPnL = proceeds - costBasis;

    let newGrossProfit = next.grossProfit || 0;
    let newGrossLoss = next.grossLoss || 0;
    if (realizedPnL > 0) newGrossProfit += realizedPnL;
    if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

    next.grossProfit = newGrossProfit;
    next.grossLoss = newGrossLoss;
    next.balance = roundUSD(next.balance + proceeds);
    next.holdings.splice(holdingIndex, 1);
    next.validTradesCount =
      (next.validTradesCount || 0) +
      (shouldCountValidTradeForClosedHolding(
        currentHolding,
        executionTime,
        next.holdings,
        ordersSnapshot
      )
        ? 1
        : 0);

    return next;
  });
};

export const applyReplayEventsInChronologicalOrder = (
  replayEvents: ReplayEvent[],
  newOrders: Order[],
  newTransactions: Transaction[],
  portfolioUpdates: Array<(prev: Portfolio) => Portfolio>,
  coins: Coin[]
) => {
  let filledCount = 0;
  let triggeredHoldingCount = 0;
  let cancelledCount = 0;

  const orderedEvents = [...replayEvents].sort(
    (left, right) => left.executionTime - right.executionTime
  );

  for (const event of orderedEvents) {
    if (event.type === 'CANCEL') {
      const orderIndex = newOrders.findIndex((order) => order.id === event.orderId);
      if (orderIndex < 0 || newOrders[orderIndex].status !== 'OPEN') continue;

      newOrders[orderIndex] = {
        ...newOrders[orderIndex],
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
        updatedAt: event.executionTime,
      };
      cancelledCount += 1;
      continue;
    }

    if (event.type === 'FILL') {
      const result = processFilledOrder(
        event.order,
        event.executionPrice,
        event.executionTime,
        newOrders,
        newTransactions,
        portfolioUpdates,
        coins
      );
      if (result === 'FILLED') filledCount += 1;
      if (result === 'CANCELLED') cancelledCount += 1;
      continue;
    }

    if (event.type === 'ORDER_TRIGGER') {
      triggeredHoldingCount += event.executions.length;
      processReservedOrderTrigger(
        event.orderId,
        event.coinSymbol,
        event.executions,
        event.executionTime,
        newOrders,
        newTransactions,
        portfolioUpdates
      );
      continue;
    }

    triggeredHoldingCount += 1;
    processTriggeredHolding(
      event.holding,
      event.coinSymbol,
      event.executionPrice,
      event.executionTime,
      newOrders,
      newTransactions,
      portfolioUpdates
    );
  }

  return { filledCount, triggeredHoldingCount, cancelledCount };
};

export const applyReplayEventsToState = (
  replayEvents: ReplayEvent[],
  currentOrders: Order[],
  currentPortfolio: Portfolio,
  coins: Coin[]
) => {
  const nextOrders = [...currentOrders];
  const nextPortfolio = { ...currentPortfolio, holdings: [...currentPortfolio.holdings] };
  const newTransactions: Transaction[] = [];
  let filledCount = 0;
  let triggeredHoldingCount = 0;
  let cancelledCount = 0;

  const orderedEvents = [...replayEvents].sort(
    (left, right) => left.executionTime - right.executionTime
  );

  for (const event of orderedEvents) {
    if (event.type === 'CANCEL') {
      const orderIndex = nextOrders.findIndex((order) => order.id === event.orderId);
      if (orderIndex < 0) continue;

      const order = nextOrders[orderIndex];
      if (order.status !== 'OPEN') continue;

      nextOrders[orderIndex] = {
        ...order,
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
        updatedAt: event.executionTime,
      };
      cancelledCount += 1;
      continue;
    }

    if (event.type === 'FILL') {
      const orderIndex = nextOrders.findIndex((order) => order.id === event.order.id);
      if (orderIndex < 0) continue;

      const order = nextOrders[orderIndex];
      if (order.status !== 'OPEN') continue;
      if (order.type === 'SELL' && !hasExecutableLotAllocations(order)) {
        nextOrders[orderIndex] = {
          ...order,
          status: 'CANCELLED',
          amount: 0,
          total: 0,
          lotAllocations: [],
          updatedAt: event.executionTime,
        };
        cancelledCount += 1;
        continue;
      }

      const totalValue = roundUSD(order.amount * event.executionPrice);
      const fee = roundUSD(totalValue * TRADING_FEE_RATE);

      newTransactions.push({
        id: generateUUID(),
        type: order.type,
        coinId: order.coinId,
        coinSymbol: order.coinSymbol,
        amount: order.amount,
        pricePerCoin: event.executionPrice,
        total: totalValue,
        fee,
        timestamp: event.executionTime,
        updatedAt: event.executionTime,
      });

      if (order.type === 'BUY') {
        const ordersBeforeFill = nextOrders.map((candidate, index) =>
          index === orderIndex ? order : candidate
        );
        const lockedAmount = order.total;
        const actualCost = totalValue;
        if (lockedAmount > actualCost) {
          nextPortfolio.balance = roundUSD(nextPortfolio.balance + (lockedAmount - actualCost));
        }

        const totalEquity = calculateTotalEquityWithOverrides(
          nextPortfolio,
          coins,
          ordersBeforeFill,
          { [order.coinId]: event.executionPrice }
        );
        const isBigEnough = actualCost >= totalEquity * 0.05;
        nextPortfolio.holdings.push(
          createHoldingFromFilledBuy(order, event.executionPrice, event.executionTime, isBigEnough)
        );
      } else {
        nextOrders[orderIndex] = {
          ...order,
          status: 'FILLED',
          updatedAt: event.executionTime,
        };

        const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
        const lotAllocations = order.lotAllocations || [];
        const costBasis =
          lotAllocations.length > 0
            ? getAllocationsCostBasis(lotAllocations)
            : order.amount * event.executionPrice;
        const realizedPnL = proceeds - costBasis;

        let newGrossProfit = nextPortfolio.grossProfit || 0;
        let newGrossLoss = nextPortfolio.grossLoss || 0;
        if (realizedPnL > 0) newGrossProfit += realizedPnL;
        if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

        let newValidCount = nextPortfolio.validTradesCount || 0;
        newValidCount += countValidTradesFromAllocations(
          lotAllocations,
          event.executionTime,
          nextPortfolio.holdings,
          nextOrders
        );

        nextPortfolio.grossProfit = newGrossProfit;
        nextPortfolio.grossLoss = newGrossLoss;
        nextPortfolio.validTradesCount = newValidCount;

        nextPortfolio.balance = roundUSD(nextPortfolio.balance + proceeds);
      }
      filledCount += 1;
      continue;
    }

    if (event.type === 'ORDER_TRIGGER') {
      const appliedCount = applyReservedOrderTriggerToState(
        event.orderId,
        event.coinSymbol,
        event.executions,
        event.executionTime,
        nextOrders,
        nextPortfolio,
        newTransactions
      );
      triggeredHoldingCount += appliedCount;
      continue;
    }

    const holdingIndex = nextPortfolio.holdings.findIndex(
      (holding) => holding.id === event.holding.id
    );
    if (holdingIndex < 0) continue;

    const holding = nextPortfolio.holdings[holdingIndex];
    if (isDust(holding.amount)) continue;

    const isLong = holding.amount > 0;
    const currentPositionValue = holding.amount * event.executionPrice;
    const fee = roundUSD(currentPositionValue * TRADING_FEE_RATE);

    newTransactions.push({
      id: generateUUID(),
      type: isLong ? 'SELL' : 'BUY',
      coinId: holding.coinId,
      coinSymbol: event.coinSymbol,
      amount: Math.abs(holding.amount),
      pricePerCoin: event.executionPrice,
      total: currentPositionValue,
      fee,
      timestamp: event.executionTime,
      updatedAt: event.executionTime,
    });

    const closedValue = holding.amount * event.executionPrice;
    const proceeds = roundUSD(closedValue * (1 - TRADING_FEE_RATE));
    const costBasis = holding.amount * holding.averageCost;
    const realizedPnL = proceeds - costBasis;

    let newGrossProfit = nextPortfolio.grossProfit || 0;
    let newGrossLoss = nextPortfolio.grossLoss || 0;
    if (realizedPnL > 0) newGrossProfit += realizedPnL;
    if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

    nextPortfolio.grossProfit = newGrossProfit;
    nextPortfolio.grossLoss = newGrossLoss;
    nextPortfolio.balance = roundUSD(nextPortfolio.balance + proceeds);
    nextPortfolio.holdings.splice(holdingIndex, 1);
    nextPortfolio.validTradesCount =
      (nextPortfolio.validTradesCount || 0) +
      (shouldCountValidTradeForClosedHolding(
        holding,
        event.executionTime,
        nextPortfolio.holdings,
        nextOrders
      )
        ? 1
        : 0);

    triggeredHoldingCount += 1;
  }

  return {
    nextOrders,
    nextPortfolio,
    newTransactions,
    filledCount,
    triggeredHoldingCount,
    cancelledCount,
  };
};

export const dedupeAndSortCandles = (candles: CandleBar[]): CandleBar[] => {
  const byTime = new Map<number, CandleBar>();
  for (const candle of candles) {
    byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((left, right) => left.time - right.time);
};

export const pushGroupedCandidate = <T>(
  groupMap: Map<string, T[]>,
  symbol: string,
  candidate: T
) => {
  const current = groupMap.get(symbol);
  if (current) {
    current.push(candidate);
    return;
  }
  groupMap.set(symbol, [candidate]);
};

export const resolveOrderExecutionFromCandles = (
  order: Order,
  replayStartTime: number,
  candles: CandleBar[]
): OfflineExecutionCheckResult => {
  for (const candle of candles) {
    if (candle.time < replayStartTime) continue;
    if (order.type === 'BUY' && candle.low <= order.limitPrice) {
      return { executed: true, executionPrice: order.limitPrice, executionTime: candle.time };
    }
    if (
      order.type === 'SELL' &&
      hasExecutableLotAllocations(order) &&
      candle.high >= order.limitPrice
    ) {
      return { executed: true, executionPrice: order.limitPrice, executionTime: candle.time };
    }
  }
  return { executed: false, executionPrice: 0, executionTime: 0 };
};

export const resolveHoldingExecutionFromCandles = (
  holding: Holding,
  replayStartTime: number,
  candles: CandleBar[]
): OfflineHoldingTriggerResult => {
  for (const candle of candles) {
    if (candle.time < replayStartTime) continue;
    const trigger = resolveHoldingTrigger(holding, candle.high, candle.low);
    if (trigger) {
      return {
        executed: true,
        executionPrice: trigger.executionPrice,
        executionTime: candle.time,
        triggerType: trigger.triggerType,
      };
    }
  }
  return { executed: false, executionPrice: 0, executionTime: 0, triggerType: null };
};
