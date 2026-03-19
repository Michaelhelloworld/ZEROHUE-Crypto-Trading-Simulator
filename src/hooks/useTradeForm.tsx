import React, { useEffect, useMemo, useState } from 'react';
import { Coin, Portfolio } from '../types';
import toast from 'react-hot-toast';

import TransactionToast from '../components/common/TransactionToast';
import { roundUSD, roundCrypto } from '../utils/math';
import { getTotalHoldingAmountForCoin } from '../utils/lotAccounting';
import {
  AMOUNT_DECIMALS,
  USD_DECIMALS,
  formatAmountInput,
  formatUsdInput,
  formatUsdWithSymbol,
} from '../utils/format';
import {
  CRYPTO_AMOUNT_INPUT_LIMITS,
  PRICE_INPUT_LIMITS,
  USD_VALUE_INPUT_LIMITS,
  describeCryptoAmountRange,
  describePriceInputRange,
  describeUsdInputRange,
  isWithinInclusiveRange,
} from '../utils/inputConstraints';
import {
  getDefaultLimitPriceInput,
  getDirectionalLimitPriceError,
  isDirectionalLimitPriceValid,
} from '../utils/limitOrderPrice';

interface UseTradeFormProps {
  coin: Coin | null;
  portfolio: Portfolio;
  onExecuteTrade: (
    coinId: string,
    type: 'BUY' | 'SELL',
    amount: number,
    orderType: 'MARKET' | 'LIMIT',
    limitPrice?: number,
    takeProfitPrice?: number,
    stopLossPrice?: number
  ) => boolean;
  onClose: () => void;
}

export interface TradeFormState {
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  tradeType: 'BUY' | 'SELL';
  setTradeType: React.Dispatch<React.SetStateAction<'BUY' | 'SELL'>>;
  orderType: 'MARKET' | 'LIMIT';
  setOrderType: React.Dispatch<React.SetStateAction<'MARKET' | 'LIMIT'>>;
  limitPrice: string;
  setLimitPrice: React.Dispatch<React.SetStateAction<string>>;
  inputMode: 'AMOUNT' | 'TOTAL';
  setInputMode: React.Dispatch<React.SetStateAction<'AMOUNT' | 'TOTAL'>>;
  takeProfit: string;
  setTakeProfit: React.Dispatch<React.SetStateAction<string>>;
  stopLoss: string;
  setStopLoss: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isLoading: boolean;
}

export interface TradeCalculations {
  userHolding: number;
  executionPrice: number;
  numAmount: number;
  totalCost: number;
  marginRequired: number;
  buyingPower: number;
}

export const useTradeForm = ({ coin, portfolio, onExecuteTrade, onClose }: UseTradeFormProps) => {
  const [amount, setAmount] = useState<string>('');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>(
    getDefaultLimitPriceInput('BUY', coin?.price || 0)
  );
  const [inputMode, setInputMode] = useState<'AMOUNT' | 'TOTAL'>('AMOUNT');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const userHolding = useMemo(
    () => (coin ? getTotalHoldingAmountForCoin(portfolio.holdings, coin.id) : 0),
    [coin, portfolio.holdings]
  );

  const executionPrice = useMemo(
    () => (orderType === 'LIMIT' ? parseFloat(limitPrice) : coin?.price || 0),
    [orderType, limitPrice, coin?.price]
  );

  const shouldSnapSellToFullHolding = React.useCallback(
    (rawInputValue: number) => {
      if (tradeType !== 'SELL' || !Number.isFinite(rawInputValue) || rawInputValue <= 0)
        return false;

      if (inputMode === 'AMOUNT') {
        const displayedMax = Number(formatAmountInput(userHolding, AMOUNT_DECIMALS) || 0);
        const fullHoldingAmount = roundCrypto(userHolding);
        return (
          displayedMax > 0 && rawInputValue >= displayedMax && rawInputValue <= fullHoldingAmount
        );
      }

      const displayedMax = Number(formatUsdInput(userHolding * executionPrice, USD_DECIMALS) || 0);
      const fullHoldingValue = roundUSD(roundCrypto(userHolding) * executionPrice);
      return displayedMax > 0 && rawInputValue >= displayedMax && rawInputValue <= fullHoldingValue;
    },
    [executionPrice, inputMode, tradeType, userHolding]
  );

  // Calculate Derived Values with useMemo
  const calculations = useMemo(() => {
    let numAmount = 0;
    let totalCost = 0;
    const snapToFullHolding = shouldSnapSellToFullHolding(parseFloat(amount));

    if (snapToFullHolding) {
      numAmount = roundCrypto(userHolding);
      totalCost = roundUSD(numAmount * executionPrice);

      return {
        userHolding,
        executionPrice,
        numAmount,
        totalCost,
        marginRequired: totalCost,
        buyingPower: portfolio.balance,
      };
    }

    if (inputMode === 'AMOUNT') {
      const rawAmount = parseFloat(amount);
      if (!isNaN(rawAmount) && !isNaN(executionPrice)) {
        numAmount = roundCrypto(rawAmount);
        totalCost = roundUSD(numAmount * executionPrice);
      }
    } else {
      const rawTotalCost = parseFloat(amount);
      if (!isNaN(rawTotalCost) && executionPrice > 0) {
        totalCost = roundUSD(rawTotalCost);
        numAmount = roundCrypto(totalCost / executionPrice);
      }
    }

    return {
      userHolding,
      executionPrice,
      numAmount,
      totalCost,
      marginRequired: totalCost,
      buyingPower: portfolio.balance,
    };
  }, [
    amount,
    executionPrice,
    inputMode,
    portfolio.balance,
    shouldSnapSellToFullHolding,
    userHolding,
  ]);

  const { numAmount, marginRequired } = calculations;

  // Use a sync ref lock because React's setState (isLoading) is async
  // and can't prevent double-clicks in the same event loop tick.
  const isSubmittingRef = React.useRef(false);
  const submitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingSubmit = React.useCallback(() => {
    if (!submitTimeoutRef.current) return;
    clearTimeout(submitTimeoutRef.current);
    submitTimeoutRef.current = null;
    isSubmittingRef.current = false;
  }, []);

  useEffect(() => clearPendingSubmit, [clearPendingSubmit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || isLoading) return;

    setError(null);

    if (!coin) return;

    const rawInputValue = parseFloat(amount);

    if (!Number.isFinite(rawInputValue) || rawInputValue <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (inputMode === 'AMOUNT') {
      if (!isWithinInclusiveRange(rawInputValue, CRYPTO_AMOUNT_INPUT_LIMITS)) {
        setError(`Amount must be within ${describeCryptoAmountRange()} ${coin.symbol}.`);
        return;
      }
    } else if (!isWithinInclusiveRange(rawInputValue, USD_VALUE_INPUT_LIMITS)) {
      setError(`Total value must be within ${describeUsdInputRange()}.`);
      return;
    }

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      setError(
        orderType === 'LIMIT'
          ? 'Please enter a valid limit price.'
          : 'Market price is currently unavailable. Please wait for live data.'
      );
      return;
    }

    if (!isWithinInclusiveRange(executionPrice, PRICE_INPUT_LIMITS)) {
      setError(
        orderType === 'LIMIT'
          ? `Limit price must be within ${describePriceInputRange()}.`
          : 'Market price is currently unavailable. Please wait for live data.'
      );
      return;
    }

    if (
      orderType === 'LIMIT' &&
      !isDirectionalLimitPriceValid(tradeType, executionPrice, coin.price)
    ) {
      setError(getDirectionalLimitPriceError(tradeType, coin.price));
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (inputMode === 'TOTAL' && !isWithinInclusiveRange(numAmount, CRYPTO_AMOUNT_INPUT_LIMITS)) {
      setError(`Amount must be within ${describeCryptoAmountRange()} ${coin.symbol}.`);
      return;
    }

    // TP/SL validation: SELL orders never carry TP/SL (UI disables them; enforce here)
    const tpPrice = tradeType === 'BUY' && takeProfit ? parseFloat(takeProfit) : undefined;
    const slPrice = tradeType === 'BUY' && stopLoss ? parseFloat(stopLoss) : undefined;

    if (tpPrice !== undefined && !isWithinInclusiveRange(tpPrice, PRICE_INPUT_LIMITS)) {
      setError(`Take Profit must be within ${describePriceInputRange()}.`);
      return;
    }

    if (slPrice !== undefined && !isWithinInclusiveRange(slPrice, PRICE_INPUT_LIMITS)) {
      setError(`Stop Loss must be within ${describePriceInputRange()}.`);
      return;
    }

    if (tpPrice && slPrice) {
      if (tradeType === 'BUY') {
        if (tpPrice <= slPrice) {
          setError('Take Profit must be higher than Stop Loss for BUY orders.');
          return;
        }
      } else {
        if (tpPrice >= slPrice) {
          setError('Take Profit must be lower than Stop Loss for SELL orders.');
          return;
        }
      }
    }

    if (tradeType === 'BUY') {
      if (marginRequired > portfolio.balance) {
        setError(`Insufficient margin. Required: ${formatUsdWithSymbol(marginRequired)}`);
        return;
      }

      if (tpPrice && tpPrice <= executionPrice) {
        setError('Take Profit must be higher than execution price for BUY.');
        return;
      }
      if (slPrice && slPrice >= executionPrice) {
        setError('Stop Loss must be lower than execution price for BUY.');
        return;
      }
    } else {
      if (numAmount > userHolding) {
        setError(`Insufficient ${coin.symbol} balance.`);
        return;
      }

      if (tpPrice && tpPrice >= executionPrice) {
        setError('Take Profit must be lower than execution price for SELL.');
        return;
      }
      if (slPrice && slPrice <= executionPrice) {
        setError('Stop Loss must be higher than execution price for SELL.');
        return;
      }
    }

    setIsLoading(true);
    isSubmittingRef.current = true;

    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
      const success = onExecuteTrade(
        coin.id,
        tradeType,
        numAmount,
        orderType,
        orderType === 'LIMIT' ? executionPrice : undefined,
        tpPrice,
        slPrice
      );

      if (success) {
        toast.custom(
          (t) => (
            <TransactionToast
              t={t}
              type={tradeType}
              orderType={orderType}
              amount={numAmount}
              symbol={coin.symbol}
              price={executionPrice}
            />
          ),
          { duration: 4000 }
        );
        onClose();
      }

      setIsLoading(false);
      isSubmittingRef.current = false;
    }, 600);
  };

  return {
    formState: {
      amount,
      setAmount,
      tradeType,
      setTradeType,
      orderType,
      setOrderType,
      limitPrice,
      setLimitPrice,
      inputMode,
      setInputMode,
      takeProfit,
      setTakeProfit,
      stopLoss,
      setStopLoss,
      error,
      setError,
      isLoading,
    },
    calculations,
    handleSubmit,
  };
};
