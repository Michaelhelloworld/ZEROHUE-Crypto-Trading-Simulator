import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  createTickInput,
  EngineOutput,
  isOutOfOrderTickResult,
  isStaleTickResult,
  TickPayload,
  TickResultPayload,
} from '../utils/engineProtocol';

interface UseWorkerBridgeOptions {
  onTickResult: (payload: TickResultPayload) => void;
}

const MAX_CONSECUTIVE_WORKER_FAILURES = 3;
const WORKER_FAILURE_BACKOFF_MS = 1000;

export const useWorkerBridge = ({ onTickResult }: UseWorkerBridgeOptions) => {
  const workerRef = useRef<Worker | null>(null);
  const nextTickRequestIdRef = useRef(0);
  const activeTickRequestIdRef = useRef<number | null>(null);
  const activeTickPayloadRef = useRef<TickPayload | null>(null);
  const queuedTickPayloadsRef = useRef<TickPayload[]>([]);
  const retryCoalesceVersionRef = useRef<number | null>(null);
  const consecutiveFailureCountRef = useRef(0);
  const drainScheduledRef = useRef(false);
  const drainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBackoffUntilRef = useRef(0);
  const onTickResultRef = useRef(onTickResult);
  const dispatchTickRef = useRef<(payload: Omit<TickPayload, 'requestId'>) => void>(() => {});

  useEffect(() => {
    onTickResultRef.current = onTickResult;
  }, [onTickResult]);

  useEffect(() => {
    let isUnmounted = false;

    const clearDrainTimeout = () => {
      if (!drainTimeoutRef.current) return;
      clearTimeout(drainTimeoutRef.current);
      drainTimeoutRef.current = null;
    };

    const scheduleDrainQueue = (delayMs = 0) => {
      if (isUnmounted) return;

      if (delayMs > 0) {
        if (drainTimeoutRef.current) return;

        drainTimeoutRef.current = setTimeout(() => {
          drainTimeoutRef.current = null;
          dispatchNextQueuedTick();
        }, delayMs);
        return;
      }

      if (drainScheduledRef.current) return;

      drainScheduledRef.current = true;
      queueMicrotask(() => {
        drainScheduledRef.current = false;
        dispatchNextQueuedTick();
      });
    };

    const clearActiveTick = () => {
      activeTickRequestIdRef.current = null;
      activeTickPayloadRef.current = null;
    };

    const queueActiveTickForRetry = (activePayload: TickPayload) => {
      retryCoalesceVersionRef.current = activePayload.requestVersion;
      queuedTickPayloadsRef.current.unshift(activePayload);
    };

    const coalesceRetriedVersionQueue = () => {
      const retryVersion = retryCoalesceVersionRef.current;
      if (retryVersion === null) return;

      retryCoalesceVersionRef.current = null;

      const sameVersionPayloads = queuedTickPayloadsRef.current.filter(
        (payload) => payload.requestVersion === retryVersion
      );

      if (sameVersionPayloads.length <= 1) return;

      const latestPayload = sameVersionPayloads[sameVersionPayloads.length - 1];
      const remainingPayloads = queuedTickPayloadsRef.current.filter(
        (payload) => payload.requestVersion !== retryVersion
      );

      queuedTickPayloadsRef.current = [latestPayload, ...remainingPayloads];
    };

    const terminateWorker = (worker: Worker | null = null) => {
      if (worker) {
        if (workerRef.current !== worker) return;
        worker.terminate();
        workerRef.current = null;
        return;
      }

      workerRef.current?.terminate();
      workerRef.current = null;
    };

    const createWorker = () => {
      try {
        const worker = new Worker(new URL('../workers/marketEngine.worker.ts', import.meta.url), {
          type: 'module',
        });

        worker.onmessage = (event: MessageEvent<EngineOutput>) => {
          handleWorkerMessage(worker, event);
        };
        worker.onerror = (event) => {
          handleWorkerFailure(worker, '[Nexus Engine] Worker execution failed.', event);
        };
        worker.onmessageerror = (event) => {
          handleWorkerFailure(
            worker,
            '[Nexus Engine] Worker returned an unreadable message.',
            event
          );
        };

        return worker;
      } catch (error) {
        console.error('[Nexus Engine] Failed to create worker.', error);
        return null;
      }
    };

    const getOrCreateWorker = () => {
      if (workerRef.current) return workerRef.current;

      workerRef.current = createWorker();
      return workerRef.current;
    };

    const dispatchNextQueuedTick = () => {
      if (isUnmounted) return;
      if (activeTickRequestIdRef.current !== null) return;

      const backoffRemainingMs = workerBackoffUntilRef.current - Date.now();
      if (backoffRemainingMs > 0) {
        scheduleDrainQueue(backoffRemainingMs);
        return;
      }
      workerBackoffUntilRef.current = 0;
      coalesceRetriedVersionQueue();

      while (queuedTickPayloadsRef.current.length > 0) {
        const nextPayload = queuedTickPayloadsRef.current.shift()!;

        // User trades and replay commits can invalidate queued snapshots before they run.
        if (nextPayload.requestVersion !== useStore.getState().engineStateVersion) {
          continue;
        }

        activeTickRequestIdRef.current = nextPayload.requestId;
        activeTickPayloadRef.current = nextPayload;

        const worker = getOrCreateWorker();
        if (!worker) {
          handleWorkerFailure(
            null,
            '[Nexus Engine] Unable to dispatch tick because the worker is unavailable.',
            nextPayload
          );
          return;
        }

        try {
          worker.postMessage(createTickInput(nextPayload));
        } catch (error) {
          handleWorkerFailure(worker, '[Nexus Engine] Failed to dispatch worker tick.', error);
          return;
        }
        return;
      }
    };

    const handleWorkerFailure = (worker: Worker | null, reason: string, error: unknown) => {
      if (isUnmounted) return;

      console.error(reason, error);
      consecutiveFailureCountRef.current += 1;
      const failedPayload = activeTickPayloadRef.current;
      const failingVersion =
        failedPayload?.requestVersion ?? useStore.getState().engineStateVersion;
      const canRetryImmediately =
        consecutiveFailureCountRef.current < MAX_CONSECUTIVE_WORKER_FAILURES;

      clearActiveTick();
      if (failedPayload) {
        queueActiveTickForRetry(failedPayload);
      }
      terminateWorker(worker);

      if (!canRetryImmediately) {
        workerBackoffUntilRef.current = Date.now() + WORKER_FAILURE_BACKOFF_MS;
        consecutiveFailureCountRef.current = 0;
        console.error(
          `[Nexus Engine] Pausing automatic worker retries for engine state version ${failingVersion} for ${WORKER_FAILURE_BACKOFF_MS}ms after ${MAX_CONSECUTIVE_WORKER_FAILURES} consecutive failures.`
        );
        scheduleDrainQueue(WORKER_FAILURE_BACKOFF_MS);
        return;
      }

      scheduleDrainQueue();
    };

    const handleWorkerMessage = (worker: Worker, event: MessageEvent<EngineOutput>) => {
      if (isUnmounted || workerRef.current !== worker) return;

      const { data } = event;
      if (!data || data.type !== 'TICK_RESULT' || !data.payload) {
        handleWorkerFailure(
          worker,
          '[Nexus Engine] Worker returned an unexpected payload.',
          event.data
        );
        return;
      }

      const { payload } = data;
      if (isOutOfOrderTickResult(activeTickRequestIdRef.current, payload)) {
        handleWorkerFailure(
          worker,
          '[Nexus Engine] Worker returned an unexpected tick result ordering.',
          payload
        );
        return;
      }

      consecutiveFailureCountRef.current = 0;
      workerBackoffUntilRef.current = 0;
      clearDrainTimeout();
      clearActiveTick();

      if (isStaleTickResult(useStore.getState().engineStateVersion, payload)) {
        console.warn(
          '[Nexus Engine] Race condition intercepted: User traded during worker execution. Tick aborted to protect state integrity.'
        );
        dispatchNextQueuedTick();
        return;
      }

      onTickResultRef.current(payload);
      dispatchNextQueuedTick();
    };

    dispatchTickRef.current = (payload: Omit<TickPayload, 'requestId'>) => {
      nextTickRequestIdRef.current += 1;
      queuedTickPayloadsRef.current.push({
        ...payload,
        requestId: nextTickRequestIdRef.current,
      });
      dispatchNextQueuedTick();
    };
    workerRef.current = createWorker();

    return () => {
      isUnmounted = true;
      drainScheduledRef.current = false;
      clearDrainTimeout();
      dispatchTickRef.current = () => {};
      activeTickRequestIdRef.current = null;
      activeTickPayloadRef.current = null;
      retryCoalesceVersionRef.current = null;
      consecutiveFailureCountRef.current = 0;
      workerBackoffUntilRef.current = 0;
      queuedTickPayloadsRef.current = [];
      terminateWorker();
    };
  }, []);

  return {
    dispatchTickRef,
  };
};
