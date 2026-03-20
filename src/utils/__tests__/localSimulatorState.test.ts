import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
  LAST_ONLINE_AT_KEY,
  LOCAL_PERSISTENCE_EPOCH_KEY,
} from '../../constants/storage';
import { dbService } from '../../services/db';
import {
  executeLocalPersistenceTransition,
  LOCAL_PORTFOLIO_COMMIT_META_KEY,
  LOCAL_PERSISTENCE_TRANSITION_COMMIT_META_KEY,
  LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY,
  persistLocalPortfolioSnapshot,
  readLocalPersistenceTransition,
  stageLocalPersistenceTransition,
  validatePersistedPortfolioCommitState,
} from '../localSimulatorState';
import { usePersistenceEpochStore } from '../../store/usePersistenceEpochStore';

vi.mock('../../services/db', () => ({
  dbService: {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue('meta-key'),
    clear: vi.fn().mockResolvedValue(undefined),
    clearSimulatorState: vi.fn().mockResolvedValue(true),
    resetLocalPersistence: vi.fn().mockResolvedValue(true),
  },
}));

const createPortfolio = () => ({
  balance: 42000,
  initialBalance: 42000,
  holdings: [],
  peakBalance: 42000,
  historicalMDD: 0,
  grossProfit: 0,
  grossLoss: 0,
  validTradesCount: 0,
});

describe('localSimulatorState persistence transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    usePersistenceEpochStore.getState().reset();
  });

  it('executes a staged clear-orders transition and clears its journal', async () => {
    const nextPortfolio = createPortfolio();
    localStorage.setItem('zerohue_orders', JSON.stringify([{ id: 'legacy-order' }]));

    const didStage = stageLocalPersistenceTransition({
      version: 1,
      action: 'clear_orders',
      nextPortfolio,
    });

    expect(didStage).toBe(true);
    expect(Number(localStorage.getItem(LOCAL_PERSISTENCE_EPOCH_KEY))).toBeGreaterThan(0);
    expect(readLocalPersistenceTransition()).toMatchObject({
      version: 1,
      action: 'clear_orders',
      nextPortfolio,
    });

    const didExecute = await executeLocalPersistenceTransition({
      version: 1,
      action: 'clear_orders',
      nextPortfolio,
    });

    expect(didExecute).toBe(true);
    expect(dbService.clear).toHaveBeenCalledWith('orders');
    expect(JSON.parse(localStorage.getItem('zerohue_portfolio') || 'null')).toMatchObject({
      version: 1,
      commitVersion: 1,
      portfolio: nextPortfolio,
    });
    expect(localStorage.getItem('zerohue_orders')).toBeNull();
    expect(localStorage.getItem(LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY)).toBeNull();
  });

  it('clears replay timestamps during a staged factory reset transition', async () => {
    const nextPortfolio = createPortfolio();
    localStorage.setItem(LAST_ONLINE_AT_KEY, '1000');
    localStorage.setItem(LAST_ONLINE_AT_BINANCE_KEY, '2000');
    localStorage.setItem(LAST_ONLINE_AT_COINBASE_KEY, '3000');
    localStorage.setItem('zerohue_transactions', JSON.stringify([{ id: 'legacy-tx' }]));

    stageLocalPersistenceTransition({
      version: 1,
      action: 'factory_reset',
      nextPortfolio,
    });

    const didExecute = await executeLocalPersistenceTransition({
      version: 1,
      action: 'factory_reset',
      nextPortfolio,
    });

    expect(didExecute).toBe(true);
    expect(dbService.resetLocalPersistence).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LAST_ONLINE_AT_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_ONLINE_AT_BINANCE_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_ONLINE_AT_COINBASE_KEY)).toBeNull();
    expect(localStorage.getItem('zerohue_transactions')).toBeNull();
  });

  it('records a committed transition so a stale journal is not replayed again on next startup', async () => {
    const nextPortfolio = createPortfolio();

    const didStage = stageLocalPersistenceTransition({
      version: 1,
      action: 'clear_orders',
      nextPortfolio,
    });

    expect(didStage).toBe(true);
    const stagedTransition = readLocalPersistenceTransition();
    expect(stagedTransition).not.toBeNull();
    if (!stagedTransition) {
      throw new Error('expected staged transition');
    }

    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const didExecute = await executeLocalPersistenceTransition(stagedTransition);
    expect(didExecute).toBe(true);
    expect(dbService.put).toHaveBeenCalledWith('app_meta', {
      key: LOCAL_PERSISTENCE_TRANSITION_COMMIT_META_KEY,
      value: expect.stringContaining(`"transitionId":"${stagedTransition.id}"`),
      updatedAt: expect.any(Number),
    });

    removeItemSpy.mockRestore();
  });

  it('ignores malformed local persistence transition payloads', () => {
    localStorage.setItem(
      LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY,
      JSON.stringify({ version: 2, action: 'clear_orders' })
    );

    expect(readLocalPersistenceTransition()).toBeNull();
  });

  it('persists a portfolio envelope with a committed snapshot version', async () => {
    vi.mocked(dbService.get).mockResolvedValue(undefined);

    const result = await persistLocalPortfolioSnapshot(createPortfolio());

    expect(result).toEqual({
      ok: true,
      commitVersion: 1,
    });
    expect(dbService.put).toHaveBeenNthCalledWith(1, 'app_meta', {
      key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
      value: expect.stringContaining('"status":"pending"'),
      updatedAt: expect.any(Number),
    });
    expect(dbService.put).toHaveBeenNthCalledWith(2, 'app_meta', {
      key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
      value: expect.stringContaining('"status":"committed"'),
      updatedAt: expect.any(Number),
    });
  });

  it('rejects a stale local portfolio envelope when commit metadata points to a newer snapshot', async () => {
    const nextPortfolio = createPortfolio();
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        version: 1,
        commitVersion: 1,
        portfolio: nextPortfolio,
      })
    );
    vi.mocked(dbService.get).mockResolvedValue({
      key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
      value: JSON.stringify({
        version: 1,
        latestCommitVersion: 2,
        status: 'pending',
        updatedAt: Date.now(),
      }),
      updatedAt: Date.now(),
    });

    const result = await validatePersistedPortfolioCommitState();

    expect(result).toEqual({
      valid: false,
      latestCommitVersion: 2,
      envelopeCommitVersion: 1,
    });
  });

  it('commits a pending snapshot metadata record when local storage already has the matching version', async () => {
    const nextPortfolio = createPortfolio();
    localStorage.setItem(
      'zerohue_portfolio',
      JSON.stringify({
        version: 1,
        commitVersion: 3,
        portfolio: nextPortfolio,
      })
    );
    vi.mocked(dbService.get).mockResolvedValue({
      key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
      value: JSON.stringify({
        version: 1,
        latestCommitVersion: 3,
        status: 'pending',
        updatedAt: Date.now(),
      }),
      updatedAt: Date.now(),
    });

    const result = await validatePersistedPortfolioCommitState();

    expect(result).toEqual({
      valid: true,
      latestCommitVersion: 3,
      envelopeCommitVersion: 3,
    });
    expect(dbService.put).toHaveBeenCalledWith('app_meta', {
      key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
      value: expect.stringContaining('"status":"committed"'),
      updatedAt: expect.any(Number),
    });
  });
});
