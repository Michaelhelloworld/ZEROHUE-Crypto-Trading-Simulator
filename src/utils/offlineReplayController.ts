import {
  ALL_REPLAY_SOURCES,
  ReplayPendingState,
  ReplaySource,
  sourceToPendingKey,
} from './replayWindow';

export interface InitialReplayErrorState {
  sources: ReplaySource[];
  attemptCount: number;
}

export interface ReplayRetryRequest {
  id: number;
  sources: ReplaySource[];
}

interface ReplayConnectionState {
  binance: boolean;
  coinbase: boolean;
}

export interface OfflineReplayControllerState {
  hasInitialReplayStarted: boolean;
  initialReplayPendingSources: ReplayPendingState;
  pendingReplaySources: ReplayPendingState;
  previousConnectionState: ReplayConnectionState;
  retryAttempt: number;
  initialReplayFailureCount: number;
  retryRequestId: number;
  handledRetryRequestId: number;
}

const getUniqueSources = (sources: ReplaySource[]): ReplaySource[] => [...new Set(sources)];

const resetPendingState = (pendingState: ReplayPendingState) => {
  pendingState.binance = false;
  pendingState.coinbase = false;
};

export const createOfflineReplayControllerState = (): OfflineReplayControllerState => ({
  hasInitialReplayStarted: false,
  initialReplayPendingSources: {
    binance: true,
    coinbase: true,
  },
  pendingReplaySources: { binance: false, coinbase: false },
  previousConnectionState: { binance: false, coinbase: false },
  retryAttempt: 0,
  initialReplayFailureCount: 0,
  retryRequestId: 0,
  handledRetryRequestId: 0,
});

export const resetReplayRetryProgress = (state: OfflineReplayControllerState) => {
  state.retryAttempt = 0;
  state.initialReplayFailureCount = 0;
};

export const getPendingInitialReplaySources = (
  state: OfflineReplayControllerState
): ReplaySource[] => {
  const pendingSources: ReplaySource[] = [];
  if (state.initialReplayPendingSources.binance) {
    pendingSources.push('BINANCE');
  }
  if (state.initialReplayPendingSources.coinbase) {
    pendingSources.push('COINBASE');
  }
  return pendingSources;
};

export const createReplayRetryRequest = (
  state: OfflineReplayControllerState,
  sources: ReplaySource[]
): ReplayRetryRequest => {
  state.retryRequestId += 1;
  return {
    id: state.retryRequestId,
    sources: getUniqueSources(sources),
  };
};

export const skipInitialReplayState = (state: OfflineReplayControllerState) => {
  state.hasInitialReplayStarted = true;
  resetReplayRetryProgress(state);
  resetPendingState(state.pendingReplaySources);
  resetPendingState(state.initialReplayPendingSources);
};

export const syncReplayConnectionState = (
  state: OfflineReplayControllerState,
  nextConnectionState: { binance: boolean; coinbase: boolean }
): ReplaySource[] => {
  const reconnectReplaySources: ReplaySource[] = [];
  const previous = state.previousConnectionState;

  if (previous.binance && !nextConnectionState.binance) {
    state.pendingReplaySources.binance = true;
  }
  if (previous.coinbase && !nextConnectionState.coinbase) {
    state.pendingReplaySources.coinbase = true;
  }

  if (nextConnectionState.binance && !previous.binance && state.pendingReplaySources.binance) {
    reconnectReplaySources.push('BINANCE');
  }
  if (nextConnectionState.coinbase && !previous.coinbase && state.pendingReplaySources.coinbase) {
    reconnectReplaySources.push('COINBASE');
  }

  state.previousConnectionState = nextConnectionState;
  return reconnectReplaySources;
};

export const resolveReplaySources = (
  state: OfflineReplayControllerState,
  retryRequest: ReplayRetryRequest | null,
  isInitialReplaySettled: boolean,
  reconnectReplaySources: ReplaySource[]
): ReplaySource[] => {
  if (retryRequest && retryRequest.id !== state.handledRetryRequestId) {
    return getUniqueSources(retryRequest.sources);
  }

  if (!state.hasInitialReplayStarted && !isInitialReplaySettled) {
    return [...ALL_REPLAY_SOURCES];
  }

  return reconnectReplaySources;
};

export const markReplayStarted = (state: OfflineReplayControllerState) => {
  state.hasInitialReplayStarted = true;
};

export const markRetryRequestHandled = (
  state: OfflineReplayControllerState,
  retryRequest: ReplayRetryRequest | null
) => {
  if (retryRequest) {
    state.handledRetryRequestId = retryRequest.id;
  }
};

export const markReplaySourcesHandled = (
  state: OfflineReplayControllerState,
  sources: ReplaySource[]
): boolean => {
  for (const source of sources) {
    const pendingKey = sourceToPendingKey(source);
    state.pendingReplaySources[pendingKey] = false;
    state.initialReplayPendingSources[pendingKey] = false;
  }

  return !state.initialReplayPendingSources.binance && !state.initialReplayPendingSources.coinbase;
};

export const getReplayRetryDelay = (
  state: OfflineReplayControllerState,
  delayMs?: number
): number => {
  const delay = delayMs ?? Math.min(1000 * Math.pow(2, state.retryAttempt), 30000);
  if (delayMs === undefined) {
    state.retryAttempt += 1;
  }
  return delay;
};

export const recordInitialReplayFailure = (
  state: OfflineReplayControllerState,
  sources: ReplaySource[],
  maxAutoRetries: number,
  isInitialReplaySettled: boolean
): InitialReplayErrorState | null => {
  if (isInitialReplaySettled) {
    return null;
  }

  state.initialReplayFailureCount += 1;
  if (state.initialReplayFailureCount < maxAutoRetries) {
    return null;
  }

  return {
    sources: getUniqueSources(sources),
    attemptCount: state.initialReplayFailureCount,
  };
};
