import { useEffect } from 'react';
import { LOCAL_PERSISTENCE_EPOCH_KEY } from '../constants/storage';
import {
  getPersistenceEpochChannel,
  initializeCurrentTabPersistenceEpoch,
  syncIncomingPersistenceEpoch,
} from '../utils/persistenceEpoch';

const parseEpoch = (rawEpoch: string | null) => {
  const parsed = Number(rawEpoch);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

export const usePersistenceEpochGuard = () => {
  useEffect(() => {
    initializeCurrentTabPersistenceEpoch();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleEpochChange = (nextEpoch: number | null) => {
      if (nextEpoch === null) return;
      syncIncomingPersistenceEpoch(nextEpoch);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_PERSISTENCE_EPOCH_KEY) return;
      handleEpochChange(parseEpoch(event.newValue));
    };

    window.addEventListener('storage', handleStorage);

    const channel = getPersistenceEpochChannel();
    const handleMessage = (event: MessageEvent<{ type?: string; epoch?: number }>) => {
      if (event.data?.type !== 'epoch') return;
      handleEpochChange(Number.isFinite(event.data.epoch) ? Number(event.data.epoch) : null);
    };

    channel?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel?.removeEventListener('message', handleMessage);
    };
  }, []);
};
