import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIDBSync } from '../useIDBSync';
import { dbService, ZEROHUESchema } from '../../services/db';
import { LOCAL_PERSISTENCE_EPOCH_KEY } from '../../constants/storage';
import { usePersistenceEpochStore } from '../../store/usePersistenceEpochStore';
import { usePersistenceSyncStore } from '../../store/usePersistenceSyncStore';
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
    localStorage.clear();
    usePersistenceEpochStore.getState().reset();
    usePersistenceSyncStore.getState().resetIssues();
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

  it('should not sync when hydration succeeds again after a retry cycle', async () => {
    const firstHydrationData: Order[] = [
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
    const secondHydrationData: Order[] = [
      ...firstHydrationData,
      {
        id: '2',
        type: 'BUY',
        coinId: 'eth',
        coinSymbol: 'ETH',
        amount: 2,
        limitPrice: 3000,
        total: 6000,
        status: 'OPEN',
        timestamp: Date.now() + 1,
      },
    ];

    const { rerender } = renderHook(
      ({ data, isHydrated }) => useIDBSync('orders', data, isHydrated),
      {
        initialProps: {
          data: firstHydrationData,
          isHydrated: false,
        },
      }
    );

    rerender({ data: firstHydrationData, isHydrated: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(dbService.bulkPut).not.toHaveBeenCalled();

    rerender({ data: firstHydrationData, isHydrated: false });
    rerender({ data: secondHydrationData, isHydrated: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(dbService.bulkPut).not.toHaveBeenCalled();
    expect(dbService.bulkDelete).not.toHaveBeenCalled();
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

  it('retries a failed sync even when no further state changes occur', async () => {
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

    vi.mocked(dbService.bulkPut)
      .mockRejectedValueOnce(new Error('temporary idb failure'))
      .mockResolvedValue(true);

    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data, true), {
      initialProps: { data: [] as Order[] },
    });

    rerender({ data: newData });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(dbService.bulkPut).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(dbService.bulkPut).toHaveBeenCalledTimes(2);
    expect(dbService.bulkPut).toHaveBeenLastCalledWith('orders', [newData[0]]);
    expect(usePersistenceSyncStore.getState().issues.orders.status).toBe('healthy');
  });

  it('enters a degraded persistence state after repeated failures and stops hot retries', async () => {
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

    vi.mocked(dbService.bulkPut).mockRejectedValue(new Error('persistent idb failure'));

    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data, true), {
      initialProps: { data: [] as Order[] },
    });

    rerender({ data: newData });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(dbService.bulkPut).toHaveBeenCalledTimes(5);
    expect(usePersistenceSyncStore.getState().issues.orders).toMatchObject({
      status: 'degraded',
      failureCount: 5,
      nextRetryAt: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });

    expect(dbService.bulkPut).toHaveBeenCalledTimes(5);
  });

  it('blocks IndexedDB writes after another tab advances the persistence epoch', async () => {
    localStorage.setItem(LOCAL_PERSISTENCE_EPOCH_KEY, '1');
    usePersistenceEpochStore.getState().initializeTabEpoch(1);

    const newData: Order[] = [
      {
        id: 'epoch-blocked-order',
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

    const { rerender } = renderHook(({ data }) => useIDBSync('orders', data, true), {
      initialProps: { data: [] as Order[] },
    });

    localStorage.setItem(LOCAL_PERSISTENCE_EPOCH_KEY, '2');
    rerender({ data: newData });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(dbService.bulkPut).not.toHaveBeenCalled();
    expect(usePersistenceSyncStore.getState().issues.orders).toMatchObject({
      status: 'degraded',
      message: expect.stringContaining('Reload this tab before continuing'),
    });
  });
});
