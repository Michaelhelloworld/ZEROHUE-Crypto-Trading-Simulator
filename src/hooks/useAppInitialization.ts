import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useIDBSync } from './useIDBSync';
import { useMarketData } from './useMarketData';
import { useOfflineOrderExecution } from './useOfflineOrderExecution';
import { useMarketEngine } from './useMarketEngine';
import { safeStorage } from '../utils/safeStorage';
import { Order, Portfolio, Transaction } from '../types';
import { hydratePersistedAppState } from '../utils/appPersistence';
import {
  AppInitializationReplayError,
  isAppInitializationReady,
  resolveAppInitializationStage,
} from '../utils/appInitializationState';

/**
 * Custom hook to orchestrate the core logic of the application.
 * Handles single-time hydration, binds persistence layers, and spins up engines.
 */
export const useAppInitialization = () => {
  const setPortfolio = useStore((state) => state.setPortfolio);
  const setOrders = useStore((state) => state.setOrders);
  const setTransactions = useStore((state) => state.setTransactions);
  const portfolio = useStore((state) => state.portfolio);
  const orders = useStore((state) => state.orders);
  const transactions = useStore((state) => state.transactions);
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Initial Hydration Phase
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const applyPortfolio = (nextPortfolio: Portfolio) => {
          if (mounted) setPortfolio(nextPortfolio);
        };
        const applyOrders = (nextOrders: Order[]) => {
          if (mounted) setOrders(nextOrders);
        };
        const applyTransactions = (nextTransactions: Transaction[]) => {
          if (mounted) setTransactions(nextTransactions);
        };
        await hydratePersistedAppState({
          applyPortfolio,
          applyOrders,
          applyTransactions,
        });

        if (mounted) setIsHydrated(true);
      } catch (err) {
        console.error('Hydration failed', err);
        if (mounted) setIsHydrated(true);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [setOrders, setPortfolio, setTransactions]);

  // 2. Persist Portfolio to LocalStorage continually
  useEffect(() => {
    if (isHydrated) {
      safeStorage.setItem('zerohue_portfolio', JSON.stringify(portfolio));
    }
  }, [portfolio, isHydrated]);

  // 3. Persist Order and Transaction Arrays to IndexedDB
  useIDBSync('orders', orders, isHydrated);
  useIDBSync('transactions', transactions, isHydrated);

  // 4. Spin up background engines (Data fetching, Matching hooks)
  useMarketData();
  const offlineReplay = useOfflineOrderExecution(isHydrated);
  const isInitialReplaySettled = offlineReplay?.isInitialReplaySettled ?? false;
  const initialReplayError: AppInitializationReplayError | null =
    offlineReplay?.initialReplayError ?? null;
  const retryInitialReplay = offlineReplay?.retryInitialReplay ?? (() => {});
  const skipInitialReplay = offlineReplay?.skipInitialReplay ?? (() => {});
  const initializationStage = resolveAppInitializationStage({
    isHydrated,
    isInitialReplaySettled,
    initialReplayError,
  });
  useMarketEngine(isAppInitializationReady(initializationStage));

  return {
    initializationStage,
    isHydrated,
    isInitialReplaySettled,
    initialReplayError,
    retryInitialReplay,
    skipInitialReplay,
  };
};
