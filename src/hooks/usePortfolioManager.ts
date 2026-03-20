import { useMemo, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Coin } from '../types';
import { useStore } from '../store/useStore';
import { formatUsdWithSymbol } from '../utils/format';
import { applyStrategyToCoinLots, getAggregateHoldingForCoin } from '../utils/lotAccounting';
import { calculateAccountEquitySnapshot } from '../utils/valuation';
import {
  executeLocalPersistenceTransition,
  stageLocalPersistenceTransition,
} from '../utils/localSimulatorState';

interface UsePortfolioManagerOptions {
  autoCaptureScoreSnapshots?: boolean;
}

export const usePortfolioManager = ({
  autoCaptureScoreSnapshots = false,
}: UsePortfolioManagerOptions = {}) => {
  const coins = useStore((state) => state.coins);
  const portfolio = useStore((state) => state.portfolio);
  const orders = useStore((state) => state.orders);
  const setPortfolio = useStore((state) => state.setPortfolio);
  const setOrders = useStore((state) => state.setOrders);
  const setTransactions = useStore((state) => state.setTransactions);
  // UI modal state is consumed directly from useStore by consumers (e.g. App.tsx).
  // This hook only reads what it needs to trigger those modals.
  const setIsResetModalOpen = useStore((state) => state.setIsResetModalOpen);
  const setSelectedHoldingForEdit = useStore((state) => state.setSelectedHoldingForEdit);

  const handleResetAccount = useCallback(() => {
    setIsResetModalOpen(true);
  }, [setIsResetModalOpen]);

  const handleConfirmReset = useCallback(
    async (amount: number) => {
      const resetPortfolio = {
        balance: amount,
        initialBalance: amount,
        holdings: [],
        peakBalance: amount,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      };
      const transition = {
        version: 1 as const,
        action: 'account_reset' as const,
        nextPortfolio: resetPortfolio,
      };

      try {
        const didStageResetTransition = stageLocalPersistenceTransition(transition);
        if (!didStageResetTransition) {
          throw new Error('local simulator reset transition could not be staged');
        }

        const didExecuteResetTransition = await executeLocalPersistenceTransition(transition);
        if (!didExecuteResetTransition) {
          throw new Error('local simulator reset persistence failed');
        }

        setPortfolio(resetPortfolio);
        setTransactions([]);
        setOrders([]);
        setIsResetModalOpen(false);

        toast.success(
          `Account reset with ${formatUsdWithSymbol(amount, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })} balance`
        );
      } catch (e) {
        console.error('Failed to clear IndexedDB on reset', e);
        toast.error('Account reset failed because device storage could not be cleared.');
      }
    },
    [setPortfolio, setTransactions, setOrders, setIsResetModalOpen]
  );

  const handleEditPosition = useCallback(
    (coin: Coin) => {
      const holding = getAggregateHoldingForCoin(portfolio.holdings, coin.id);
      if (holding) {
        setSelectedHoldingForEdit({ holding, coin });
      }
    },
    [portfolio.holdings, setSelectedHoldingForEdit]
  );

  const handleUpdateStrategy = useCallback(
    (coinId: string, tp: number | undefined, sl: number | undefined) => {
      setPortfolio((prev) => ({
        ...prev,
        holdings: applyStrategyToCoinLots(prev.holdings, coinId, tp, sl),
      }));
      toast.success('Strategy updated successfully');
      setSelectedHoldingForEdit(null);
    },
    [setPortfolio, setSelectedHoldingForEdit]
  );

  // --- Computed Values ---
  const equitySnapshot = useMemo(
    () => calculateAccountEquitySnapshot(portfolio, orders, coins),
    [portfolio, orders, coins]
  );

  const { portfolioValue, lockedInOrders, totalEquity, isPriceDataComplete } = equitySnapshot;
  const initialBalance = portfolio.initialBalance || 50000;
  const totalPnL = totalEquity - initialBalance;
  const pnlPercentage = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;

  // --- Score Snapshot Mechanism ---
  const totalEquityRef = useRef(totalEquity);
  useEffect(() => {
    totalEquityRef.current = totalEquity;
  }, [totalEquity]);

  const captureScoreSnapshot = useCallback(() => {
    setPortfolio((prev) => {
      // Freeze score snapshots until every active exposure has a usable mark price.
      if (!isPriceDataComplete) return prev;

      const peak = Math.max(
        prev.peakBalance ?? prev.initialBalance ?? 50000,
        totalEquityRef.current
      );
      const drawdown = peak > 0 ? (peak - totalEquityRef.current) / peak : 0;
      const mdd = Math.max(prev.historicalMDD ?? 0, drawdown);

      if (peak === prev.peakBalance && mdd === prev.historicalMDD) return prev;

      return {
        ...prev,
        peakBalance: peak,
        historicalMDD: mdd,
      };
    });
  }, [isPriceDataComplete, setPortfolio]);

  useEffect(() => {
    if (!autoCaptureScoreSnapshots) return;
    captureScoreSnapshot();
  }, [autoCaptureScoreSnapshots, captureScoreSnapshot, totalEquity]);

  return {
    handleResetAccount,
    handleConfirmReset,
    handleEditPosition,
    handleUpdateStrategy,
    portfolioValue,
    lockedInOrders,
    totalEquity,
    totalPnL,
    pnlPercentage,
    accountRoiPercentage: pnlPercentage,
    isScoreDataComplete: isPriceDataComplete,
    captureScoreSnapshot,
  };
};
