import { describe, expect, it } from 'vitest';
import { INITIAL_COINS } from '../data';

const ALLOWED_CATEGORIES = new Set(['L1/L2', 'DeFi', 'AI/DePIN', 'MEME']);
const ALLOWED_SOURCES = new Set(['BINANCE', 'COINBASE']);

describe('INITIAL_COINS config', () => {
  it('should have unique ids and symbols', () => {
    const ids = INITIAL_COINS.map((coin) => coin.id);
    const symbols = INITIAL_COINS.map((coin) => coin.symbol);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('should only use allowed category and source values', () => {
    for (const coin of INITIAL_COINS) {
      expect(coin.id.length).toBeGreaterThan(0);
      expect(coin.symbol.length).toBeGreaterThan(0);
      expect(coin.name.length).toBeGreaterThan(0);

      if (coin.category !== undefined) {
        expect(ALLOWED_CATEGORIES.has(coin.category)).toBe(true);
      }

      if (coin.source !== undefined) {
        expect(ALLOWED_SOURCES.has(coin.source)).toBe(true);
      }
    }
  });
});
