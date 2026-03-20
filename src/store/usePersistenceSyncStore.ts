import { create } from 'zustand';

export type PersistenceTrackedStoreName = 'orders' | 'transactions' | 'portfolio';
export type PersistenceSyncStatus = 'healthy' | 'retrying' | 'degraded';

export interface PersistenceSyncIssue {
  storeName: PersistenceTrackedStoreName;
  status: PersistenceSyncStatus;
  failureCount: number;
  nextRetryAt: number | null;
  message: string | null;
}

interface PersistenceSyncState {
  issues: Record<PersistenceTrackedStoreName, PersistenceSyncIssue>;
  markStoreHealthy: (storeName: PersistenceTrackedStoreName) => void;
  markStoreRetrying: (
    storeName: PersistenceTrackedStoreName,
    failureCount: number,
    nextRetryAt: number,
    message: string
  ) => void;
  markStoreDegraded: (
    storeName: PersistenceTrackedStoreName,
    failureCount: number,
    message: string
  ) => void;
  resetIssues: () => void;
}

const createHealthyIssue = (storeName: PersistenceTrackedStoreName): PersistenceSyncIssue => ({
  storeName,
  status: 'healthy',
  failureCount: 0,
  nextRetryAt: null,
  message: null,
});

const createDefaultIssues = () => ({
  orders: createHealthyIssue('orders'),
  transactions: createHealthyIssue('transactions'),
  portfolio: createHealthyIssue('portfolio'),
});

export const usePersistenceSyncStore = create<PersistenceSyncState>((set) => ({
  issues: createDefaultIssues(),
  markStoreHealthy: (storeName) =>
    set((state) => ({
      issues: {
        ...state.issues,
        [storeName]: createHealthyIssue(storeName),
      },
    })),
  markStoreRetrying: (storeName, failureCount, nextRetryAt, message) =>
    set((state) => ({
      issues: {
        ...state.issues,
        [storeName]: {
          storeName,
          status: 'retrying',
          failureCount,
          nextRetryAt,
          message,
        },
      },
    })),
  markStoreDegraded: (storeName, failureCount, message) =>
    set((state) => ({
      issues: {
        ...state.issues,
        [storeName]: {
          storeName,
          status: 'degraded',
          failureCount,
          nextRetryAt: null,
          message,
        },
      },
    })),
  resetIssues: () =>
    set({
      issues: createDefaultIssues(),
    }),
}));
