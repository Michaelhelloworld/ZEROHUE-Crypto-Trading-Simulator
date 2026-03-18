import { ReplaySource } from './replayWindow';

export interface AppInitializationReplayError {
  sources: ReplaySource[];
  attemptCount: number;
}

export type AppInitializationStage = 'hydrating' | 'replay_pending' | 'replay_error' | 'ready';

export const resolveAppInitializationStage = ({
  isHydrated,
  isInitialReplaySettled,
  initialReplayError,
}: {
  isHydrated: boolean;
  isInitialReplaySettled: boolean;
  initialReplayError: AppInitializationReplayError | null;
}): AppInitializationStage => {
  if (!isHydrated) return 'hydrating';
  if (isInitialReplaySettled) return 'ready';
  if (initialReplayError) return 'replay_error';
  return 'replay_pending';
};

export const isAppInitializationReady = (stage: AppInitializationStage) => stage === 'ready';
