import { describe, expect, it } from 'vitest';
import { aggregateHoldingsByCoin } from '../lotAccounting';

describe('aggregateHoldingsByCoin', () => {
  it('preserves low-priced average cost instead of rounding it down to zero', () => {
    const [holding] = aggregateHoldingsByCoin([
      {
        id: 'lot-1',
        coinId: 'shiba-inu',
        amount: 1000000,
        averageCost: 0.00001235,
      },
    ]);

    expect(holding).toEqual(
      expect.objectContaining({
        coinId: 'shiba-inu',
        amount: 1000000,
      })
    );
    expect(holding.averageCost).toBeCloseTo(0.00001235, 8);
  });
});
