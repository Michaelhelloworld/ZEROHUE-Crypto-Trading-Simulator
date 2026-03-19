import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService, ZEROHUESchema, __dbTestUtils } from '../db';
import * as idb from 'idb';
import * as useStoreModule from '../../store/useStore';
import { AppState } from '../../store/useStore';

// Define stable mock objects so references remain the same even across test runs
// if the dbService module-level promise caches them.
const mockStore = {
  put: vi.fn().mockResolvedValue('key'),
  delete: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  clear: vi.fn().mockResolvedValue(undefined),
};

const mockTx = {
  objectStore: vi.fn().mockReturnValue(mockStore),
  done: Promise.resolve(),
};

const mockDB = {
  getAll: vi.fn().mockResolvedValue([]),
  put: vi.fn().mockResolvedValue('key'),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  transaction: vi.fn().mockReturnValue(mockTx),
};

vi.mock('idb', () => ({
  openDB: vi.fn().mockImplementation(() => Promise.resolve(mockDB)),
  deleteDB: vi.fn().mockResolvedValue(undefined),
}));

describe('dbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __dbTestUtils.reset();

    // Reset individual method mocks to default behaviors if they were overridden
    mockDB.getAll.mockResolvedValue([]);
    mockDB.put.mockResolvedValue('key');
    mockStore.getAll.mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('should initialize the database only once', async () => {
      await dbService.getAll('orders');
      await dbService.getAll('transactions');

      expect(idb.openDB).toHaveBeenCalledTimes(1);
    });

    it('should recover after an initial openDB failure instead of poisoning the session', async () => {
      vi.mocked(idb.openDB)
        .mockRejectedValueOnce(new Error('open failed'))
        .mockResolvedValueOnce(mockDB as never);

      await expect(dbService.getAll('orders')).rejects.toThrow('open failed');
      await expect(dbService.getAll('orders')).resolves.toEqual([]);

      expect(idb.openDB).toHaveBeenCalledTimes(2);
    });
  });

  describe('Basic CRUD', () => {
    it('should call db.getAll with correct store name', async () => {
      const data = [{ id: '1', type: 'BUY' }];
      mockDB.getAll.mockResolvedValue(data);

      const result = await dbService.getAll('orders');
      expect(mockDB.getAll).toHaveBeenCalledWith('orders');
      expect(result).toEqual(data);
    });

    it('should call db.put with value', async () => {
      const value: ZEROHUESchema['orders']['value'] = {
        id: '1',
        type: 'BUY',
        coinId: 'btc',
        coinSymbol: 'BTC',
        amount: 1,
        limitPrice: 50000,
        total: 50000,
        status: 'OPEN',
        timestamp: Date.now(),
      };
      await dbService.put('orders', value);
      expect(mockDB.put).toHaveBeenCalledWith('orders', value);
    });

    it('should call db.delete with key', async () => {
      await dbService.delete('orders', 'key');
      expect(mockDB.delete).toHaveBeenCalledWith('orders', 'key');
    });

    it('should clear store', async () => {
      await dbService.clear('orders');
      expect(mockDB.clear).toHaveBeenCalledWith('orders');
    });

    it('should clear simulator state in a single multi-store transaction', async () => {
      await dbService.clearSimulatorState();

      expect(mockDB.transaction).toHaveBeenCalledWith(['orders', 'transactions'], 'readwrite');
      expect(mockTx.objectStore).toHaveBeenCalledWith('orders');
      expect(mockTx.objectStore).toHaveBeenCalledWith('transactions');
      expect(mockStore.clear).toHaveBeenCalledTimes(2);
    });

    it('should reset local persistence by closing and deleting the database', async () => {
      await dbService.getAll('orders');
      await dbService.resetLocalPersistence();

      expect(mockDB.close).toHaveBeenCalledTimes(1);
      expect(idb.deleteDB).toHaveBeenCalledWith('zerohue_db');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulkPut in a single transaction', async () => {
      const values: ZEROHUESchema['orders']['value'][] = [
        {
          id: '1',
          coinId: 'btc',
          coinSymbol: 'BTC',
          type: 'BUY',
          amount: 1,
          limitPrice: 50000,
          total: 50000,
          status: 'OPEN',
          timestamp: Date.now(),
        },
        {
          id: '2',
          coinId: 'eth',
          coinSymbol: 'ETH',
          type: 'SELL',
          amount: 1,
          limitPrice: 3000,
          total: 3000,
          status: 'OPEN',
          timestamp: Date.now(),
        },
      ];
      await dbService.bulkPut('orders', values);

      expect(mockDB.transaction).toHaveBeenCalledWith('orders', 'readwrite');
      expect(mockStore.put).toHaveBeenCalledTimes(2);
      expect(mockStore.put).toHaveBeenCalledWith(values[0]);
      expect(mockStore.put).toHaveBeenCalledWith(values[1]);
    });

    it('should perform bulkDelete in a single transaction', async () => {
      const keys = ['1', '2'];
      await dbService.bulkDelete('orders', keys);

      expect(mockDB.transaction).toHaveBeenCalledWith('orders', 'readwrite');
      expect(mockStore.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledWith('1');
      expect(mockStore.delete).toHaveBeenCalledWith('2');
    });

    it('should replaceAll with clear and put', async () => {
      const values: ZEROHUESchema['orders']['value'][] = [
        {
          id: '1',
          coinId: 'btc',
          coinSymbol: 'BTC',
          type: 'BUY',
          amount: 1,
          limitPrice: 50000,
          total: 50000,
          status: 'OPEN',
          timestamp: Date.now(),
        },
      ];
      await dbService.replaceAll('orders', values);

      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.put).toHaveBeenCalledWith(values[0]);
    });
  });

  describe('Pruning', () => {
    const mockState = {
      settings: {
        pruneHistoryDays: 7,
      },
    } as unknown as AppState;
    vi.spyOn(useStoreModule, 'useStore').mockImplementation(
      (selector?: (state: AppState) => unknown) => {
        if (typeof selector === 'function') return selector(mockState);
        return mockState;
      }
    );
    (useStoreModule.useStore as unknown as { getState: () => AppState }).getState = vi.fn(
      () => mockState
    );

    it('should prune history based on cutoff date', async () => {
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const newTime = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago

      const history = [
        { coinId: 'btc', lastUpdated: oldTime },
        { coinId: 'eth', lastUpdated: newTime },
      ];
      mockStore.getAll.mockResolvedValue(history);

      await dbService.pruneHistory(7); // prune older than 7 days

      expect(mockStore.delete).toHaveBeenCalledTimes(1);
      expect(mockStore.delete).toHaveBeenCalledWith('btc');
    });
  });
});
