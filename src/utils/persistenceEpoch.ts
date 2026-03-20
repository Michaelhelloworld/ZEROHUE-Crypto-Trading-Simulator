import { LOCAL_PERSISTENCE_EPOCH_KEY } from '../constants/storage';
import {
  usePersistenceEpochStore,
  DEFAULT_PERSISTENCE_INVALIDATION_MESSAGE,
} from '../store/usePersistenceEpochStore';
import { safeStorage } from './safeStorage';

const DEFAULT_EPOCH = 1;
const EPOCH_CHANNEL_NAME = 'zerohue:persistence-epoch';

let epochChannel: BroadcastChannel | null | undefined;

const getEpochChannel = () => {
  if (epochChannel !== undefined) return epochChannel;
  if (typeof BroadcastChannel === 'undefined') {
    epochChannel = null;
    return epochChannel;
  }

  try {
    epochChannel = new BroadcastChannel(EPOCH_CHANNEL_NAME);
  } catch {
    epochChannel = null;
  }

  return epochChannel;
};

const parseEpoch = (rawEpoch: string | null) => {
  const parsed = Number(rawEpoch);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

const broadcastEpoch = (epoch: number) => {
  try {
    getEpochChannel()?.postMessage({ type: 'epoch', epoch });
  } catch {
    // Best-effort only; storage events still cover most browsers.
  }
};

export const getPersistenceInvalidationMessage = () =>
  usePersistenceEpochStore.getState().invalidationMessage ||
  DEFAULT_PERSISTENCE_INVALIDATION_MESSAGE;

export const readPersistenceEpoch = () =>
  parseEpoch(safeStorage.getItem(LOCAL_PERSISTENCE_EPOCH_KEY));

export const ensurePersistenceEpoch = () => {
  const existingEpoch = readPersistenceEpoch();
  if (existingEpoch !== null) {
    usePersistenceEpochStore.getState().syncCurrentEpoch(existingEpoch);
    return {
      ok: true,
      epoch: existingEpoch,
    } as const;
  }

  if (!safeStorage.setItem(LOCAL_PERSISTENCE_EPOCH_KEY, String(DEFAULT_EPOCH))) {
    return {
      ok: false,
      epoch: null,
    } as const;
  }

  usePersistenceEpochStore.getState().syncCurrentEpoch(DEFAULT_EPOCH);
  broadcastEpoch(DEFAULT_EPOCH);
  return {
    ok: true,
    epoch: DEFAULT_EPOCH,
  } as const;
};

export const initializeCurrentTabPersistenceEpoch = () => {
  const ensuredEpoch = ensurePersistenceEpoch();
  if (!ensuredEpoch.ok || ensuredEpoch.epoch === null) {
    return ensuredEpoch;
  }

  usePersistenceEpochStore.getState().initializeTabEpoch(ensuredEpoch.epoch);
  return ensuredEpoch;
};

export const syncIncomingPersistenceEpoch = (
  nextEpoch: number,
  message = DEFAULT_PERSISTENCE_INVALIDATION_MESSAGE
) => {
  const store = usePersistenceEpochStore.getState();
  store.syncCurrentEpoch(nextEpoch);

  if (store.tabEpoch !== null && nextEpoch > store.tabEpoch) {
    store.invalidateTab(nextEpoch, message);
  }
};

export const advanceCurrentTabPersistenceEpoch = () => {
  const ensuredEpoch = ensurePersistenceEpoch();
  if (!ensuredEpoch.ok || ensuredEpoch.epoch === null) {
    return ensuredEpoch;
  }

  const nextEpoch =
    Math.max(ensuredEpoch.epoch, usePersistenceEpochStore.getState().currentEpoch) + 1;
  if (!safeStorage.setItem(LOCAL_PERSISTENCE_EPOCH_KEY, String(nextEpoch))) {
    return {
      ok: false,
      epoch: null,
    } as const;
  }

  usePersistenceEpochStore.getState().initializeTabEpoch(nextEpoch);
  broadcastEpoch(nextEpoch);
  return {
    ok: true,
    epoch: nextEpoch,
  } as const;
};

export const isCurrentTabPersistenceWritable = () => {
  const ensuredEpoch = ensurePersistenceEpoch();
  if (!ensuredEpoch.ok || ensuredEpoch.epoch === null) {
    return false;
  }

  const store = usePersistenceEpochStore.getState();
  if (!store.isCurrentTabWritable) {
    return false;
  }

  if (store.tabEpoch !== null && ensuredEpoch.epoch > store.tabEpoch) {
    store.invalidateTab(ensuredEpoch.epoch, DEFAULT_PERSISTENCE_INVALIDATION_MESSAGE);
    return false;
  }

  return true;
};

export const getPersistenceEpochChannel = () => getEpochChannel();
