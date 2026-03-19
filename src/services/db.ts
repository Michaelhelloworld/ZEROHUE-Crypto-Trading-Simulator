import { deleteDB, openDB, IDBPDatabase } from 'idb';
import { Transaction, Order } from '../types';

export interface ZEROHUESchema {
  transactions: {
    key: string;
    value: Transaction;
  };
  orders: {
    key: string;
    value: Order;
  };
  market_history: {
    key: string;
    value: {
      coinId: string;
      history: number[];
      lastUpdated: number;
    };
  };
}

const DB_NAME = 'zerohue_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ZEROHUESchema>> | null = null;

function initDB(): Promise<IDBPDatabase<ZEROHUESchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ZEROHUESchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('market_history')) {
          db.createObjectStore('market_history', { keyPath: 'coinId' });
        }
      },
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export const __dbTestUtils = {
  reset() {
    dbPromise = null;
  },
};

export const dbService = {
  async getAll<T extends keyof ZEROHUESchema>(storeName: T) {
    const db = await initDB();
    return db.getAll(storeName);
  },

  async put<T extends keyof ZEROHUESchema>(storeName: T, value: ZEROHUESchema[T]['value']) {
    const db = await initDB();
    return db.put(storeName, value);
  },

  async bulkPut<T extends keyof ZEROHUESchema>(storeName: T, values: ZEROHUESchema[T]['value'][]) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    values.forEach((value) => store.put(value));
    await tx.done;
    return true;
  },

  async bulkDelete<T extends keyof ZEROHUESchema>(storeName: T, keys: string[]) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    keys.forEach((key) => store.delete(key));
    await tx.done;
    return true;
  },

  async replaceAll<T extends keyof ZEROHUESchema>(
    storeName: T,
    values: ZEROHUESchema[T]['value'][]
  ) {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    // All operations (clear + puts) are queued on the same transaction.
    // IDB guarantees atomicity: either ALL succeed on tx.done, or ALL roll back.
    store.clear();
    for (const value of values) {
      store.put(value);
    }
    await tx.done;
    return true;
  },

  /**
   * Prunes old market history to prevent database bloat.
   * Keeps data from the last 7 days by default.
   */
  async pruneHistory(days = 7) {
    const db = await initDB();
    const tx = db.transaction('market_history', 'readwrite');
    const store = tx.objectStore('market_history');
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const allHistory = await store.getAll();
    for (const record of allHistory) {
      if (record.lastUpdated < cutoff) {
        await store.delete(record.coinId);
      }
    }
    return tx.done;
  },

  async delete<T extends keyof ZEROHUESchema>(storeName: T, key: string) {
    const db = await initDB();
    return db.delete(storeName, key);
  },

  async clear<T extends keyof ZEROHUESchema>(storeName: T) {
    const db = await initDB();
    return db.clear(storeName);
  },

  async clearSimulatorState() {
    const db = await initDB();
    const tx = db.transaction(['orders', 'transactions'], 'readwrite');
    tx.objectStore('orders').clear();
    tx.objectStore('transactions').clear();
    await tx.done;
    return true;
  },

  async resetLocalPersistence() {
    const existingDb = await (dbPromise?.catch(() => null) ?? Promise.resolve(null));
    existingDb?.close();
    dbPromise = null;
    await deleteDB(DB_NAME);
    return true;
  },
};
