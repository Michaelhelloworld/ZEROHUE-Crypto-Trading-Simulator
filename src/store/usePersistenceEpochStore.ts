import { create } from 'zustand';

interface PersistenceEpochState {
  currentEpoch: number;
  tabEpoch: number | null;
  isCurrentTabWritable: boolean;
  invalidationMessage: string | null;
  initializeTabEpoch: (epoch: number) => void;
  syncCurrentEpoch: (epoch: number) => void;
  invalidateTab: (epoch: number, message: string) => void;
  reset: () => void;
}

const DEFAULT_EPOCH = 1;

export const DEFAULT_PERSISTENCE_INVALIDATION_MESSAGE =
  'Another ZEROHUE tab rebuilt local persistence. Reload this tab before continuing.';

export const usePersistenceEpochStore = create<PersistenceEpochState>((set) => ({
  currentEpoch: DEFAULT_EPOCH,
  tabEpoch: DEFAULT_EPOCH,
  isCurrentTabWritable: true,
  invalidationMessage: null,
  initializeTabEpoch: (epoch) =>
    set({
      currentEpoch: epoch,
      tabEpoch: epoch,
      isCurrentTabWritable: true,
      invalidationMessage: null,
    }),
  syncCurrentEpoch: (epoch) =>
    set((state) => ({
      currentEpoch: Math.max(state.currentEpoch, epoch),
    })),
  invalidateTab: (epoch, message) =>
    set((state) => ({
      currentEpoch: Math.max(state.currentEpoch, epoch),
      isCurrentTabWritable: false,
      invalidationMessage: message,
    })),
  reset: () =>
    set({
      currentEpoch: DEFAULT_EPOCH,
      tabEpoch: DEFAULT_EPOCH,
      isCurrentTabWritable: true,
      invalidationMessage: null,
    }),
}));
