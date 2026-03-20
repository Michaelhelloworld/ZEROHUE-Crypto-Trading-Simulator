import {
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
  LAST_ONLINE_AT_KEY,
} from '../constants/storage';
import { dbService } from '../services/db';
import { Portfolio } from '../types';
import { generateUUID } from './uuid';
import {
  advanceCurrentTabPersistenceEpoch,
  isCurrentTabPersistenceWritable,
} from './persistenceEpoch';
import { safeStorage } from './safeStorage';

export const PORTFOLIO_STORAGE_KEY = 'zerohue_portfolio';
export const ORDERS_STORAGE_KEY = 'zerohue_orders';
export const TRANSACTIONS_STORAGE_KEY = 'zerohue_transactions';
export const LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY = 'zerohue_persistence_transition';
export const LOCAL_PORTFOLIO_COMMIT_META_KEY = 'portfolio_snapshot_commit';
export const LOCAL_PERSISTENCE_TRANSITION_COMMIT_META_KEY = 'persistence_transition_commit';

type LocalPortfolioCommitStatus = 'pending' | 'committed';

interface LocalPortfolioEnvelope {
  version: 1;
  commitVersion: number;
  portfolio: Portfolio;
}

interface LocalPortfolioCommitState {
  version: 1;
  latestCommitVersion: number;
  status: LocalPortfolioCommitStatus;
  updatedAt: number;
}

export type LocalPersistenceTransitionAction =
  | 'account_reset'
  | 'clear_orders'
  | 'clear_transactions'
  | 'factory_reset';

export interface LocalPersistenceTransition {
  version: 1;
  id: string;
  action: LocalPersistenceTransitionAction;
  nextPortfolio: Portfolio;
}

interface LocalPersistenceTransitionCommitState {
  version: 1;
  transitionId: string;
  action: LocalPersistenceTransitionAction;
  completedAt: number;
}

type LocalPersistenceTransitionInput = Omit<LocalPersistenceTransition, 'id'> & {
  id?: string;
};

export const clearLegacyOrderStorage = () => {
  return safeStorage.removeItem(ORDERS_STORAGE_KEY);
};

export const clearLegacyTransactionStorage = () => {
  return safeStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
};

export const clearLocalPortfolioStorage = () => {
  return safeStorage.removeItem(PORTFOLIO_STORAGE_KEY);
};

export const readLocalPortfolioStorage = () => {
  return safeStorage.getItem(PORTFOLIO_STORAGE_KEY);
};

export const restoreLocalPortfolioStorage = (rawPortfolio: string | null) => {
  if (rawPortfolio === null) {
    return clearLocalPortfolioStorage();
  }

  return safeStorage.setItem(PORTFOLIO_STORAGE_KEY, rawPortfolio);
};

const isLocalPortfolioCommitStatus = (value: unknown): value is LocalPortfolioCommitStatus =>
  value === 'pending' || value === 'committed';

const parseLocalPortfolioEnvelope = (rawValue: string | null): LocalPortfolioEnvelope | null => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalPortfolioEnvelope>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.commitVersion !== 'number' ||
      !Number.isFinite(parsed.commitVersion) ||
      parsed.commitVersion <= 0 ||
      !parsed.portfolio ||
      typeof parsed.portfolio !== 'object'
    ) {
      return null;
    }

    return {
      version: 1,
      commitVersion: parsed.commitVersion,
      portfolio: parsed.portfolio as Portfolio,
    };
  } catch {
    return null;
  }
};

const writeLocalPortfolioEnvelope = (envelope: LocalPortfolioEnvelope) =>
  safeStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(envelope));

const isLocalPersistenceTransitionAction = (
  value: unknown
): value is LocalPersistenceTransitionAction =>
  value === 'account_reset' ||
  value === 'clear_orders' ||
  value === 'clear_transactions' ||
  value === 'factory_reset';

export const readLocalPersistenceTransition = (): LocalPersistenceTransition | null => {
  const rawTransition = safeStorage.getItem(LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY);
  if (!rawTransition) return null;

  try {
    const parsed = JSON.parse(rawTransition) as Partial<LocalPersistenceTransition>;
    if (
      parsed?.version !== 1 ||
      !isLocalPersistenceTransitionAction(parsed.action) ||
      !parsed.nextPortfolio ||
      typeof parsed.nextPortfolio !== 'object'
    ) {
      return null;
    }

    return {
      version: 1,
      id:
        typeof parsed.id === 'string' && parsed.id.trim().length > 0
          ? parsed.id
          : `legacy:${parsed.action}`,
      action: parsed.action,
      nextPortfolio: parsed.nextPortfolio as Portfolio,
    };
  } catch {
    return null;
  }
};

const normalizeLocalPersistenceTransition = (
  transition: LocalPersistenceTransitionInput
): LocalPersistenceTransition => ({
  version: 1,
  id:
    typeof transition.id === 'string' && transition.id.trim().length > 0
      ? transition.id
      : generateUUID(),
  action: transition.action,
  nextPortfolio: transition.nextPortfolio,
});

export const stageLocalPersistenceTransition = (transition: LocalPersistenceTransitionInput) => {
  const advancedEpoch = advanceCurrentTabPersistenceEpoch();
  if (!advancedEpoch.ok) {
    return false;
  }

  const normalizedTransition = normalizeLocalPersistenceTransition(transition);
  if (typeof transition === 'object' && transition !== null) {
    transition.id = normalizedTransition.id;
  }
  return safeStorage.setItem(
    LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY,
    JSON.stringify(normalizedTransition)
  );
};

export const clearLocalPersistenceTransition = () => {
  return safeStorage.removeItem(LOCAL_PERSISTENCE_TRANSITION_STORAGE_KEY);
};

export const readPersistedPortfolioEnvelope = () =>
  parseLocalPortfolioEnvelope(safeStorage.getItem(PORTFOLIO_STORAGE_KEY));

export const unwrapPersistedPortfolio = (rawValue: string | null) => {
  const envelope = parseLocalPortfolioEnvelope(rawValue);
  if (envelope) {
    return {
      rawPortfolio: envelope.portfolio,
      commitVersion: envelope.commitVersion,
    };
  }

  if (!rawValue) {
    return {
      rawPortfolio: null,
      commitVersion: null,
    };
  }

  try {
    return {
      rawPortfolio: JSON.parse(rawValue) as unknown,
      commitVersion: null,
    };
  } catch {
    return {
      rawPortfolio: null,
      commitVersion: null,
    };
  }
};

const writeLocalPortfolioCommitState = async (state: LocalPortfolioCommitState) => {
  await dbService.put('app_meta', {
    key: LOCAL_PORTFOLIO_COMMIT_META_KEY,
    value: JSON.stringify(state),
    updatedAt: state.updatedAt,
  });
  return state;
};

export const readLocalPortfolioCommitState =
  async (): Promise<LocalPortfolioCommitState | null> => {
    try {
      const record = await dbService.get('app_meta', LOCAL_PORTFOLIO_COMMIT_META_KEY);
      if (!record) return null;

      const parsed = JSON.parse(record.value) as Partial<LocalPortfolioCommitState>;
      if (
        parsed?.version !== 1 ||
        typeof parsed.latestCommitVersion !== 'number' ||
        !Number.isFinite(parsed.latestCommitVersion) ||
        parsed.latestCommitVersion < 0 ||
        !isLocalPortfolioCommitStatus(parsed.status) ||
        typeof parsed.updatedAt !== 'number' ||
        !Number.isFinite(parsed.updatedAt)
      ) {
        return null;
      }

      return {
        version: 1,
        latestCommitVersion: parsed.latestCommitVersion,
        status: parsed.status,
        updatedAt: parsed.updatedAt,
      };
    } catch {
      return null;
    }
  };

const readLocalPersistenceTransitionCommitState =
  async (): Promise<LocalPersistenceTransitionCommitState | null> => {
    try {
      const record = await dbService.get('app_meta', LOCAL_PERSISTENCE_TRANSITION_COMMIT_META_KEY);
      if (!record) return null;

      const parsed = JSON.parse(record.value) as Partial<LocalPersistenceTransitionCommitState>;
      if (
        parsed?.version !== 1 ||
        typeof parsed.transitionId !== 'string' ||
        parsed.transitionId.trim().length === 0 ||
        !isLocalPersistenceTransitionAction(parsed.action) ||
        typeof parsed.completedAt !== 'number' ||
        !Number.isFinite(parsed.completedAt)
      ) {
        return null;
      }

      return {
        version: 1,
        transitionId: parsed.transitionId,
        action: parsed.action,
        completedAt: parsed.completedAt,
      };
    } catch {
      return null;
    }
  };

const writeLocalPersistenceTransitionCommitState = async (
  state: LocalPersistenceTransitionCommitState
) => {
  await dbService.put('app_meta', {
    key: LOCAL_PERSISTENCE_TRANSITION_COMMIT_META_KEY,
    value: JSON.stringify(state),
    updatedAt: state.completedAt,
  });
  return state;
};

export const wasLocalPersistenceTransitionCommitted = async (
  transition: LocalPersistenceTransition
) => {
  const committedTransition = await readLocalPersistenceTransitionCommitState();
  return committedTransition?.transitionId === transition.id;
};

export const validatePersistedPortfolioCommitState = async () => {
  const commitState = await readLocalPortfolioCommitState();
  if (!commitState) {
    return {
      valid: true,
      latestCommitVersion: null,
      envelopeCommitVersion: readPersistedPortfolioEnvelope()?.commitVersion ?? null,
    } as const;
  }

  const envelope = readPersistedPortfolioEnvelope();
  const envelopeCommitVersion = envelope?.commitVersion ?? null;

  if (envelopeCommitVersion === commitState.latestCommitVersion) {
    if (commitState.status === 'pending') {
      await writeLocalPortfolioCommitState({
        ...commitState,
        status: 'committed',
        updatedAt: Date.now(),
      });
    }

    return {
      valid: true,
      latestCommitVersion: commitState.latestCommitVersion,
      envelopeCommitVersion,
    } as const;
  }

  if (envelopeCommitVersion !== null && envelopeCommitVersion > commitState.latestCommitVersion) {
    await writeLocalPortfolioCommitState({
      version: 1,
      latestCommitVersion: envelopeCommitVersion,
      status: 'committed',
      updatedAt: Date.now(),
    });

    return {
      valid: true,
      latestCommitVersion: envelopeCommitVersion,
      envelopeCommitVersion,
    } as const;
  }

  return {
    valid: false,
    latestCommitVersion: commitState.latestCommitVersion,
    envelopeCommitVersion,
  } as const;
};

let portfolioPersistenceQueue = Promise.resolve<{
  ok: boolean;
  commitVersion: number | null;
}>({
  ok: true,
  commitVersion: null,
});

const persistLocalPortfolioSnapshotInternal = async (portfolio: Portfolio) => {
  if (!isCurrentTabPersistenceWritable()) {
    return {
      ok: false,
      commitVersion: null,
    };
  }

  const commitState = await readLocalPortfolioCommitState();
  const persistedEnvelope = readPersistedPortfolioEnvelope();
  const serializedPortfolio = JSON.stringify(portfolio);

  if (persistedEnvelope) {
    const persistedPortfolioMatches =
      JSON.stringify(persistedEnvelope.portfolio) === serializedPortfolio;

    if (
      persistedPortfolioMatches &&
      commitState?.status === 'committed' &&
      commitState.latestCommitVersion === persistedEnvelope.commitVersion
    ) {
      return {
        ok: true,
        commitVersion: persistedEnvelope.commitVersion,
      };
    }

    if (
      persistedPortfolioMatches &&
      commitState?.status === 'pending' &&
      commitState.latestCommitVersion === persistedEnvelope.commitVersion
    ) {
      await writeLocalPortfolioCommitState({
        ...commitState,
        status: 'committed',
        updatedAt: Date.now(),
      });

      return {
        ok: true,
        commitVersion: persistedEnvelope.commitVersion,
      };
    }
  }

  if (!commitState && persistedEnvelope) {
    await writeLocalPortfolioCommitState({
      version: 1,
      latestCommitVersion: persistedEnvelope.commitVersion,
      status: 'committed',
      updatedAt: Date.now(),
    });

    if (JSON.stringify(persistedEnvelope.portfolio) === serializedPortfolio) {
      return {
        ok: true,
        commitVersion: persistedEnvelope.commitVersion,
      };
    }
  }

  const baselineCommitVersion = Math.max(
    commitState?.latestCommitVersion ?? 0,
    persistedEnvelope?.commitVersion ?? 0
  );
  const nextCommitVersion = baselineCommitVersion + 1;
  const updatedAt = Date.now();

  await writeLocalPortfolioCommitState({
    version: 1,
    latestCommitVersion: nextCommitVersion,
    status: 'pending',
    updatedAt,
  });

  const didPersistPortfolio = writeLocalPortfolioEnvelope({
    version: 1,
    commitVersion: nextCommitVersion,
    portfolio,
  });
  if (!didPersistPortfolio) {
    return {
      ok: false,
      commitVersion: nextCommitVersion,
    };
  }

  await writeLocalPortfolioCommitState({
    version: 1,
    latestCommitVersion: nextCommitVersion,
    status: 'committed',
    updatedAt: Date.now(),
  });

  return {
    ok: true,
    commitVersion: nextCommitVersion,
  };
};

export const persistLocalPortfolioSnapshot = (portfolio: Portfolio) => {
  const nextTask = portfolioPersistenceQueue
    .catch(() => ({
      ok: false,
      commitVersion: null,
    }))
    .then(() => persistLocalPortfolioSnapshotInternal(portfolio));

  portfolioPersistenceQueue = nextTask.catch(() => ({
    ok: false,
    commitVersion: null,
  }));

  return nextTask;
};

export const writeLocalPortfolioStorage = (portfolio: Portfolio) => {
  const nextCommitVersion = (readPersistedPortfolioEnvelope()?.commitVersion ?? 0) + 1;
  return writeLocalPortfolioEnvelope({
    version: 1,
    commitVersion: nextCommitVersion,
    portfolio,
  });
};

export const clearReplayTimestamps = () => {
  safeStorage.removeItem(LAST_ONLINE_AT_KEY);
  safeStorage.removeItem(LAST_ONLINE_AT_BINANCE_KEY);
  safeStorage.removeItem(LAST_ONLINE_AT_COINBASE_KEY);
  return true;
};

export const clearLegacyLocalSimulatorStorage = () => {
  let didClearCriticalState = true;

  didClearCriticalState = clearLegacyOrderStorage() && didClearCriticalState;
  didClearCriticalState = clearLegacyTransactionStorage() && didClearCriticalState;
  clearReplayTimestamps();

  return didClearCriticalState;
};

export const executeLocalPersistenceTransition = async (
  transition: LocalPersistenceTransitionInput
) => {
  const normalizedTransition = normalizeLocalPersistenceTransition(transition);

  if (!isCurrentTabPersistenceWritable()) {
    return false;
  }

  switch (normalizedTransition.action) {
    case 'clear_orders': {
      await dbService.clear('orders');
      if (!clearLegacyOrderStorage()) {
        console.warn('Failed to clear legacy local orders cache during persistence recovery.');
      }
      break;
    }
    case 'clear_transactions': {
      await dbService.clear('transactions');
      if (!clearLegacyTransactionStorage()) {
        console.warn(
          'Failed to clear legacy local transactions cache during persistence recovery.'
        );
      }
      break;
    }
    case 'account_reset': {
      await dbService.clearSimulatorState();
      if (!clearLegacyLocalSimulatorStorage()) {
        console.warn('Failed to clear legacy local simulator keys during account reset.');
      }
      break;
    }
    case 'factory_reset': {
      await dbService.resetLocalPersistence();
      if (!clearLegacyLocalSimulatorStorage()) {
        console.warn('Failed to clear legacy local simulator keys during factory reset.');
      }
      break;
    }
  }

  const didPersistPortfolio = await persistLocalPortfolioSnapshot(
    normalizedTransition.nextPortfolio
  );
  if (!didPersistPortfolio.ok) {
    return false;
  }

  await writeLocalPersistenceTransitionCommitState({
    version: 1,
    transitionId: normalizedTransition.id,
    action: normalizedTransition.action,
    completedAt: Date.now(),
  });

  if (!clearLocalPersistenceTransition()) {
    console.warn('Failed to clear the local persistence transition journal after recovery.');
  }

  return true;
};

export const clearLocalSimulatorStorage = () => {
  let didClearCriticalState = true;

  didClearCriticalState = clearLocalPortfolioStorage() && didClearCriticalState;
  didClearCriticalState = clearLegacyLocalSimulatorStorage() && didClearCriticalState;

  return didClearCriticalState;
};
