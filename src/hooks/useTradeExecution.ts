import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { Coin, Portfolio, Transaction, Order } from '../types';
import { TRADING_FEE_RATE } from '../constants/data';
import { roundUSD, roundCrypto, roundPrice } from '../utils/math';
import { calculateLiveTotalEquity } from '../utils/tradeAccounting';
import {
  allocateLotsForSell,
  countValidTradesFromAllocations,
  createHoldingLot,
  getAllocationsCostBasis,
  getInheritedStrategyForCoin,
  getTotalHoldingAmountForCoin,
  restoreLotsFromAllocations,
} from '../utils/lotAccounting';
import { generateUUID } from '../utils/uuid';
import { useStore } from '../store/useStore';

const processingOrders = new Set<string>();

const handleLimitOrder = (
  coin: Coin,
  coinId: string,
  type: 'BUY' | 'SELL',
  amount: number,
  limitPrice: number,
  takeProfitPrice?: number,
  stopLossPrice?: number
): boolean => {
  const { portfolio, setOrders, setPortfolio } = useStore.getState();
  const totalValue = roundUSD(amount * limitPrice);
  const inheritedStrategy =
    type === 'BUY' ? getInheritedStrategyForCoin(portfolio.holdings, coinId) : undefined;

  if (type === 'BUY') {
    if (portfolio.balance < totalValue) {
      toast.error('Insufficient balance for limit order');
      return false;
    }
  } else {
    const availableAmount = getTotalHoldingAmountForCoin(portfolio.holdings, coinId);
    if (availableAmount < amount) {
      toast.error('Insufficient holdings for limit order');
      return false;
    }
  }

  const lotReservation =
    type === 'SELL' ? allocateLotsForSell(portfolio.holdings, coinId, amount) : null;

  const newOrder: Order = {
    id: generateUUID(),
    type,
    coinId,
    coinSymbol: coin.symbol,
    amount,
    limitPrice,
    total: totalValue,
    takeProfitPrice: takeProfitPrice ?? inheritedStrategy?.takeProfitPrice,
    stopLossPrice: stopLossPrice ?? inheritedStrategy?.stopLossPrice,
    lotAllocations: lotReservation?.lotAllocations,
    timestamp: Date.now(),
    status: 'OPEN',
    updatedAt: Date.now(),
  };
  setOrders((prev) => [newOrder, ...prev]);

  if (type === 'BUY') {
    setPortfolio((prev: Portfolio) => {
      return { ...prev, balance: roundUSD(prev.balance - totalValue) };
    });
  } else {
    // Sell Limit: lock tokens
    setPortfolio((prev: Portfolio) => {
      return lotReservation ? { ...prev, holdings: lotReservation.nextHoldings } : prev;
    });
  }
  return true;
};

const handleMarketOrder = (
  coin: Coin,
  coinId: string,
  type: 'BUY' | 'SELL',
  amount: number,
  takeProfitPrice?: number,
  stopLossPrice?: number
): boolean => {
  const { portfolio, coins, orders, setTransactions, setPortfolio } = useStore.getState();
  const totalValue = roundUSD(amount * coin.price);
  const fee = roundUSD(totalValue * TRADING_FEE_RATE);

  if (type === 'BUY') {
    if (portfolio.balance < totalValue) {
      toast.error('Insufficient balance');
      return false;
    }
  } else {
    const availableAmount = getTotalHoldingAmountForCoin(portfolio.holdings, coinId);
    if (availableAmount < amount) {
      toast.error('Insufficient holdings');
      return false;
    }
  }

  const newTransaction: Transaction = {
    id: generateUUID(),
    type,
    coinId,
    coinSymbol: coin.symbol,
    amount,
    pricePerCoin: coin.price,
    total: totalValue,
    fee: fee,
    timestamp: Date.now(),
    updatedAt: Date.now(),
  };

  setTransactions((prev) => [newTransaction, ...prev]);

  if (type === 'BUY') {
    setPortfolio((prev: Portfolio) => {
      const effectiveAmount = amount * (1 - TRADING_FEE_RATE);
      const newHoldings = [...prev.holdings];
      const currentTotalEquity = calculateLiveTotalEquity(prev, coins, orders);
      const isBigEnough = totalValue >= currentTotalEquity * 0.05;
      const inheritedStrategy = getInheritedStrategyForCoin(prev.holdings, coinId);

      newHoldings.push(
        createHoldingLot({
          coinId,
          amount: roundCrypto(effectiveAmount),
          averageCost: roundPrice(coin.price / (1 - TRADING_FEE_RATE)),
          takeProfitPrice: takeProfitPrice ?? inheritedStrategy.takeProfitPrice,
          stopLossPrice: stopLossPrice ?? inheritedStrategy.stopLossPrice,
          openedAt: Date.now(),
          meetsVolumeCondition: isBigEnough,
        })
      );
      return { ...prev, balance: roundUSD(prev.balance - totalValue), holdings: newHoldings };
    });
  } else {
    // Sell Logic
    setPortfolio((prev: Portfolio) => {
      const { nextHoldings, lotAllocations } = allocateLotsForSell(prev.holdings, coinId, amount);
      const proceeds = roundUSD(totalValue * (1 - TRADING_FEE_RATE));
      const costBasis = getAllocationsCostBasis(lotAllocations);
      const realizedPnL = proceeds - costBasis;

      let newGrossProfit = prev.grossProfit || 0;
      let newGrossLoss = prev.grossLoss || 0;
      if (realizedPnL > 0) newGrossProfit += realizedPnL;
      if (realizedPnL < 0) newGrossLoss += Math.abs(realizedPnL);

      let newValidCount = prev.validTradesCount || 0;
      newValidCount += countValidTradesFromAllocations(
        lotAllocations,
        Date.now(),
        nextHoldings,
        orders
      );

      return {
        ...prev,
        balance: roundUSD(prev.balance + proceeds),
        holdings: nextHoldings,
        grossProfit: newGrossProfit,
        grossLoss: newGrossLoss,
        validTradesCount: newValidCount,
      };
    });
  }
  return true;
};

export const useTradeExecution = () => {
  const handleExecuteTrade = useCallback(
    (
      coinId: string,
      type: 'BUY' | 'SELL',
      amount: number,
      orderType: 'MARKET' | 'LIMIT',
      limitPrice?: number,
      takeProfitPrice?: number,
      stopLossPrice?: number
    ): boolean => {
      try {
        const { coins } = useStore.getState();
        const coin = coins.find((c) => c.id === coinId);
        if (!coin) return false;

        if (orderType === 'LIMIT' && limitPrice) {
          return handleLimitOrder(
            coin,
            coinId,
            type,
            amount,
            limitPrice,
            takeProfitPrice,
            stopLossPrice
          );
        } else {
          return handleMarketOrder(coin, coinId, type, amount, takeProfitPrice, stopLossPrice);
        }
      } catch (e) {
        console.error('[TradeExecution] Unexpected error during trade execution', e);
        return false;
      }
    },
    []
  );

  const handleCancelOrder = useCallback((orderId: string) => {
    if (processingOrders.has(orderId)) return;

    const { orders, setOrders, setPortfolio } = useStore.getState();
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'OPEN') return;

    processingOrders.add(orderId);

    setPortfolio((prev) => {
      const nextPortfolio = { ...prev, holdings: [...prev.holdings] };
      if (order.type === 'BUY') {
        nextPortfolio.balance = roundUSD(nextPortfolio.balance + order.total);
      } else {
        if (order.lotAllocations && order.lotAllocations.length > 0) {
          nextPortfolio.holdings = restoreLotsFromAllocations(
            nextPortfolio.holdings,
            order.lotAllocations
          );
        } else {
          const existingHoldingIndex = nextPortfolio.holdings.findIndex(
            (h) => h.coinId === order.coinId
          );
          if (existingHoldingIndex >= 0) {
            const h = nextPortfolio.holdings[existingHoldingIndex];
            nextPortfolio.holdings[existingHoldingIndex] = {
              ...h,
              amount: roundCrypto(h.amount + order.amount),
            };
          }
        }
      }
      return nextPortfolio;
    });

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED', updatedAt: Date.now() } : o))
    );
    toast.success('Order cancelled');

    setTimeout(() => {
      processingOrders.delete(orderId);
    }, 1000);
  }, []);

  return { handleExecuteTrade, handleCancelOrder };
};
