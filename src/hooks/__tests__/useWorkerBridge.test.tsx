import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as useStoreModule from '../../store/useStore';
import { useWorkerBridge } from '../useWorkerBridge';

class ControlledWorker {
  static instances: ControlledWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly postMessage = vi.fn((data: unknown) => {
    this.postedMessages.push(data);
  });
  readonly terminate = vi.fn();
  readonly postedMessages: unknown[] = [];

  constructor() {
    ControlledWorker.instances.push(this);
  }
}

const createDispatchPayload = () => ({
  requestVersion: 0,
  coins: [
    {
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 100,
      change24h: 0,
      history: [100],
    },
  ],
  orders: [],
  portfolio: {
    balance: 1000,
    initialBalance: 1000,
    holdings: [],
  },
});

const emitTickResult = (worker: ControlledWorker, requestId: number, requestVersion = 0) => {
  worker.onmessage?.({
    data: {
      type: 'TICK_RESULT',
      payload: {
        requestId,
        requestVersion,
        portfolioUpdates: null,
        nextOrders: null,
        newTransactions: [],
        notifications: [],
      },
    },
  } as MessageEvent);
};

describe('useWorkerBridge', () => {
  const OriginalWorker = global.Worker;
  let engineStateVersion = 0;

  beforeEach(() => {
    ControlledWorker.instances = [];
    engineStateVersion = 0;
    global.Worker = ControlledWorker as unknown as typeof Worker;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (
      useStoreModule.useStore as unknown as {
        getState: () => { engineStateVersion: number };
      }
    ).getState = vi.fn(() => ({
      engineStateVersion,
    }));
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries the latest queued snapshot for the same engine version after an unexpected payload', async () => {
    const onTickResult = vi.fn();
    const { result } = renderHook(() => useWorkerBridge({ onTickResult }));

    act(() => {
      result.current.dispatchTickRef.current(createDispatchPayload());
      result.current.dispatchTickRef.current(createDispatchPayload());
    });

    const firstWorker = ControlledWorker.instances[0];
    expect(firstWorker.postedMessages).toHaveLength(1);
    expect(
      (firstWorker.postedMessages[0] as { payload: { requestId: number } }).payload.requestId
    ).toBe(1);

    await act(async () => {
      firstWorker.onmessage?.({
        data: {
          type: 'BROKEN',
        },
      } as MessageEvent);
      await Promise.resolve();
    });

    expect(ControlledWorker.instances).toHaveLength(2);
    const recoveredWorker = ControlledWorker.instances[1];
    expect(recoveredWorker.postedMessages).toHaveLength(1);
    expect(
      (recoveredWorker.postedMessages[0] as { payload: { requestId: number } }).payload.requestId
    ).toBe(2);

    act(() => {
      emitTickResult(recoveredWorker, 2);
    });

    expect(onTickResult).toHaveBeenCalledTimes(1);
    expect(recoveredWorker.postedMessages).toHaveLength(1);
  });

  it('recreates the worker and retries the active tick after a worker error when no newer snapshot exists', async () => {
    const onTickResult = vi.fn();
    const { result } = renderHook(() => useWorkerBridge({ onTickResult }));

    act(() => {
      result.current.dispatchTickRef.current(createDispatchPayload());
    });

    const firstWorker = ControlledWorker.instances[0];
    expect(firstWorker.postedMessages).toHaveLength(1);

    await act(async () => {
      firstWorker.onerror?.(new Event('error'));
      await Promise.resolve();
    });

    expect(ControlledWorker.instances).toHaveLength(2);
    const recoveredWorker = ControlledWorker.instances[1];
    expect(recoveredWorker.postedMessages).toHaveLength(1);
    expect(
      (recoveredWorker.postedMessages[0] as { payload: { requestId: number } }).payload.requestId
    ).toBe(1);

    act(() => {
      emitTickResult(recoveredWorker, 1);
    });

    expect(onTickResult).toHaveBeenCalledTimes(1);
    expect(recoveredWorker.postedMessages).toHaveLength(1);
  });

  it('backs off after repeated worker failures and resumes from the latest queued snapshot for that version', async () => {
    vi.useFakeTimers();
    const onTickResult = vi.fn();
    const { result } = renderHook(() => useWorkerBridge({ onTickResult }));

    act(() => {
      result.current.dispatchTickRef.current(createDispatchPayload());
    });

    const firstWorker = ControlledWorker.instances[0];
    await act(async () => {
      firstWorker.onerror?.(new Event('error'));
      await Promise.resolve();
    });

    const secondWorker = ControlledWorker.instances[1];
    await act(async () => {
      secondWorker.onerror?.(new Event('error'));
      await Promise.resolve();
    });

    const thirdWorker = ControlledWorker.instances[2];
    await act(async () => {
      thirdWorker.onerror?.(new Event('error'));
      await Promise.resolve();
    });

    expect(ControlledWorker.instances).toHaveLength(3);

    act(() => {
      result.current.dispatchTickRef.current(createDispatchPayload());
    });

    expect(ControlledWorker.instances).toHaveLength(3);
    expect(onTickResult).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(ControlledWorker.instances).toHaveLength(4);
    const recoveredWorker = ControlledWorker.instances[3];
    expect(recoveredWorker.postedMessages).toHaveLength(1);
    expect(
      (recoveredWorker.postedMessages[0] as { payload: { requestId: number } }).payload.requestId
    ).toBe(2);

    act(() => {
      emitTickResult(recoveredWorker, 2);
    });

    expect(onTickResult).toHaveBeenCalledTimes(1);
    expect(recoveredWorker.postedMessages).toHaveLength(1);

    vi.useRealTimers();
  });
});
