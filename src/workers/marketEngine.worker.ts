import { Transaction } from '../types';
import { TRADING_FEE_RATE } from '../constants/data';
import { roundUSD, roundPrice, isDust } from '../utils/math';
import { EngineInput, EngineNotification, EngineOutput } from '../utils/engineProtocol';
import { calculateLiveTotalEquity, resolveStrategyTriggerAtPrice } from '../utils/tradeAccounting';
import {
  countValidTradesFromAllocations,
  createHoldingLot,
  getAllocationsCostBasis,
  hasExecutableLotAllocations,
  shouldCountValidTradeForClosedHolding,
} from '../utils/lotAccounting';
import { generateUUID } from '../utils/uuid';

// Ensure TypeScript treats this as a module for a Web Worker
const ctx = self as unknown as Worker;

export const processTick = (payload: EngineInput['payload']): EngineOutput['payload'] | null => {
  const { coins, orders, portfolio } = payload;
  if (!coins || coins.length === 0) {
    return {
      requestId: payload.requestId ?? 0,
      requestVersion: payload.requestVersion ?? 0,
      portfolioUpdates: null,
      nextOrders: null,
      newTransactions: [],
      notifications: [],
    };
  }

  const nextPortfolio = { ...portfolio, holdings: [...(portfolio.holdings || [])] };
  const nextOrders = orders.map((order) => ({
    ...order,
    lotAllocations: order.lotAllocations?.map((allocation) => ({ ...allocation })),
  }));
  let portfolioChanged = false;
  let ordersChanged = false;

  const newTransactions: Transaction[] = [];
  const notifications: EngineNotification[] = [];
  const newlyOpenedHoldingIds = new Set<string>();
  const openOrders = nextOrders.filter((order) => order.status === 'OPEN');

  // --- ORDER MATCHING ---
  openOrders.forEach((order) => {
    const coin = coins.find((c) => c.id === order.coinId);
    if (!coin || coin.price <= 0) return;
    const orderIndex = nextOrders.findIndex((candidate) => candidate.id === order.id);
    if (orderIndex < 0) return;

    if (order.type === 'SELL' && !hasExecutableLotAllocations(order)) {
      ordersChanged = true;
      nextOrders[orderIndex] = {
        ...order,
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
        updatedAt: Date.now(),
      };
      return;
    }

    let filled = false;

    if (order.type === 'BUY' && coin.price <= order.limitPrice) {
      filled = true;
    } else if (order.type === 'SELL' && coin.price >= order.limitPrice) {
      filled = true;
    }

    if (filled) {
      portfolioChanged = true;
      ordersChanged = true;
      nextOrders[orderIndex] = {
        ...order,
        status: 'FILLED',
        updatedAt: Date.now(),
      };

      // Keep deterministic execution semantics and align with offline replay:
      // limit orders settle at the configured trigger price.
      const executionPrice = order.limitPrice;
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
        fee: fee,
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });

      if (order.type === 'BUY') {
        const lockedAmount = order.total;
        const actualCost = totalValue;

        if (lockedAmount > actualCost) {
          nextPortfolio.balance = roundUSD(nextPortfolio.balance + (lockedAmount - actualCost));
        }

        const effectiveAmount = order.amount * (1 - TRADING_FEE_RATE);
        const openOrdersBeforeFill = nextOrders.map((candidate, index) =>
          index === orderIndex ? order : candidate
        );
        const totalEquity = calculateLiveTotalEquity(nextPortfolio, coins, openOrdersBeforeFill);
        const isBigEnough = actualCost >= totalEquity * 0.05;
        const nextHolding = createHoldingLot({
          coinId: order.coinId,
          amount: effectiveAmount,
          averageCost: roundPrice(executionPrice / (1 - TRADING_FEE_RATE)),
          takeProfitPrice: order.takeProfitPrice,
          stopLossPrice: order.stopLossPrice,
          openedAt: Date.now(),
          meetsVolumeCondition: isBigEnough,
        });
        nextPortfolio.holdings.push(nextHolding);
        newlyOpenedHoldingIds.add(nextHolding.id!);
      } else {
        // Sell Order
        const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
        const lotAllocations = order.lotAllocations || [];
        const costBasis =
          lotAllocations.length > 0
            ? getAllocationsCostBasis(lotAllocations)
            : order.amount * executionPrice;
        const realizedPnL = proceeds - costBasis;

        let newGrossProfit = nextPortfolio.grossProfit || 0;
        let newGrossLoss = nextPortfolio.grossLoss || 0;

        if (realizedPnL > 0) newGrossProfit += realizedPnL;
        if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

        let newValidCount = nextPortfolio.validTradesCount || 0;
        newValidCount +=
          lotAllocations.length > 0
            ? countValidTradesFromAllocations(
                lotAllocations,
                Date.now(),
                nextPortfolio.holdings,
                nextOrders
              )
            : 0;

        nextPortfolio.grossProfit = newGrossProfit;
        nextPortfolio.grossLoss = newGrossLoss;
        nextPortfolio.validTradesCount = newValidCount;

        nextPortfolio.balance = roundUSD(nextPortfolio.balance + proceeds);
      }
      return;
    }

    if (order.type !== 'SELL' || !order.lotAllocations?.length) return;

    const triggeredAllocations = order.lotAllocations.flatMap((allocation) => {
      if (isDust(allocation.amount)) return [];

      const trigger = resolveStrategyTriggerAtPrice(
        {
          amount: allocation.amount,
          takeProfitPrice: allocation.takeProfitPrice,
          stopLossPrice: allocation.stopLossPrice,
        },
        coin.price
      );

      return trigger
        ? [
            {
              allocation,
              executionPrice: trigger.executionPrice,
              triggerType: trigger.triggerType,
            },
          ]
        : [];
    });

    if (triggeredAllocations.length === 0) return;

    portfolioChanged = true;
    ordersChanged = true;

    for (const execution of triggeredAllocations) {
      const { allocation, executionPrice, triggerType } = execution;
      const totalValue = roundUSD(allocation.amount * executionPrice);
      const fee = roundUSD(totalValue * TRADING_FEE_RATE);
      const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
      const costBasis = roundUSD(allocation.amount * allocation.averageCost);
      const realizedPnL = proceeds - costBasis;

      newTransactions.push({
        id: generateUUID(),
        type: 'SELL',
        coinId: allocation.coinId,
        coinSymbol: order.coinSymbol,
        amount: allocation.amount,
        pricePerCoin: executionPrice,
        total: totalValue,
        fee,
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });

      let newGrossProfit = nextPortfolio.grossProfit || 0;
      let newGrossLoss = nextPortfolio.grossLoss || 0;
      if (realizedPnL > 0) newGrossProfit += realizedPnL;
      if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

      nextPortfolio.grossProfit = newGrossProfit;
      nextPortfolio.grossLoss = newGrossLoss;
      nextPortfolio.balance = roundUSD(nextPortfolio.balance + proceeds);
      notifications.push({
        type: triggerType,
        coinSymbol: order.coinSymbol,
        price: executionPrice,
      });
    }

    const triggeredLotIds = new Set(
      triggeredAllocations.map((execution) => execution.allocation.lotId)
    );
    const remainingAllocations = order.lotAllocations.filter(
      (allocation) => !triggeredLotIds.has(allocation.lotId)
    );

    if (remainingAllocations.length === 0) {
      nextOrders[orderIndex] = {
        ...order,
        status: 'CANCELLED',
        amount: 0,
        total: 0,
        lotAllocations: [],
        updatedAt: Date.now(),
      };
      nextPortfolio.validTradesCount =
        (nextPortfolio.validTradesCount || 0) +
        triggeredAllocations.reduce(
          (acc, execution) =>
            acc +
            countValidTradesFromAllocations(
              [execution.allocation],
              Date.now(),
              nextPortfolio.holdings,
              nextOrders
            ),
          0
        );
      return;
    }

    const remainingAmount = remainingAllocations.reduce(
      (acc, allocation) => acc + allocation.amount,
      0
    );
    nextOrders[orderIndex] = {
      ...order,
      amount: remainingAmount,
      total: roundUSD(remainingAmount * order.limitPrice),
      lotAllocations: remainingAllocations,
      updatedAt: Date.now(),
    };

    nextPortfolio.validTradesCount =
      (nextPortfolio.validTradesCount || 0) +
      triggeredAllocations.reduce(
        (acc, execution) =>
          acc +
          countValidTradesFromAllocations(
            [execution.allocation],
            Date.now(),
            nextPortfolio.holdings,
            nextOrders
          ),
        0
      );
  });

  // --- TP/SL ENGINE ---
  const currentHoldings = [...nextPortfolio.holdings]; // Copy array to avoid issues when splicing
  currentHoldings.forEach((h) => {
    // Ignore zero-amount (dust) holdings to avoid false reverse TP/SL triggers while collateral is locked
    if (isDust(h.amount)) return;
    if (h.id && newlyOpenedHoldingIds.has(h.id)) return;

    const coin = coins.find((c) => c.id === h.coinId);
    if (!coin || coin.price <= 0) return;

    const isLong = h.amount > 0;
    const trigger = resolveStrategyTriggerAtPrice(h, coin.price);

    if (trigger) {
      portfolioChanged = true;
      const executionPrice = trigger.executionPrice;
      const currentPositionValue = h.amount * executionPrice;
      const fee = roundUSD(currentPositionValue * TRADING_FEE_RATE);

      newTransactions.push({
        id: generateUUID(),
        type: isLong ? 'SELL' : 'BUY',
        coinId: h.coinId,
        coinSymbol: coin.symbol,
        amount: Math.abs(h.amount),
        pricePerCoin: executionPrice,
        total: currentPositionValue,
        fee: fee,
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });

      const hgIdx = nextPortfolio.holdings.findIndex((hld) => hld.id === h.id);
      if (hgIdx >= 0) {
        const hg = nextPortfolio.holdings[hgIdx];
        const closedValue = hg.amount * executionPrice;
        const proceeds = roundUSD(closedValue * (1 - TRADING_FEE_RATE));
        const costBasis = hg.amount * hg.averageCost;
        const realizedPnL = proceeds - costBasis;

        let newGrossProfit = nextPortfolio.grossProfit || 0;
        let newGrossLoss = nextPortfolio.grossLoss || 0;
        if (realizedPnL > 0) newGrossProfit += realizedPnL;
        if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

        nextPortfolio.grossProfit = newGrossProfit;
        nextPortfolio.grossLoss = newGrossLoss;
        nextPortfolio.balance = roundUSD(nextPortfolio.balance + proceeds);
        nextPortfolio.holdings.splice(hgIdx, 1);
        nextPortfolio.validTradesCount =
          (nextPortfolio.validTradesCount || 0) +
          (shouldCountValidTradeForClosedHolding(hg, Date.now(), nextPortfolio.holdings, nextOrders)
            ? 1
            : 0);

        notifications.push({
          type: trigger.triggerType,
          coinSymbol: coin.symbol,
          price: executionPrice,
        });
      }
    }
  });

  return {
    requestId: payload.requestId ?? 0,
    requestVersion: payload.requestVersion ?? 0,
    portfolioUpdates: portfolioChanged ? nextPortfolio : null,
    nextOrders: ordersChanged ? nextOrders : null,
    newTransactions,
    notifications,
  };
};

ctx.onmessage = (event: MessageEvent<EngineInput>) => {
  const { type, payload } = event.data;
  if (type !== 'TICK') return;

  const result = processTick(payload);
  ctx.postMessage({
    type: 'TICK_RESULT',
    payload: result,
  } as EngineOutput);
};
