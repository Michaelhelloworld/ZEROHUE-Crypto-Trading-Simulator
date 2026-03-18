import {
  LAST_ONLINE_AT_KEY,
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
} from '../constants/storage';
import { safeStorage } from './safeStorage';

export type ReplaySource = 'BINANCE' | 'COINBASE';

export interface ReplayPendingState {
  binance: boolean;
  coinbase: boolean;
}

export const ALL_REPLAY_SOURCES: ReplaySource[] = ['BINANCE', 'COINBASE'];

const readStoredTimestamp = (key: string): number | null => {
  const raw = safeStorage.getItem(key);
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const hasSourceAwareLastOnlineState = () =>
  readStoredTimestamp(LAST_ONLINE_AT_BINANCE_KEY) !== null ||
  readStoredTimestamp(LAST_ONLINE_AT_COINBASE_KEY) !== null;

export const readLastOnlineAt = (source?: ReplaySource): number | null => {
  if (typeof window === 'undefined') return null;

  if (!source) {
    return readStoredTimestamp(LAST_ONLINE_AT_KEY);
  }

  const sourceKey = source === 'BINANCE' ? LAST_ONLINE_AT_BINANCE_KEY : LAST_ONLINE_AT_COINBASE_KEY;
  const sourceTimestamp = readStoredTimestamp(sourceKey);
  if (sourceTimestamp !== null) {
    return sourceTimestamp;
  }

  if (hasSourceAwareLastOnlineState()) {
    return null;
  }

  return readStoredTimestamp(LAST_ONLINE_AT_KEY);
};

export const resolveReplayStartTime = (
  baseStartTime: number,
  lastOnlineAt: number | null,
  now: number
): number => {
  const safeBaseStart = Number.isFinite(baseStartTime) && baseStartTime > 0 ? baseStartTime : now;
  const safeLastOnlineAt =
    lastOnlineAt && Number.isFinite(lastOnlineAt) && lastOnlineAt > 0 ? lastOnlineAt : null;
  const replayStart = safeLastOnlineAt ? Math.max(safeBaseStart, safeLastOnlineAt) : safeBaseStart;
  return Math.min(replayStart, now);
};

export const sourceToPendingKey = (source: ReplaySource): keyof ReplayPendingState =>
  source === 'BINANCE' ? 'binance' : 'coinbase';
