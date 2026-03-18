import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TradePanel from '../TradePanel';
import { Coin } from '../../../../types';
import { TradeCalculations, TradeFormState } from '../../../../hooks/useTradeForm';

vi.mock('../../../../hooks/useHaptic', () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        }: {
          children?: React.ReactNode;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          transition?: unknown;
        }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

const coin: Coin = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 100,
  change24h: 0,
  history: [100],
};

interface TradePanelHarnessProps {
  tradeType?: 'BUY' | 'SELL';
  inputMode?: 'AMOUNT' | 'TOTAL';
  orderType?: 'MARKET' | 'LIMIT';
  limitPrice?: string;
  calculations: TradeCalculations;
}

const TradePanelHarness: React.FC<TradePanelHarnessProps> = ({
  tradeType = 'SELL',
  inputMode = 'AMOUNT',
  orderType = 'MARKET',
  limitPrice = '',
  calculations,
}) => {
  const [amount, setAmount] = React.useState('');
  const [currentTradeType, setTradeType] = React.useState<'BUY' | 'SELL'>(tradeType);
  const [currentOrderType, setOrderType] = React.useState<'MARKET' | 'LIMIT'>(orderType);
  const [currentLimitPrice, setLimitPrice] = React.useState(limitPrice);
  const [currentInputMode, setInputMode] = React.useState<'AMOUNT' | 'TOTAL'>(inputMode);
  const [takeProfit, setTakeProfit] = React.useState('');
  const [stopLoss, setStopLoss] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const formState: TradeFormState = {
    amount,
    setAmount,
    tradeType: currentTradeType,
    setTradeType,
    orderType: currentOrderType,
    setOrderType,
    limitPrice: currentLimitPrice,
    setLimitPrice,
    inputMode: currentInputMode,
    setInputMode,
    takeProfit,
    setTakeProfit,
    stopLoss,
    setStopLoss,
    error,
    setError,
    isLoading: false,
  };

  return (
    <TradePanel
      coin={coin}
      formState={formState}
      calculations={calculations}
      handleSubmit={(event) => event.preventDefault()}
    />
  );
};

describe('TradePanel quick presets', () => {
  it('truncates SELL 100% amount presets instead of rounding them up', () => {
    render(
      <TradePanelHarness
        calculations={{
          userHolding: 1.2345678,
          executionPrice: 100,
          numAmount: 0,
          totalCost: 0,
          marginRequired: 0,
          buyingPower: 0,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '100%' }));

    expect(screen.getByLabelText(/Trade amount input/i)).toHaveValue(1.234567);
    expect(screen.getByText(/1.234567 BTC/i)).toBeInTheDocument();
  });

  it('truncates SELL 100% total-value presets instead of rounding them up', () => {
    render(
      <TradePanelHarness
        inputMode="TOTAL"
        calculations={{
          userHolding: 1.2345678,
          executionPrice: 100,
          numAmount: 0,
          totalCost: 0,
          marginRequired: 0,
          buyingPower: 0,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '100%' }));

    expect(screen.getByLabelText(/Trade amount input/i)).toHaveValue(123.45);
  });

  it('uses execution price for SELL total-value presets when a limit price is set', () => {
    render(
      <TradePanelHarness
        inputMode="TOTAL"
        orderType="LIMIT"
        limitPrice="200"
        calculations={{
          userHolding: 1,
          executionPrice: 200,
          numAmount: 0,
          totalCost: 0,
          marginRequired: 0,
          buyingPower: 0,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '100%' }));

    expect(screen.getByLabelText(/Trade amount input/i)).toHaveValue(200);
    expect(screen.getByText(/\$200\.00/i)).toBeInTheDocument();
  });
});
