export const AMOUNT_DECIMALS = 6;
export const USD_DECIMALS = 2;
export const USD_INPUT_PLACEHOLDER = '0.00';

const truncateToDecimals = (value: number, decimals: number): number => {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** decimals;
  return Math.floor(Math.max(0, value) * factor) / factor;
};

/**
 * Formats a cryptocurrency price with specialized precision for small caps.
 */
export const formatPrice = (price: number): string => {
  if (price === 0) return '0.00';

  // Very small numbers (PEPE, SHIB)
  if (price < 0.0001) {
    return price.toFixed(8);
  }

  // Small numbers
  if (price < 1) {
    return price.toFixed(4);
  }

  // Standard prices
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatAmount = (amount: number, decimals = AMOUNT_DECIMALS): string => {
  if (!Number.isFinite(amount)) {
    return (0).toFixed(decimals);
  }

  return amount.toFixed(decimals);
};

export const formatAmountInput = (amount: number, decimals = AMOUNT_DECIMALS): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return truncateToDecimals(amount, decimals).toFixed(decimals);
};

export const formatUsd = (amount: number, options: Intl.NumberFormatOptions = {}): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const minimumFractionDigits = options.minimumFractionDigits ?? USD_DECIMALS;
  const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;

  return safeAmount.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

export const formatUsdWithSymbol = (
  amount: number,
  options: Intl.NumberFormatOptions = {}
): string => `$${formatUsd(amount, options)}`;

export const formatUsdInput = (amount: number, decimals = USD_DECIMALS): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return truncateToDecimals(amount, decimals).toFixed(decimals);
};

export const formatPriceInput = (price: number): string => {
  if (!Number.isFinite(price) || price <= 0) return '';

  if (price < 0.0001) {
    return price.toFixed(8);
  }

  if (price < 1) {
    return price.toFixed(4);
  }

  return price.toFixed(2);
};

// EOF
