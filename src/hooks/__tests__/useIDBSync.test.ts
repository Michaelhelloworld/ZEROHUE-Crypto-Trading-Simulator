import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIDBSync } from '../useIDBSync';
import { dbService, ZEROHUESchema } from '../../services/db';
import { Order } from '../../types'; // Transaction intentionally omitted (unused)

// Mock dbService
vi.mock('../../services/db', () => ({
  dbService: {
    bulkPut: vi.fn().mockResolvedValue(true),
    bulkDelete: vi.fn().mockResolvedValue(true),
  },
}));

describe('useIDBSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not sync on the transition to hydrated (prevention of redundant initialization write)', async () => {
    const data: Order[] = [
      {
        id: '1',
        type: 'BUY',
        coinId: 'btc',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 50000,
        total: 50000,
        status: 'OPEN',
        timestamp: Date.now(),
      },
    ];
    const { rerender } = renderHook(({ isHydrated }) => useIDBSync('orders', data, isHydrated), {
      initialProps: { isHydrated: false },
    });

    // Transition to hydrated
    rerender({ isHydrated: true });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Should NOT have called bulkPut because we just hydrated and the data matches the "initial" state
    expect(dbService.bulkPut).not.toHaveBeenCalled();
  });

  it('should perform incremental upsert for new items', async () => {
    const initialData: Order[] = [];
    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data, true), {
      initialProps: { data: initialData },
    });

    const newData: Order[] = [
      {
        id: '1',
        type: 'BUY',
        coinId: 'btc',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 50000,
        total: 50000,
        status: 'OPEN',
        timestamp: Date.now(),
      },
    ];
    rerender({ data: newData });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(dbService.bulkPut).toHaveBeenCalledWith('orders', [newData[0]]);
  });

  it('should perform incremental delete for removed items', async () => {
    const initialData: Partial<Order>[] = [{ id: '1', type: 'BUY' }];
    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data as Order[], true), {
      initialProps: { data: initialData as Order[] },
    });

    // Set internal ref manually by letting the 1st effect run if needed,
    // but the hook uses previousDataRef initially as [].
    // So if initialData has items, they will be upserted first.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    vi.clearAllMocks();

    const newData: Order[] = [];
    rerender({ data: newData });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(dbService.bulkDelete).toHaveBeenCalledWith('orders', ['1']);
  });

  it('should not sync if data content is identical (JSON stringify check)', async () => {
    const initialData: Partial<Order>[] = [{ id: '1', type: 'BUY' }];
    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data as Order[], true), {
      initialProps: { data: initialData as Order[] },
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    vi.clearAllMocks();

    // New array reference, but same content
    const newData: Partial<Order>[] = [{ id: '1', type: 'BUY' }];
    rerender({ data: newData as Order[] });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(dbService.bulkPut).not.toHaveBeenCalled();
    expect(dbService.bulkDelete).not.toHaveBeenCalled();
  });

  it('should use coinId as key if id is missing', async () => {
    const initialData: ZEROHUESchema['market_history']['value'][] = [];
    const { rerender } = renderHook(({ data }) => useIDBSync('market_history', data, true), {
      initialProps: { data: initialData },
    });

    const newData: ZEROHUESchema['market_history']['value'][] = [
      { coinId: 'bitcoin', history: [50000], lastUpdated: Date.now() },
    ];
    rerender({ data: newData });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(dbService.bulkPut).toHaveBeenCalledWith('market_history', [newData[0]]);
  });
});

/** Helper to wrap renderHook act for vitest */
async function act(callback: () => void | Promise<void>) {
  await callback();
}
