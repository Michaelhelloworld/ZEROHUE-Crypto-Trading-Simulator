/**
 * Utility for handling financial precision and preventing floating point errors.
 */

/**
 * Rounds a number to a specific number of decimal places.
 */
const roundTo = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Rounds a USD value to 2 decimal places.
 * Used for balances, fees, and total values.
 */
export const roundUSD = (value: number): number => {
  return roundTo(value, 2);
};

/**
 * Rounds a per-coin price to 8 decimal places so low-priced assets
 * like SHIB and PEPE keep a usable cost basis.
 */
export const roundPrice = (value: number): number => {
  return roundTo(value, 8);
};

/**
 * Rounds a Crypto amount to 8 decimal places.
 * Used for token holdings and transaction amounts.
 */
export const roundCrypto = (value: number): number => {
  return roundTo(value, 8);
};

/**
 * Checks if an amount is effectively zero (dust).
 */
export const isDust = (amount: number): boolean => {
  return Math.abs(amount) < 0.00000001;
};
