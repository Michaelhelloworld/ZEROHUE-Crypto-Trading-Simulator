/**
 * Trading Scoring System Engine (Lazy Evaluation v2.0)
 * Designed to calculate risk, profit, stability, and confidence metrics based on historical and floating numbers.
 */

import { Coin, Order, Portfolio } from '../types';
import { isDust } from './math';
import {
  calculateAccountEquitySnapshot as calculateValuationAccountEquitySnapshot,
  getMarkPrice,
} from './valuation';

export interface ScoringMetrics {
  riskScore: number;
  profitScore: number;
  stableScore: number;
  confidenceMultiplier: number;
  totalScore: number;
}

interface ScoreInputData {
  mdd: number; // Maximum Drawdown (e.g. 0.15 for 15%)
  accountRoi: number; // Account lifetime ROI in decimal form (e.g. 0.5 for 50%)
  grossProfit: number; // Total realized profits
  grossLoss: number; // Total realized losses (must be positive absolute value in formula)
  currentFloatingLoss: number; // Total floating losses (must be positive absolute value in formula)
  validTradesCount: number; // Number of qualifying fully closed FIFO lots
}

export const calculateScores = ({
  mdd,
  accountRoi,
  grossProfit,
  grossLoss,
  currentFloatingLoss,
  validTradesCount,
}: ScoreInputData): ScoringMetrics => {
  // 1. Risk Score (Weight: 40%)
  // S_risk = max(0, min(100, 100 * (0.50 - MDD) / (0.50 - 0.10)))
  const sRisk = Math.max(0, Math.min(100, 100 * ((0.5 - mdd) / (0.5 - 0.1))));

  // 2. Profit Score (Weight: 40%)
  // S_profit = max(0, min(100, 100 * log2(1 + accountRoi)))
  // Protection: Math.log2(1 + (-1)) is -Infinity. ROI <= -1 can happen in edge cases.
  const safeRoi = Math.max(-0.9999, accountRoi);
  const sProfit = Math.max(0, Math.min(100, 100 * Math.log2(1 + safeRoi)));

  // 3. Stable Score (Weight: 20%)
  const sumGrossLoss = Math.abs(grossLoss);
  const currentTotalFloatingLoss = Math.abs(currentFloatingLoss);
  const lossDenominator = sumGrossLoss + currentTotalFloatingLoss;

  let profitFactor = 0;
  if (lossDenominator > 0) {
    profitFactor = grossProfit / lossDenominator;
  } else if (lossDenominator === 0 && grossProfit > 0) {
    profitFactor = 2.5; // Perfect profit factor when no losses exist and profits > 0
  } else if (lossDenominator === 0 && grossProfit === 0) {
    profitFactor = 0; // Baseline when no actions taken
  }

  // S_stable = max(0, min(100, 100 * (PF - 1.0) / (2.5 - 1.0)))
  const sStable = Math.max(0, Math.min(100, 100 * ((profitFactor - 1.0) / (2.5 - 1.0))));

  // 4. Global Confidence Multiplier
  // M_confidence = min(1.0, N_valid / 20)
  const mConfidence = Math.min(1.0, validTradesCount / 20);

  // Final Total Score
  const totalScore = (sRisk * 0.4 + sProfit * 0.4 + sStable * 0.2) * mConfidence;

  // Returning rounded scores for front-end presentation
  return {
    riskScore: Math.round(sRisk * 10) / 10,
    profitScore: Math.round(sProfit * 10) / 10,
    stableScore: Math.round(sStable * 10) / 10,
    confidenceMultiplier: Math.round(mConfidence * 100) / 100,
    totalScore: Math.round(totalScore * 10) / 10,
  };
};

export interface ScoreMarkData {
  floatingLoss: number;
  isPriceDataComplete: boolean;
}

export const getScoreMarkPrice = getMarkPrice;

const getLongFloatingLoss = (amount: number, averageCost: number, markPrice: number) => {
  const positionSize = Math.abs(amount);
  const currentValue = positionSize * markPrice;
  const costBasis = positionSize * averageCost;
  return currentValue < costBasis ? costBasis - currentValue : 0;
};

export const calculateAccountEquitySnapshot = calculateValuationAccountEquitySnapshot;

export const calculateCurrentFloatingLoss = (
  portfolio: Pick<Portfolio, 'holdings'>,
  orders: Order[],
  coins: Coin[]
): ScoreMarkData => {
  const coinsById = new Map(coins.map((coin) => [coin.id, coin]));
  let floatingLoss = 0;
  let isPriceDataComplete = true;

  for (const holding of portfolio.holdings) {
    if (isDust(holding.amount)) continue;

    const markPrice = getScoreMarkPrice(coinsById.get(holding.coinId));
    if (markPrice === null) {
      isPriceDataComplete = false;
      continue;
    }

    floatingLoss += getLongFloatingLoss(holding.amount, holding.averageCost, markPrice);
  }

  for (const order of orders) {
    if (order.status !== 'OPEN' || order.type !== 'SELL') continue;

    const markPrice = getScoreMarkPrice(coinsById.get(order.coinId));
    if (markPrice === null) {
      isPriceDataComplete = false;
      continue;
    }

    if (order.lotAllocations?.length) {
      for (const allocation of order.lotAllocations) {
        floatingLoss += getLongFloatingLoss(allocation.amount, allocation.averageCost, markPrice);
      }
      continue;
    }

    isPriceDataComplete = false;
  }

  return {
    floatingLoss,
    isPriceDataComplete,
  };
};
