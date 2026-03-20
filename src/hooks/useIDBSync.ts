import { useEffect, useRef } from 'react';
import { dbService, ZEROHUESchema } from '../services/db';
import { usePersistenceSyncStore } from '../store/usePersistenceSyncStore';
import {
  getPersistenceInvalidationMessage,
  isCurrentTabPersistenceWritable,
} from '../utils/persistenceEpoch';

const INITIAL_SYNC_DELAY_MS = 100;
const BASE_RETRY_SYNC_DELAY_MS = 1000;
const MAX_RETRY_SYNC_DELAY_MS = 8000;
const MAX_CONSECUTIVE_SYNC_FAILURES = 5;

const isTrackedPersistenceStore = (
  storeName: keyof ZEROHUESchema
): storeName is 'orders' | 'transactions' => storeName === 'orders' || storeName === 'transactions';

/**
 * A pure side-effect hook that observes a data array and incrementally syncs
 * any variations (UPSERT / DELETE) back into the IndexedDB store.
 * It does NOT hold or return state.
 */
export function useIDBSync<K extends keyof ZEROHUESchema>(
  storeName: K,
  data: ZEROHUESchema[K]['value'][],
  isHydrated: boolean
) {
  const previousIsHydrated = useRef(isHydrated);
  const previousDataRef = useRef<ZEROHUESchema[K]['value'][]>([]);
  const consecutiveFailureCountRef = useRef(0);
  const markStoreHealthy = usePersistenceSyncStore((state) => state.markStoreHealthy);
  const markStoreRetrying = usePersistenceSyncStore((state) => state.markStoreRetrying);
  const markStoreDegraded = usePersistenceSyncStore((state) => state.markStoreDegraded);

  useEffect(() => {
    // 1. Transition: Just became hydrated.
    // Capture the initial data state as the reference point WITHOUT triggering a sync.
    // This prevents a redundant bulkPut of the entire array that was just loaded from DB.
    if (isHydrated && !previousIsHydrated.current) {
      previousDataRef.current = data;
      previousIsHydrated.current = true;
      return;
    }

    // 2. Reset the hydration transition marker whenever initialization drops
    // back out of the hydrated state (for example, Retry Hydration).
    if (!isHydrated) {
      previousIsHydrated.current = false;
      return;
    }

    const trackedStoreName = isTrackedPersistenceStore(storeName) ? storeName : null;
    let isCancelled = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSync = (delayMs: number) => {
      if (isCancelled) return;
      if (syncTimer) {
        clearTimeout(syncTimer);
      }

      syncTimer = setTimeout(() => {
        syncTimer = null;
        void syncToDB();
      }, delayMs);
    };

    const syncToDB = async () => {
      if (isCancelled) return;

      const prevData = previousDataRef.current;
      const currentData = data;

      if (!isCurrentTabPersistenceWritable()) {
        previousDataRef.current = [...currentData];
        consecutiveFailureCountRef.current = 0;
        if (trackedStoreName) {
          markStoreDegraded(trackedStoreName, 1, getPersistenceInvalidationMessage());
        }
        return;
      }

      const getKey = (item: ZEROHUESchema[K]['value']): string | null => {
        if (!item) return null;
        if ('id' in item) return String((item as { id: string }).id);
        if ('coinId' in item) return String((item as { coinId: string }).coinId);
        return null;
      };

      const currentMap = new Map<string, ZEROHUESchema[K]['value']>();
      currentData.forEach((item) => {
        const k = getKey(item);
        if (k) currentMap.set(k, item);
      });

      const prevMap = new Map<string, ZEROHUESchema[K]['value']>();
      prevData.forEach((item) => {
        const k = getKey(item);
        if (k) prevMap.set(k, item);
      });

      const toUpsert: ZEROHUESchema[K]['value'][] = [];
      const toDelete: string[] = [];

      // Find Upserts (added or modified)
      currentMap.forEach((currItem, key) => {
        const prevItem = prevMap.get(key);
        if (!prevItem) {
          toUpsert.push(currItem);
        } else {
          // Optimized Diffing: Use updatedAt timestamp if available.
          // Otherwise fallback to deep stringify comparison for stores without timestamps.
          const currUpdated = (currItem as { updatedAt?: number }).updatedAt;
          const prevUpdated = (prevItem as { updatedAt?: number }).updatedAt;

          if (currUpdated !== undefined && prevUpdated !== undefined) {
            if (currUpdated > prevUpdated) {
              toUpsert.push(currItem);
            }
          } else if (JSON.stringify(prevItem) !== JSON.stringify(currItem)) {
            toUpsert.push(currItem);
          }
        }
      });

      // Find Deletes
      prevMap.forEach((_, key) => {
        if (!currentMap.has(key)) {
          toDelete.push(key);
        }
      });

      // Use a snapshot of current and previous state to allow rolling back on failure.
      const snapshotValue = [...currentData];
      const rollbackValue = [...prevData];

      try {
        // Optimistically update the ref to prevent overlapping debounced syncs
        // from re-computing diffs against a stale snapshot during slow DB writes.
        previousDataRef.current = snapshotValue;

        if (toUpsert.length > 0) {
          await dbService.bulkPut(storeName, toUpsert);
        }
        if (toDelete.length > 0) {
          await dbService.bulkDelete(storeName, toDelete);
        }

        consecutiveFailureCountRef.current = 0;
        if (trackedStoreName) {
          markStoreHealthy(trackedStoreName);
        }
      } catch (err) {
        console.error(`Failed to incremental sync ${storeName} to IDB`, err);
        // Rollback on failure: if no other sync has moved the ref forward since we started,
        // revert it so the next cycle can re-detect and retry these changes.
        if (previousDataRef.current === snapshotValue) {
          previousDataRef.current = rollbackValue;
        }

        consecutiveFailureCountRef.current += 1;
        const failureCount = consecutiveFailureCountRef.current;
        const nextRetryDelay = Math.min(
          BASE_RETRY_SYNC_DELAY_MS * 2 ** (failureCount - 1),
          MAX_RETRY_SYNC_DELAY_MS
        );
        const isDegraded = failureCount >= MAX_CONSECUTIVE_SYNC_FAILURES;

        if (trackedStoreName) {
          const storeLabel = trackedStoreName === 'orders' ? 'orders' : 'transaction history';
          if (isDegraded) {
            markStoreDegraded(
              trackedStoreName,
              failureCount,
              `Local ${storeLabel} persistence is unavailable. Recent changes may not survive a refresh until browser storage recovers.`
            );
          } else {
            markStoreRetrying(
              trackedStoreName,
              failureCount,
              Date.now() + nextRetryDelay,
              `Retrying local ${storeLabel} persistence in ${Math.round(nextRetryDelay / 1000)}s. Avoid refreshing until this clears.`
            );
          }
        }

        if (!isDegraded) {
          scheduleSync(nextRetryDelay);
        }
      }
    };

    // Use requestIdleCallback or setTimeout to yield to UI thread if we are syncing large arrays
    scheduleSync(INITIAL_SYNC_DELAY_MS);
    return () => {
      isCancelled = true;
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };
  }, [data, isHydrated, markStoreDegraded, markStoreHealthy, markStoreRetrying, storeName]);
}
