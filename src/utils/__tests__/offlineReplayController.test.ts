import { describe, expect, it } from 'vitest';
import {
  createOfflineReplayControllerState,
  getPendingInitialReplaySources,
  markReplaySourcesHandled,
  recordInitialReplayFailure,
  ReplayRetryRequest,
  resolveReplaySources,
  skipInitialReplayState,
  syncReplayConnectionState,
} from '../offlineReplayController';

describe('offlineReplayController', () => {
  it('starts with all sources pending for the initial replay', () => {
    const controller = createOfflineReplayControllerState();

    expect(getPendingInitialReplaySources(controller)).toEqual(['BINANCE', 'COINBASE']);
    expect(resolveReplaySources(controller, null, false, ['BINANCE'])).toEqual([
      'BINANCE',
      'COINBASE',
    ]);
  });

  it('queues replay for sources that reconnect after a disconnect', () => {
    const controller = createOfflineReplayControllerState();

    expect(syncReplayConnectionState(controller, { binance: true, coinbase: false })).toEqual([]);
    expect(syncReplayConnectionState(controller, { binance: false, coinbase: false })).toEqual([]);
    expect(syncReplayConnectionState(controller, { binance: true, coinbase: false })).toEqual([
      'BINANCE',
    ]);
  });

  it('clears pending sources when the user skips the initial replay', () => {
    const controller = createOfflineReplayControllerState();

    skipInitialReplayState(controller);

    expect(getPendingInitialReplaySources(controller)).toEqual([]);
    expect(resolveReplaySources(controller, null, true, ['BINANCE'])).toEqual(['BINANCE']);
  });

  it('only surfaces an initial replay error after the retry ceiling is reached', () => {
    const controller = createOfflineReplayControllerState();

    expect(recordInitialReplayFailure(controller, ['BINANCE'], 3, false)).toBeNull();
    expect(recordInitialReplayFailure(controller, ['BINANCE'], 3, false)).toBeNull();
    expect(recordInitialReplayFailure(controller, ['BINANCE'], 3, false)).toEqual({
      sources: ['BINANCE'],
      attemptCount: 3,
    });
  });

  it('marks initial replay as settled only after all pending sources are handled', () => {
    const controller = createOfflineReplayControllerState();
    const retryRequest: ReplayRetryRequest = { id: 1, sources: ['BINANCE'] };

    expect(resolveReplaySources(controller, retryRequest, false, [])).toEqual(['BINANCE']);
    expect(markReplaySourcesHandled(controller, ['BINANCE'])).toBe(false);
    expect(markReplaySourcesHandled(controller, ['COINBASE'])).toBe(true);
  });
});
