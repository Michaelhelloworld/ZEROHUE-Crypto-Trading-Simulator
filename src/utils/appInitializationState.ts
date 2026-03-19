import { ReplaySource } from './replayWindow';

export interface AppInitializationReplayError {
  sources: ReplaySource[];
  attemptCount: number;
}

export interface AppInitializationHydrationError {
  code: 'orders_unavailable' | 'transactions_unavailable' | 'unexpected';
  message: string;
}

export type AppInitializationStage =
  | 'hydrating'
  | 'hydration_error'
  | 'replay_pending'
  | 'replay_error'
  | 'ready';

export const resolveAppInitializationStage = ({
  isHydrated,
  hydrationError,
  isInitialReplaySettled,
  initialReplayError,
}: {
  isHydrated: boolean;
  hydrationError: AppInitializationHydrationError | null;
  isInitialReplaySettled: boolean;
  initialReplayError: AppInitializationReplayError | null;
}): AppInitializationStage => {
  if (hydrationError) return 'hydration_error';
  if (!isHydrated) return 'hydrating';
  if (isInitialReplaySettled) return 'ready';
  if (initialReplayError) return 'replay_error';
  return 'replay_pending';
};

export const isAppInitializationReady = (stage: AppInitializationStage) => stage === 'ready';
