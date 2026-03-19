import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { Coin } from '../../../types';
import { TRADING_FEE_RATE } from '../../../constants/data';
import { useHaptic } from '../../../hooks/useHaptic';
import { TradeFormState, TradeCalculations } from '../../../hooks/useTradeForm';
import {
  CRYPTO_AMOUNT_INPUT_LIMITS,
  PRICE_INPUT_LIMITS,
  USD_VALUE_INPUT_LIMITS,
  preventSignedExponentInput,
} from '../../../utils/inputConstraints';
import {
  USD_INPUT_PLACEHOLDER,
  formatAmount,
  formatAmountInput,
  formatPriceInput,
  formatPrice,
  formatUsdInput,
  formatUsdWithSymbol,
} from '../../../utils/format';
import {
  getDefaultLimitPriceInput,
  getDirectionalLimitPriceBounds,
  isDirectionalLimitPriceValid,
} from '../../../utils/limitOrderPrice';

interface TradePanelProps {
  coin: Coin;
  formState: TradeFormState;
  calculations: TradeCalculations;
  handleSubmit: (e: React.FormEvent) => void;
}

const TradePanel: React.FC<TradePanelProps> = ({ coin, formState, calculations, handleSubmit }) => {
  const { trigger } = useHaptic();
  const {
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
    isLoading,
  } = formState;

  const { userHolding, totalCost, buyingPower } = calculations;
  const directionalLimitBounds = getDirectionalLimitPriceBounds(tradeType, coin.price);
  const limitPriceMin =
    tradeType === 'SELL'
      ? formatPriceInput(directionalLimitBounds.min)
      : PRICE_INPUT_LIMITS.minText;
  const limitPriceMax =
    tradeType === 'BUY' ? formatPriceInput(directionalLimitBounds.max) : PRICE_INPUT_LIMITS.maxText;
  const limitPriceHint = `${
    tradeType === 'BUY' ? 'Set below' : 'Set above'
  } current market: ${formatPrice(coin.price)} USDT`;
  const amountInputMin =
    inputMode === 'AMOUNT' ? CRYPTO_AMOUNT_INPUT_LIMITS.minText : USD_VALUE_INPUT_LIMITS.minText;
  const amountInputMaxValue = (() => {
    if (inputMode === 'AMOUNT') {
      const maxByPortfolio =
        tradeType === 'BUY'
          ? calculations.executionPrice > 0
            ? buyingPower / calculations.executionPrice
            : CRYPTO_AMOUNT_INPUT_LIMITS.max
          : userHolding;
      return Math.max(0, Math.min(maxByPortfolio, CRYPTO_AMOUNT_INPUT_LIMITS.max));
    }

    const maxByPortfolio =
      tradeType === 'BUY' ? buyingPower : userHolding * calculations.executionPrice;
    return Math.max(0, Math.min(maxByPortfolio, USD_VALUE_INPUT_LIMITS.max));
  })();
  const amountInputMax =
    inputMode === 'AMOUNT'
      ? formatAmountInput(amountInputMaxValue) || '0'
      : formatUsdInput(amountInputMaxValue) || '0';

  const clampTradeInputValue = React.useCallback(
    (rawValue: string) => {
      if (rawValue === '') return '';

      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue)) return rawValue;

      if (parsedValue <= 0 || amountInputMaxValue <= 0) {
        return rawValue;
      }

      if (parsedValue > amountInputMaxValue) {
        return inputMode === 'AMOUNT'
          ? formatAmountInput(amountInputMaxValue)
          : formatUsdInput(amountInputMaxValue);
      }

      return rawValue;
    },
    [amountInputMaxValue, inputMode]
  );

  const handleAmountInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setAmount(clampTradeInputValue(event.target.value));
    },
    [clampTradeInputValue, setAmount]
  );

  const availableLabel =
    tradeType === 'BUY'
      ? formatUsdWithSymbol(buyingPower)
      : inputMode === 'TOTAL'
        ? formatUsdWithSymbol(userHolding * calculations.executionPrice)
        : `${formatAmountInput(userHolding) || formatAmount(0)} ${coin.symbol}`;

  return (
    <div className="glass-card w-full min-w-0 overflow-hidden p-6 rounded-3xl border border-white/5 flex flex-col relative h-full xl:h-auto">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none rounded-t-3xl" />

      <div className="relative mb-6">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
          Execution Panel
          <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {/* Trade Type Tabs */}
        <div className="relative bg-slate-900/80 p-1 rounded-2xl border border-white/5 flex gap-1">
          <button
            type="button"
            aria-pressed={tradeType === 'BUY'}
            aria-label="Select Buy order type"
            onClick={() => {
              setTradeType('BUY');
              if (orderType === 'LIMIT') {
                setLimitPrice(getDefaultLimitPriceInput('BUY', coin.price));
              }
              trigger('medium');
            }}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all relative z-10 uppercase tracking-widest ${tradeType === 'BUY' ? 'bg-emerald-500/90 text-white shadow-lg border border-emerald-400/50' : 'text-slate-500 hover:text-slate-300 bg-transparent border border-transparent'}`}
          >
            Buy
          </button>
          <button
            type="button"
            aria-pressed={tradeType === 'SELL'}
            aria-label="Select Sell order type"
            onClick={() => {
              setTradeType('SELL');
              if (orderType === 'LIMIT') {
                setLimitPrice(getDefaultLimitPriceInput('SELL', coin.price));
              }
              trigger('medium');
            }}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all relative z-10 uppercase tracking-widest ${tradeType === 'SELL' ? 'bg-red-500/90 text-white shadow-lg border border-red-400/50' : 'text-slate-500 hover:text-slate-300 bg-transparent border border-transparent'}`}
          >
            Sell
          </button>
        </div>

        {/* Order Type Select */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[11px] font-black text-slate-500 uppercase tracking-widest">
            <span>Order Type</span>
            {orderType === 'MARKET' && (
              <span className="text-blue-400/80 font-mono lowercase">instantly filled</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
            <button
              type="button"
              aria-pressed={orderType === 'MARKET'}
              aria-label="Market order - Execute at current price"
              onClick={() => setOrderType('MARKET')}
              className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                orderType === 'MARKET'
                  ? 'bg-slate-800 text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Market
            </button>
            <button
              type="button"
              aria-pressed={orderType === 'LIMIT'}
              aria-label="Limit order - Execute at specific price"
              onClick={() => {
                setOrderType('LIMIT');
                if (!isDirectionalLimitPriceValid(tradeType, parseFloat(limitPrice), coin.price)) {
                  setLimitPrice(getDefaultLimitPriceInput(tradeType, coin.price));
                }
              }}
              className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                orderType === 'LIMIT'
                  ? 'bg-slate-800 text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Price Input for LIMIT */}
        <AnimatePresence mode="wait">
          {orderType === 'LIMIT' && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
                Limit Price (USDT)
              </label>
              <div className="relative group">
                <input
                  type="number"
                  step={PRICE_INPUT_LIMITS.step}
                  min={limitPriceMin}
                  max={limitPriceMax}
                  aria-label="Limit price input"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  onKeyDown={preventSignedExponentInput}
                  className="w-full bg-slate-950/50 border border-white/5 group-hover:border-blue-500/30 rounded-xl px-4 py-3.5 text-sm font-bold font-mono text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300"
                  placeholder={USD_INPUT_PLACEHOLDER}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-[11px]">
                  USDT
                </div>
              </div>
              <p className="px-1 text-[11px] text-slate-500 font-medium">{limitPriceHint}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Amount Input Card */}
        <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4 ring-1 ring-white/[0.02] focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500/40 focus-within:shadow-[0_0_25px_rgba(59,130,246,0.15)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="flex justify-between items-center relative z-10">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              {inputMode === 'AMOUNT' ? 'Amount' : 'Total Value'}
            </label>
            <button
              type="button"
              onClick={() => {
                setAmount('');
                setInputMode(inputMode === 'AMOUNT' ? 'TOTAL' : 'AMOUNT');
              }}
              className="text-[11px] font-bold text-blue-400/80 hover:text-blue-300 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-500/10 transition-colors"
            >
              <Zap size={10} /> {inputMode === 'AMOUNT' ? 'USD' : coin.symbol}
            </button>
          </div>

          <div className="relative flex flex-col gap-1 min-w-0">
            <div className="relative min-w-0">
              <input
                type="number"
                step={
                  inputMode === 'AMOUNT'
                    ? CRYPTO_AMOUNT_INPUT_LIMITS.step
                    : USD_VALUE_INPUT_LIMITS.step
                }
                min={amountInputMin}
                max={amountInputMax}
                inputMode="decimal"
                aria-label="Trade amount input"
                value={amount}
                onChange={handleAmountInputChange}
                onKeyDown={preventSignedExponentInput}
                className="w-full min-w-0 bg-transparent pr-16 text-3xl font-bold font-mono text-white focus:outline-none placeholder:text-slate-800"
                placeholder={inputMode === 'AMOUNT' ? formatAmount(0) : USD_INPUT_PLACEHOLDER}
              />
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase transition-colors group-focus-within:text-blue-400">
                {inputMode === 'AMOUNT' ? coin.symbol : 'USD'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 relative z-10">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  const multiplier = pct / 100;
                  if (inputMode === 'AMOUNT') {
                    if (tradeType === 'BUY') {
                      const price =
                        orderType === 'LIMIT' && limitPrice ? parseFloat(limitPrice) : coin.price;
                      setAmount(formatAmountInput((buyingPower * multiplier) / price));
                    } else {
                      setAmount(formatAmountInput(userHolding * multiplier));
                    }
                  } else {
                    if (tradeType === 'BUY') {
                      setAmount(formatUsdInput(buyingPower * multiplier));
                    } else {
                      setAmount(
                        formatUsdInput(userHolding * calculations.executionPrice * multiplier)
                      );
                    }
                  }
                }}
                className="flex-1 py-2.5 md:py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[11px] md:text-[10px] font-black text-slate-500 hover:text-white border border-white/5 transition-all active:scale-95"
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-1 px-1 relative z-10">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter">
              Available
            </span>
            <span className="text-xs text-slate-200 font-mono font-bold">{availableLabel}</span>
          </div>
        </div>

        {/* Advance Options (TP/SL) */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Protective Orders
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" /> Take Profit
              </label>
              <div className="relative group">
                <input
                  type="number"
                  step={PRICE_INPUT_LIMITS.step}
                  min={PRICE_INPUT_LIMITS.minText}
                  max={PRICE_INPUT_LIMITS.maxText}
                  aria-label="Take profit input"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  onKeyDown={preventSignedExponentInput}
                  disabled={tradeType === 'SELL'}
                  className={`w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all disabled:opacity-20 placeholder:text-slate-500 ${
                    takeProfit ? 'text-emerald-400/90' : 'text-slate-200'
                  }`}
                  placeholder={USD_INPUT_PLACEHOLDER}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-500" /> Stop Loss
              </label>
              <div className="relative group">
                <input
                  type="number"
                  step={PRICE_INPUT_LIMITS.step}
                  min={PRICE_INPUT_LIMITS.minText}
                  max={PRICE_INPUT_LIMITS.maxText}
                  aria-label="Stop loss input"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  onKeyDown={preventSignedExponentInput}
                  disabled={tradeType === 'SELL'}
                  className={`w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 focus:shadow-[0_0_15px_rgba(239,68,68,0.15)] transition-all disabled:opacity-20 placeholder:text-slate-500 ${
                    stopLoss ? 'text-red-400/90' : 'text-slate-200'
                  }`}
                  placeholder={USD_INPUT_PLACEHOLDER}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="pt-2">
          <div className="rounded-xl bg-white/[0.03] p-4 border border-white/5 space-y-4">
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                Est. Total {tradeType === 'BUY' ? 'Cost' : 'Proceeds'}
              </div>
              <div className="text-2xl font-mono font-bold text-white tracking-tight tabular-nums">
                {formatUsdWithSymbol(totalCost)}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-3">
              <span className="text-slate-500 font-medium">
                Trading Fee ({(TRADING_FEE_RATE * 100).toFixed(2)}%)
              </span>
              <span className="text-slate-400 font-mono tabular-nums">
                {formatUsdWithSymbol(totalCost * TRADING_FEE_RATE, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[11px] font-bold text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98] relative overflow-hidden group cursor-pointer select-none touch-manipulation ${
            tradeType === 'BUY'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] border border-emerald-400/20'
              : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] border border-red-400/20'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
          {isLoading ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="animate-spin" size={18} />
              <span>Processing</span>
            </div>
          ) : (
            <span>Confirm {tradeType}</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default React.memo(TradePanel);
