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

export const useWorkerBridge = ({ onTickResult }: UseWorkerBridgeOptions) => {
  const workerRef = useRef<Worker | null>(null);
  const nextTickRequestIdRef = useRef(0);
  const activeTickRequestIdRef = useRef<number | null>(null);
  const queuedTickPayloadsRef = useRef<TickPayload[]>([]);
  const onTickResultRef = useRef(onTickResult);
  const dispatchTickRef = useRef<(payload: Omit<TickPayload, 'requestId'>) => void>(() => {});

  useEffect(() => {
    onTickResultRef.current = onTickResult;
  }, [onTickResult]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/marketEngine.worker.ts', import.meta.url), {
      type: 'module',
    });

    const dispatchNextQueuedTick = () => {
      if (activeTickRequestIdRef.current !== null) return;

      while (queuedTickPayloadsRef.current.length > 0) {
        const nextPayload = queuedTickPayloadsRef.current.shift()!;

        // User trades and replay commits can invalidate queued snapshots before they run.
        if (nextPayload.requestVersion !== useStore.getState().engineStateVersion) {
          continue;
        }

        activeTickRequestIdRef.current = nextPayload.requestId;
        worker.postMessage(createTickInput(nextPayload));
        return;
      }
    };

    dispatchTickRef.current = (payload: Omit<TickPayload, 'requestId'>) => {
      nextTickRequestIdRef.current += 1;
      queuedTickPayloadsRef.current.push({
        ...payload,
        requestId: nextTickRequestIdRef.current,
      });
      dispatchNextQueuedTick();
    };

    worker.onmessage = (event: MessageEvent<EngineOutput>) => {
      const { type, payload } = event.data;
      if (type !== 'TICK_RESULT') return;

      if (isOutOfOrderTickResult(activeTickRequestIdRef.current, payload)) {
        console.warn(
          '[Nexus Engine] Ignored unexpected worker payload: it no longer matches the active market tick request.'
        );
        return;
      }

      activeTickRequestIdRef.current = null;

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

    workerRef.current = worker;

    return () => {
      dispatchTickRef.current = () => {};
      activeTickRequestIdRef.current = null;
      queuedTickPayloadsRef.current = [];
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    dispatchTickRef,
  };
};
