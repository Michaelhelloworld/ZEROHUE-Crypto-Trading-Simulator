import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { useMarketExecutionStore } from '../store/useMarketExecutionStore';
import { formatPrice } from '../utils/format';
import { TickResultPayload } from '../utils/engineProtocol';
import { useWorkerBridge } from './useWorkerBridge';
import { Coin, Order, Portfolio } from '../types';

/**
 * Market Matching Engine logic for Limit orders and TP/SL triggers.
 * Now offloaded to a dedicated WebWorker for extreme performance.
 */
export const useMarketEngine = (isEnabled = true) => {
  const orders = useStore((state) => state.orders);
  const setOrders = useStore((state) => state.setOrders);
  const portfolio = useStore((state) => state.portfolio);
  const setPortfolio = useStore((state) => state.setPortfolio);
  const setTransactions = useStore((state) => state.setTransactions);
  const coins = useStore((state) => state.coins);
  const engineStateVersion = useStore((state) => state.engineStateVersion);
  const executableSources = useMarketExecutionStore((state) => state.executableSources);

  const ordersRef = useRef(orders);
  const portfolioRef = useRef(portfolio);
  const isEnabledRef = useRef(isEnabled);
  const lastDispatchedSnapshotRef = useRef<{
    executionSignature: string | null;
    engineStateVersion: number | null;
  }>({
    executionSignature: null,
    engineStateVersion: null,
  });

  const getCoinExecutionSignature = (nextCoins: Coin[]) =>
    nextCoins
      .map((coin) => `${coin.id}:${Number.isFinite(coin.price) ? coin.price : 'NaN'}`)
      .join('|');

  const getExecutableCoins = useCallback(
    (nextCoins: Coin[]) =>
      nextCoins.map((coin) => {
        const source = coin.source === 'COINBASE' ? 'COINBASE' : 'BINANCE';
        if (executableSources[source]) {
          return coin;
        }

        return {
          ...coin,
          price: 0,
        };
      }),
    [executableSources]
  );

  useEffect(() => {
    ordersRef.current = orders;
    portfolioRef.current = portfolio;
  }, [orders, portfolio]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const handleTickResult = (payload: TickResultPayload) => {
    const { portfolioUpdates, nextOrders, newTransactions, notifications } = payload;

    if (nextOrders) {
      setOrders(nextOrders);
    }

    if (newTransactions.length > 0) {
      setTransactions((prev) => [...newTransactions, ...prev]);
    }

    if (portfolioUpdates) {
      setPortfolio(portfolioUpdates);
    }

    notifications.forEach((notif) => {
      const typeLabel = notif.type === 'TP' ? 'Take Profit' : 'Stop Loss';
      toast.success(
        `${typeLabel} Executed: ${notif.coinSymbol} closed @ $${formatPrice(notif.price)}`,
        {
          iconTheme: {
            primary: notif.type === 'TP' ? '#10b981' : '#ef4444',
            secondary: '#fff',
          },
        }
      );
    });
  };

  const { dispatchTickRef } = useWorkerBridge({
    onTickResult: handleTickResult,
  });

  const dispatchTickIfNeeded = useCallback(
    ({
      coins: nextCoins,
      orders: nextOrders,
      portfolio: nextPortfolio,
      engineStateVersion: nextEngineStateVersion,
    }: {
      coins: Coin[];
      orders: Order[];
      portfolio: Portfolio;
      engineStateVersion: number;
    }) => {
      if (!isEnabledRef.current || nextCoins.length === 0) return;

      const executableCoins = getExecutableCoins(nextCoins);
      const executionSignature = getCoinExecutionSignature(executableCoins);
      const lastSnapshot = lastDispatchedSnapshotRef.current;
      if (
        lastSnapshot.executionSignature === executionSignature &&
        lastSnapshot.engineStateVersion === nextEngineStateVersion
      ) {
        return;
      }

      dispatchTickRef.current({
        requestVersion: nextEngineStateVersion,
        coins: executableCoins,
        orders: nextOrders,
        portfolio: nextPortfolio,
      });
      lastDispatchedSnapshotRef.current = {
        executionSignature,
        engineStateVersion: nextEngineStateVersion,
      };
    },
    [dispatchTickRef, getExecutableCoins]
  );

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, previousState) => {
      if (state.coins === previousState.coins) return;

      dispatchTickIfNeeded({
        coins: state.coins,
        orders: state.orders,
        portfolio: state.portfolio,
        engineStateVersion: state.engineStateVersion,
      });
    });

    return unsubscribe;
  }, [dispatchTickIfNeeded]);

  useEffect(() => {
    dispatchTickIfNeeded({
      coins,
      orders: ordersRef.current,
      portfolio: portfolioRef.current,
      engineStateVersion,
    });
  }, [coins, dispatchTickIfNeeded, engineStateVersion, executableSources, isEnabled]);
};
