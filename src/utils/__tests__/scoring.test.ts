import {
  calculateAccountEquitySnapshot,
  calculateCurrentFloatingLoss,
  calculateScores,
  getScoreMarkPrice,
} from '../scoring';
import { describe, it, expect } from 'vitest';

describe('Scoring Engine', () => {
  it('should calculate perfect scores for ideal scenarios', () => {
    const data = {
      mdd: 0.05, // 5% mdd (perfect risk)
      accountRoi: 1.5, // 150% roi (high profit)
      grossProfit: 5000,
      grossLoss: 0,
      currentFloatingLoss: 0,
      validTradesCount: 20, // max confidence
    };

    const result = calculateScores(data);

    expect(result.riskScore).toBe(100);
    expect(result.profitScore).toBeGreaterThan(90); // log2(2.5) * 100 > 132 -> capped at 100
    expect(result.stableScore).toBe(100); // 2.5 PF simulated -> capped at 100
    expect(result.confidenceMultiplier).toBe(1);
    expect(result.totalScore).toBe(100);
  });

  it('should calculate 0 scores for terrible scenarios', () => {
    const data = {
      mdd: 0.6, // 60% mdd (>50% is 0)
      accountRoi: -0.5, // -50% roi (<= 0 is 0 log2)
      grossProfit: 100,
      grossLoss: 5000,
      currentFloatingLoss: 1000,
      validTradesCount: 0,
    };

    const result = calculateScores(data);

    expect(result.riskScore).toBe(0);
    expect(result.profitScore).toBe(0);
    expect(result.stableScore).toBe(0);
    expect(result.confidenceMultiplier).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it('should handle division by zero or exactly 0 actions', () => {
    const data = {
      mdd: 0,
      accountRoi: 0,
      grossProfit: 0,
      grossLoss: 0,
      currentFloatingLoss: 0,
      validTradesCount: 0,
    };

    // Total should be 0 since no trades were made (confidence 0)
    const result = calculateScores(data);

    expect(result.stableScore).toBe(0);
    expect(result.confidenceMultiplier).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it('should calculate proportional risk scores correctly', () => {
    const data = {
      mdd: 0.3, // exactly middle of 0.1 and 0.5
      accountRoi: 0,
      grossProfit: 0,
      grossLoss: 0,
      currentFloatingLoss: 0,
      validTradesCount: 20, // to expose the sub-score
    };

    // (0.50 - 0.30) / (0.50 - 0.10) => 0.2 / 0.4 => 0.5 => 50
    const result = calculateScores(data);
    expect(result.riskScore).toBe(50);
  });

  it('should scale confidence linearly with validTradesCount', () => {
    const base = {
      mdd: 0.1,
      accountRoi: 0.5,
      grossProfit: 5000,
      grossLoss: 2000,
      currentFloatingLoss: 0,
    };

    const s5 = calculateScores({ ...base, validTradesCount: 5 });
    const s10 = calculateScores({ ...base, validTradesCount: 10 });

    expect(s5.confidenceMultiplier).toBe(0.25);
    expect(s10.confidenceMultiplier).toBe(0.5);
    // Total score should double from 5 to 10 trades since it is multiplied by confidence
    expect(s10.totalScore).toBeCloseTo(s5.totalScore * 2, 0);
  });

  it('should cap confidence at 1.0 for trades > 20', () => {
    const scores = calculateScores({
      mdd: 0.1,
      accountRoi: 0.5,
      grossProfit: 5000,
      grossLoss: 2000,
      currentFloatingLoss: 0,
      validTradesCount: 50,
    });

    expect(scores.confidenceMultiplier).toBe(1.0);
  });

  it('should include floating losses in stability calculation', () => {
    const base = {
      mdd: 0.1,
      accountRoi: 0.3,
      grossProfit: 5000,
      grossLoss: 2000,
      validTradesCount: 20,
    };

    const withoutFloat = calculateScores({ ...base, currentFloatingLoss: 0 });
    const withFloat = calculateScores({ ...base, currentFloatingLoss: 3000 });

    expect(withFloat.stableScore).toBeLessThan(withoutFloat.stableScore);
  });

  it('should produce finite scores for extreme negative ROI (near -100%)', () => {
    const scores = calculateScores({
      mdd: 0.95,
      accountRoi: -0.99,
      grossProfit: 0,
      grossLoss: 49500,
      currentFloatingLoss: 0,
      validTradesCount: 20,
    });

    expect(scores.profitScore).toBe(0);
    expect(scores.riskScore).toBe(0);
    expect(scores.totalScore).toBe(0);
    expect(Number.isFinite(scores.totalScore)).toBe(true);
  });

  it('should clamp ROI below -100% and still return finite, bounded scores', () => {
    const scores = calculateScores({
      mdd: 0.2,
      accountRoi: -2, // invalid in theory, must be clamped internally
      grossProfit: 0,
      grossLoss: 1000,
      currentFloatingLoss: 0,
      validTradesCount: 20,
    });

    expect(scores.profitScore).toBe(0);
    expect(scores.totalScore).toBeGreaterThanOrEqual(0);
    expect(scores.totalScore).toBeLessThanOrEqual(100);
    expect(Number.isFinite(scores.totalScore)).toBe(true);
  });

  it('should respect exact risk thresholds at mdd=10% and mdd=50%', () => {
    const base = {
      accountRoi: 0,
      grossProfit: 0,
      grossLoss: 0,
      currentFloatingLoss: 0,
      validTradesCount: 20,
    };

    const bestEdge = calculateScores({ ...base, mdd: 0.1 });
    const worstEdge = calculateScores({ ...base, mdd: 0.5 });

    expect(bestEdge.riskScore).toBe(100);
    expect(worstEdge.riskScore).toBe(0);
  });

  it('should map stability score correctly at PF boundaries', () => {
    const base = {
      mdd: 0.1,
      accountRoi: 0,
      validTradesCount: 20,
      currentFloatingLoss: 0,
    };

    const pfOne = calculateScores({
      ...base,
      grossProfit: 1000,
      grossLoss: 1000, // PF = 1.0
    });
    const pfCap = calculateScores({
      ...base,
      grossProfit: 2500,
      grossLoss: 1000, // PF = 2.5
    });

    expect(pfOne.stableScore).toBe(0);
    expect(pfCap.stableScore).toBe(100);
  });

  it('should treat grossLoss/currentFloatingLoss as absolute values', () => {
    const positiveLoss = calculateScores({
      mdd: 0.2,
      accountRoi: 0.2,
      grossProfit: 5000,
      grossLoss: 2000,
      currentFloatingLoss: 300,
      validTradesCount: 20,
    });

    const negativeLoss = calculateScores({
      mdd: 0.2,
      accountRoi: 0.2,
      grossProfit: 5000,
      grossLoss: -2000,
      currentFloatingLoss: -300,
      validTradesCount: 20,
    });

    expect(negativeLoss.stableScore).toBe(positiveLoss.stableScore);
    expect(negativeLoss.totalScore).toBe(positiveLoss.totalScore);
  });

  it('should keep documented rounding precision for returned metrics', () => {
    const scores = calculateScores({
      mdd: 0.3333,
      accountRoi: 0.321,
      grossProfit: 4321,
      grossLoss: 2100,
      currentFloatingLoss: 345,
      validTradesCount: 7,
    });

    expect(scores.riskScore).toBe(Math.round(scores.riskScore * 10) / 10);
    expect(scores.profitScore).toBe(Math.round(scores.profitScore * 10) / 10);
    expect(scores.stableScore).toBe(Math.round(scores.stableScore * 10) / 10);
    expect(scores.totalScore).toBe(Math.round(scores.totalScore * 10) / 10);
    expect(scores.confidenceMultiplier).toBe(Math.round(scores.confidenceMultiplier * 100) / 100);
  });

  it('uses the latest valid history price when live mark price is missing', () => {
    expect(
      getScoreMarkPrice({
        price: 0,
        history: [0, 51000, 0, 52000],
      })
    ).toBe(52000);
  });

  it('includes reserved SELL lots in floating loss', () => {
    const snapshot = calculateCurrentFloatingLoss(
      {
        holdings: [],
      },
      [
        {
          id: 'sell-1',
          type: 'SELL',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount: 1,
          limitPrice: 120,
          total: 120,
          lotAllocations: [
            {
              lotId: 'lot-1',
              coinId: 'bitcoin',
              amount: 1,
              averageCost: 100,
              wasFullLotClose: true,
            },
          ],
          timestamp: 1,
          status: 'OPEN',
        },
      ],
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 80,
          change24h: 0,
          history: [80],
        },
      ]
    );

    expect(snapshot.floatingLoss).toBe(20);
    expect(snapshot.isPriceDataComplete).toBe(true);
  });

  it('marks score data incomplete when an open SELL order has no lot allocations', () => {
    const snapshot = calculateCurrentFloatingLoss(
      {
        holdings: [],
      },
      [
        {
          id: 'sell-1',
          type: 'SELL',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount: 1,
          limitPrice: 120,
          total: 120,
          timestamp: 1,
          status: 'OPEN',
        },
      ],
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 80,
          change24h: 0,
          history: [80],
        },
      ]
    );

    expect(snapshot.floatingLoss).toBe(0);
    expect(snapshot.isPriceDataComplete).toBe(false);
  });

  it('marks score data incomplete when an active exposure has no usable price', () => {
    const snapshot = calculateCurrentFloatingLoss(
      {
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 100 }],
      },
      [],
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 0,
          change24h: 0,
          history: [0, 0],
        },
      ]
    );

    expect(snapshot.isPriceDataComplete).toBe(false);
  });

  it('uses historical prices in account equity snapshots before declaring score data stale', () => {
    const snapshot = calculateAccountEquitySnapshot(
      {
        balance: 1000,
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 100 }],
      },
      [],
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 0,
          change24h: 0,
          history: [90],
        },
      ]
    );

    expect(snapshot.portfolioValue).toBe(1090);
    expect(snapshot.totalEquity).toBe(1090);
    expect(snapshot.isPriceDataComplete).toBe(true);
  });

  it('does not value open SELL exposure at the limit price when no usable mark price exists', () => {
    const snapshot = calculateAccountEquitySnapshot(
      {
        balance: 1000,
        holdings: [],
      },
      [
        {
          id: 'sell-unpriced',
          type: 'SELL',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount: 1,
          limitPrice: 120,
          total: 120,
          timestamp: 1,
          status: 'OPEN',
        },
      ],
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 0,
          change24h: 0,
          history: [0, 0],
        },
      ]
    );

    expect(snapshot.lockedInOrders).toBe(0);
    expect(snapshot.totalEquity).toBe(1000);
    expect(snapshot.isPriceDataComplete).toBe(false);
  });
});
