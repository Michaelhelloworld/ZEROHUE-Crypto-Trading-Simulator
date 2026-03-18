import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradingViewWidget } from '../TradeView';

describe('TradingViewWidget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a fallback state after script load failure and can retry', async () => {
    const { container } = render(<TradingViewWidget symbol="BINANCE:BTCUSDT" />);

    const firstScript = await waitFor(() => {
      const script = container.querySelector(
        'script[src*="embed-widget-advanced-chart.js"]'
      ) as HTMLScriptElement | null;
      expect(script).not.toBeNull();
      return script;
    });

    act(() => {
      firstScript?.onerror?.(new Event('error'));
    });

    expect(await screen.findByText(/Chart unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry Chart/i }));

    await waitFor(() => {
      const retriedScript = container.querySelector(
        'script[src*="embed-widget-advanced-chart.js"]'
      ) as HTMLScriptElement | null;
      expect(retriedScript).not.toBeNull();
      expect(retriedScript).not.toBe(firstScript);
    });
  });

  it('shows a fallback state after load timeout', async () => {
    vi.useFakeTimers();

    render(<TradingViewWidget symbol="COINBASE:HYPEUSD" loadTimeoutMs={25} />);

    act(() => {
      vi.advanceTimersByTime(26);
    });

    expect(screen.getByText(/Chart unavailable/i)).toBeInTheDocument();
  });
});
