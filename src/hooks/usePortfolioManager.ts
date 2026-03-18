import { useMemo, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { dbService } from '../services/db';
import {
  LAST_ONLINE_AT_KEY,
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
} from '../constants/storage';
import { Coin } from '../types';
import { useStore } from '../store/useStore';
import { safeStorage } from '../utils/safeStorage';
import { formatUsdWithSymbol } from '../utils/format';
import { applyStrategyToCoinLots, getAggregateHoldingForCoin } from '../utils/lotAccounting';
import { calculateAccountEquitySnapshot } from '../utils/valuation';

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
      setPortfolio({
        balance: amount,
        initialBalance: amount,
        holdings: [],
        peakBalance: amount,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      setTransactions([]);
      setOrders([]);
      setIsResetModalOpen(false);

      safeStorage.removeItem('zerohue_transactions');
      safeStorage.removeItem('zerohue_orders');
      safeStorage.removeItem(LAST_ONLINE_AT_KEY);
      safeStorage.removeItem(LAST_ONLINE_AT_BINANCE_KEY);
      safeStorage.removeItem(LAST_ONLINE_AT_COINBASE_KEY);

      try {
        await dbService.clear('transactions');
        await dbService.clear('orders');
        toast.success(
          `Account reset with ${formatUsdWithSymbol(amount, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })} balance`
        );
      } catch (e) {
        console.error('Failed to clear IndexedDB on reset', e);
        toast.success(`Account state reset, but device storage clear failed.`);
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
