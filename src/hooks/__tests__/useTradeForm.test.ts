import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradeForm } from '../useTradeForm';
import { Coin, Portfolio } from '../../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), custom: vi.fn() },
}));

const createCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 50000,
  change24h: 0,
  history: [50000],
  ...overrides,
});

describe('useTradeForm', () => {
  let coin: Coin;
  let portfolio: Portfolio;
  let onExecuteTrade: Mock;
  let onClose: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    coin = createCoin();
    portfolio = { balance: 50000, initialBalance: 50000, holdings: [] };
    onExecuteTrade = vi.fn();
    onClose = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderFormHook = (overrides: Partial<Parameters<typeof useTradeForm>[0]> = {}) =>
    renderHook(() =>
      useTradeForm({
        coin,
        portfolio,
        onExecuteTrade: onExecuteTrade as unknown as (
          coinId: string,
          type: 'BUY' | 'SELL',
          amount: number,
          orderType: 'MARKET' | 'LIMIT',
          limitPrice?: number,
          takeProfitPrice?: number,
          stopLossPrice?: number
        ) => boolean,
        onClose: onClose as unknown as () => void,
        ...overrides,
      })
    );

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderFormHook();

      expect(result.current.formState.amount).toBe('');
      expect(result.current.formState.tradeType).toBe('BUY');
      expect(result.current.formState.orderType).toBe('MARKET');
      expect(result.current.formState.error).toBeNull();
      expect(result.current.formState.isLoading).toBe(false);
    });

    it('should initialize BUY limit price below the current market price', () => {
      const { result } = renderFormHook();
      expect(result.current.formState.limitPrice).toBe('49999.99');
    });
  });

  describe('Amount Calculations', () => {
    it('should compute total cost from amount in AMOUNT mode', () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0.5');
      });

      expect(result.current.calculations.numAmount).toBe(0.5);
      expect(result.current.calculations.totalCost).toBe(25000);
    });

    it('should compute amount from total in TOTAL mode', () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setInputMode('TOTAL');
        result.current.formState.setAmount('25000');
      });

      expect(result.current.calculations.totalCost).toBe(25000);
      expect(result.current.calculations.numAmount).toBe(0.5); // 25000 / 50000
    });

    it('should snap SELL amount inputs at the displayed max to the full holding', () => {
      portfolio.holdings = [{ coinId: 'bitcoin', amount: 1.23456789, averageCost: 40000 }];
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setTradeType('SELL');
        result.current.formState.setAmount('1.234567');
      });

      expect(result.current.calculations.numAmount).toBe(1.23456789);
      expect(result.current.calculations.totalCost).toBe(61728.39);
    });

    it('should snap SELL total-value inputs at the displayed max to the full holding', () => {
      portfolio.holdings = [{ coinId: 'bitcoin', amount: 1.23456789, averageCost: 40000 }];
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setTradeType('SELL');
        result.current.formState.setInputMode('TOTAL');
        result.current.formState.setAmount('61728.39');
      });

      expect(result.current.calculations.numAmount).toBe(1.23456789);
      expect(result.current.calculations.totalCost).toBe(61728.39);
    });
  });

  describe('Validation', () => {
    it('should reject zero amount', async () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toBe('Please enter a valid amount.');
      expect(onExecuteTrade).not.toHaveBeenCalled();
    });

    it('should reject empty amount', async () => {
      const { result } = renderFormHook();

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toBe('Please enter a valid amount.');
    });

    it('should reject BUY when insufficient balance', async () => {
      portfolio.balance = 1000;
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0.5'); // 0.5 * 50000 = 25000 > 1000
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toContain('Insufficient margin');
    });

    it('should reject SELL when insufficient holdings', async () => {
      portfolio.holdings = [{ coinId: 'bitcoin', amount: 0.3, averageCost: 45000 }];
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setTradeType('SELL');
        result.current.formState.setAmount('0.5'); // More than 0.3 held
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toContain('Insufficient');
    });

    it('should reject invalid limit price', async () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setOrderType('LIMIT');
        result.current.formState.setLimitPrice('0');
        result.current.formState.setAmount('0.1');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toBe('Please enter a valid limit price.');
    });

    it('should reject BUY limit prices at or above the current market price', async () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setOrderType('LIMIT');
        result.current.formState.setAmount('0.1');
        result.current.formState.setLimitPrice('50000');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toBe(
        'Limit price must stay below the current market price (50,000.00 USDT).'
      );
      expect(onExecuteTrade).not.toHaveBeenCalled();
    });

    it('should reject SELL limit prices at or below the current market price', async () => {
      portfolio.holdings = [{ coinId: 'bitcoin', amount: 1, averageCost: 45000 }];
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setTradeType('SELL');
        result.current.formState.setOrderType('LIMIT');
        result.current.formState.setAmount('0.1');
        result.current.formState.setLimitPrice('49999');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toBe(
        'Limit price must stay above the current market price (50,000.00 USDT).'
      );
      expect(onExecuteTrade).not.toHaveBeenCalled();
    });

    it('allows TOTAL-mode BUY orders for low-priced coins when the derived amount remains within the supported range', async () => {
      vi.useFakeTimers();
      coin = createCoin({
        id: 'shiba-inu',
        symbol: 'SHIB',
        name: 'Shiba Inu',
        price: 0.1,
        history: [0.1],
      });
      portfolio.balance = 100000000;
      onExecuteTrade.mockReturnValue(true);
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setInputMode('TOTAL');
        result.current.formState.setAmount('100000000');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.formState.error).toBeNull();
      expect(onExecuteTrade).toHaveBeenCalledWith(
        'shiba-inu',
        'BUY',
        1000000000,
        'MARKET',
        undefined,
        undefined,
        undefined
      );
      vi.useRealTimers();
    });

    it('allows TOTAL-mode SELL orders for low-priced coins when the derived amount remains within the supported range', async () => {
      vi.useFakeTimers();
      coin = createCoin({
        id: 'shiba-inu',
        symbol: 'SHIB',
        name: 'Shiba Inu',
        price: 0.1,
        history: [0.1],
      });
      portfolio.holdings = [{ coinId: 'shiba-inu', amount: 2000000000, averageCost: 0.08 }];
      onExecuteTrade.mockReturnValue(true);
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setTradeType('SELL');
        result.current.formState.setInputMode('TOTAL');
        result.current.formState.setAmount('10000001');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.formState.error).toBeNull();
      expect(onExecuteTrade).toHaveBeenCalledWith(
        'shiba-inu',
        'SELL',
        100000010,
        'MARKET',
        undefined,
        undefined,
        undefined
      );
      vi.useRealTimers();
    });

    it('rejects TOTAL-mode BUY orders when the derived coin amount exceeds the numeric safety limit', async () => {
      coin = createCoin({
        id: 'shiba-inu',
        symbol: 'SHIB',
        name: 'Shiba Inu',
        price: 0.00000001,
        history: [0.00000001],
      });
      portfolio.balance = 100000000;
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setInputMode('TOTAL');
        result.current.formState.setAmount('100000000');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toContain('Amount must be within');
      expect(onExecuteTrade).not.toHaveBeenCalled();
    });
  });

  describe('TP/SL Validation', () => {
    it('should reject BUY with TP lower than SL', async () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0.1');
        result.current.formState.setTakeProfit('48000');
        result.current.formState.setStopLoss('52000');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toContain('Take Profit must be higher than Stop Loss');
    });

    it('should reject BUY with TP below execution price', async () => {
      const { result } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0.1');
        result.current.formState.setTakeProfit('49000'); // Below 50000 market price
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.error).toContain(
        'Take Profit must be higher than execution price'
      );
    });
  });

  describe('User Holdings', () => {
    it('should correctly calculate user holdings', () => {
      portfolio.holdings = [{ coinId: 'bitcoin', amount: 2.5, averageCost: 40000 }];
      const { result } = renderFormHook();

      expect(result.current.calculations.userHolding).toBe(2.5);
    });

    it('should return 0 for no holdings', () => {
      const { result } = renderFormHook();
      expect(result.current.calculations.userHolding).toBe(0);
    });
  });

  describe('Submission lifecycle', () => {
    it('cancels a delayed submission when the trade form unmounts before execution', async () => {
      vi.useFakeTimers();
      onExecuteTrade.mockReturnValue(true);
      const { result, unmount } = renderFormHook();

      act(() => {
        result.current.formState.setAmount('0.1');
      });

      await act(async () => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });

      expect(result.current.formState.isLoading).toBe(true);

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(onExecuteTrade).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
