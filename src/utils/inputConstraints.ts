import { AMOUNT_DECIMALS, formatAmount, formatPriceInput, formatUsdWithSymbol } from './format';

// Keep raw token quantities within JS's exact integer range while removing
// the old 1e8 ceiling that blocked low-priced assets like SHIB too early.
const CRYPTO_AMOUNT_SAFE_MAX = Number.MAX_SAFE_INTEGER;

export const PRICE_INPUT_LIMITS = {
  min: 0.00000001,
  max: 100000000,
  minText: '0.00000001',
  maxText: '100000000',
  step: 'any',
} as const;

export const CRYPTO_AMOUNT_INPUT_LIMITS = {
  min: 10 ** -AMOUNT_DECIMALS,
  max: CRYPTO_AMOUNT_SAFE_MAX,
  minText: formatAmount(10 ** -AMOUNT_DECIMALS),
  maxText: CRYPTO_AMOUNT_SAFE_MAX.toString(),
  step: '0.000001',
} as const;

export const USD_VALUE_INPUT_LIMITS = {
  min: 0.01,
  max: 100000000,
  minText: '0.01',
  maxText: '100000000',
  step: '0.01',
} as const;

export const RESET_BALANCE_INPUT_LIMITS = {
  min: 100,
  max: 100000000,
  minText: '100',
  maxText: '100000000',
  step: '1',
} as const;

interface UnsignedDecimalKeyEvent {
  key: string;
  preventDefault: () => void;
}

export const preventSignedExponentInput = (event: UnsignedDecimalKeyEvent) => {
  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-') {
    event.preventDefault();
  }
};

export const preventNonIntegerInput = (event: UnsignedDecimalKeyEvent) => {
  if (
    event.key === 'e' ||
    event.key === 'E' ||
    event.key === '+' ||
    event.key === '-' ||
    event.key === '.' ||
    event.key === ','
  ) {
    event.preventDefault();
  }
};

export const isWithinInclusiveRange = (value: number, limits: { min: number; max: number }) =>
  Number.isFinite(value) && value >= limits.min && value <= limits.max;

export const isWholeNumberWithinInclusiveRange = (
  value: number,
  limits: { min: number; max: number }
) => Number.isInteger(value) && isWithinInclusiveRange(value, limits);

export const describePriceInputRange = () =>
  `${formatPriceInput(PRICE_INPUT_LIMITS.min)} - ${formatPriceInput(PRICE_INPUT_LIMITS.max)}`;

export const describeCryptoAmountRange = () =>
  `${CRYPTO_AMOUNT_INPUT_LIMITS.minText} - ${CRYPTO_AMOUNT_INPUT_LIMITS.max.toLocaleString(
    'en-US'
  )}`;

export const describeUsdInputRange = (
  limits: { min: number; max: number } = USD_VALUE_INPUT_LIMITS
) => `${formatUsdWithSymbol(limits.min)} - ${formatUsdWithSymbol(limits.max)}`;

export const describeWholeUsdInputRange = (
  limits: { min: number; max: number } = RESET_BALANCE_INPUT_LIMITS
) =>
  `${formatUsdWithSymbol(limits.min, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} - ${formatUsdWithSymbol(limits.max, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
