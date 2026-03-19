import { formatPrice, formatPriceInput } from './format';
import { PRICE_INPUT_LIMITS } from './inputConstraints';
import { roundPrice } from './math';

type LimitTradeType = 'BUY' | 'SELL';

export const getLimitPriceTickSize = (marketPrice: number) => {
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    return PRICE_INPUT_LIMITS.min;
  }

  if (marketPrice < 0.0001) {
    return 0.00000001;
  }

  if (marketPrice < 1) {
    return 0.0001;
  }

  return 0.01;
};

const clampLimitPrice = (price: number) =>
  Math.min(PRICE_INPUT_LIMITS.max, Math.max(PRICE_INPUT_LIMITS.min, roundPrice(price)));

export const getDirectionalLimitPriceBounds = (tradeType: LimitTradeType, marketPrice: number) => {
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
    return {
      min: PRICE_INPUT_LIMITS.min,
      max: PRICE_INPUT_LIMITS.max,
    };
  }

  const tickSize = getLimitPriceTickSize(marketPrice);

  if (tradeType === 'BUY') {
    return {
      min: PRICE_INPUT_LIMITS.min,
      max: clampLimitPrice(marketPrice - tickSize),
    };
  }

  return {
    min: clampLimitPrice(marketPrice + tickSize),
    max: PRICE_INPUT_LIMITS.max,
  };
};

export const getDefaultLimitPriceInput = (tradeType: LimitTradeType, marketPrice: number) => {
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return '';

  const bounds = getDirectionalLimitPriceBounds(tradeType, marketPrice);
  const defaultPrice = tradeType === 'BUY' ? bounds.max : bounds.min;
  return formatPriceInput(defaultPrice);
};

export const isDirectionalLimitPriceValid = (
  tradeType: LimitTradeType,
  limitPrice: number,
  marketPrice: number
) => {
  if (
    !Number.isFinite(limitPrice) ||
    limitPrice <= 0 ||
    !Number.isFinite(marketPrice) ||
    marketPrice <= 0
  ) {
    return false;
  }

  return tradeType === 'BUY' ? limitPrice < marketPrice : limitPrice > marketPrice;
};

export const getDirectionalLimitPriceError = (tradeType: LimitTradeType, marketPrice: number) => {
  const relation = tradeType === 'BUY' ? 'below' : 'above';
  return `Limit price must stay ${relation} the current market price (${formatPrice(marketPrice)} USDT).`;
};
