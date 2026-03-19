import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import TerminalShell from '../TerminalShell';
import { dbService } from '../../../services/db';
import { usePersistenceSyncStore } from '../../../store/usePersistenceSyncStore';
import * as localSimulatorStateModule from '../../../utils/localSimulatorState';

const retryHydration = vi.fn();
let mockInitializationStage: 'hydration_error' | 'ready' = 'hydration_error';
let hydrationErrorCode: 'orders_unavailable' | 'transactions_unavailable' = 'orders_unavailable';
let mockTotalEquity = 72345.67;

interface MockStoreState {
  [key: string]: unknown;
  portfolio: {
    balance: number;
    initialBalance: number;
    holdings: Array<{ coinId: string; amount: number; averageCost: number }>;
    peakBalance: number;
    historicalMDD: number;
    grossProfit: number;
    grossLoss: number;
    validTradesCount: number;
  };
  orders: unknown[];
  transactions: unknown[];
  binanceStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  coinbaseStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  isResetModalOpen: boolean;
  setIsResetModalOpen: Mock;
  selectedHoldingForEdit: null;
  setSelectedHoldingForEdit: Mock;
  setPortfolio: Mock;
  setOrders: Mock;
  setTransactions: Mock;
}

let mockStoreState: MockStoreState;

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../services/db', () => ({
  dbService: {
    clear: vi.fn(),
    resetLocalPersistence: vi.fn(),
  },
}));

vi.mock('../../../hooks/useAppInitialization', () => ({
  useAppInitialization: () => ({
    initializationStage: mockInitializationStage,
    hydrationError:
      mockInitializationStage === 'hydration_error'
        ? {
            code: hydrationErrorCode,
            message:
              hydrationErrorCode === 'orders_unavailable'
                ? 'Orders failed to hydrate.'
                : 'Transactions failed to hydrate.',
          }
        : null,
    retryHydration,
    initialReplayError: null,
    retryInitialReplay: vi.fn(),
    skipInitialReplay: vi.fn(),
  }),
}));

vi.mock('../../../hooks/usePortfolioManager', () => ({
  usePortfolioManager: () => ({
    totalEquity: mockTotalEquity,
    totalPnL: 0,
    handleConfirmReset: vi.fn(),
    handleUpdateStrategy: vi.fn(),
    isScoreDataComplete: true,
  }),
}));

vi.mock('../../../utils/localSimulatorState', () => ({
  writeLocalPortfolioStorage: vi.fn((portfolio) => {
    localStorage.setItem('zerohue_portfolio', JSON.stringify(portfolio));
    return true;
  }),
  clearLegacyOrderStorage: vi.fn(() => {
    localStorage.removeItem('zerohue_orders');
    return true;
  }),
  clearLegacyTransactionStorage: vi.fn(() => {
    localStorage.removeItem('zerohue_transactions');
    return true;
  }),
  clearLocalSimulatorStorage: vi.fn(() => {
    localStorage.removeItem('zerohue_portfolio');
    localStorage.removeItem('zerohue_orders');
    localStorage.removeItem('zerohue_transactions');
    return true;
  }),
}));

vi.mock('../../../store/useStore', () => ({
  DEFAULT_PORTFOLIO: {
    balance: 50000,
    initialBalance: 50000,
    holdings: [],
    peakBalance: 50000,
    historicalMDD: 0,
    grossProfit: 0,
    grossLoss: 0,
    validTradesCount: 0,
  },
  useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

vi.mock('../Footer', () => ({ default: () => <div /> }));
vi.mock('../MobileHeader', () => ({ default: () => <div /> }));
vi.mock('../MobileNav', () => ({ default: () => <div /> }));
vi.mock('../PageTransition', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../Sidebar', () => ({ default: () => <div /> }));
vi.mock('../../common/ConnectionStatus', () => ({ default: () => <div /> }));
vi.mock('../../common/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../common/StatCard', () => ({ default: () => <div /> }));
vi.mock('../../modals/EditPositionModal', () => ({ default: () => <div /> }));
vi.mock('../../modals/ResetBalanceModal', () => ({ default: () => <div /> }));
vi.mock('../../views/AnalysisView', () => ({ default: () => <div /> }));
vi.mock('../../views/MarketView', () => ({ default: () => <div /> }));
vi.mock('../../views/OrdersView', () => ({ default: () => <div /> }));
vi.mock('../../views/PortfolioView', () => ({ default: () => <div /> }));
vi.mock('../../views/TradeView', () => ({ default: () => <div /> }));

describe('TerminalShell hydration recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    usePersistenceSyncStore.getState().resetIssues();
    mockInitializationStage = 'hydration_error';
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    hydrationErrorCode = 'orders_unavailable';
    mockTotalEquity = 72345.67;
    mockStoreState = {
      portfolio: {
        balance: 42000,
        initialBalance: 45000,
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 30000 }],
        peakBalance: 60000,
        historicalMDD: 0.2,
        grossProfit: 1200,
        grossLoss: 300,
        validTradesCount: 6,
      },
      orders: [],
      transactions: [],
      binanceStatus: 'connected',
      coinbaseStatus: 'connected',
      isResetModalOpen: false,
      setIsResetModalOpen: vi.fn(),
      selectedHoldingForEdit: null,
      setSelectedHoldingForEdit: vi.fn(),
      setPortfolio: vi.fn((nextPortfolio) => {
        mockStoreState.portfolio = nextPortfolio;
      }),
      setOrders: vi.fn((nextOrders) => {
        mockStoreState.orders = nextOrders;
      }),
      setTransactions: vi.fn((nextTransactions) => {
        mockStoreState.transactions = nextTransactions;
      }),
    };
    vi.mocked(dbService.clear).mockResolvedValue(undefined);
    vi.mocked(dbService.resetLocalPersistence).mockResolvedValue(true);
    vi.mocked(localSimulatorStateModule.writeLocalPortfolioStorage).mockImplementation(
      (portfolio) => {
        localStorage.setItem('zerohue_portfolio', JSON.stringify(portfolio));
        return true;
      }
    );
    vi.mocked(localSimulatorStateModule.clearLegacyOrderStorage).mockImplementation(() => {
      localStorage.removeItem('zerohue_orders');
      return true;
    });
    vi.mocked(localSimulatorStateModule.clearLegacyTransactionStorage).mockImplementation(() => {
      localStorage.removeItem('zerohue_transactions');
      return true;
    });
    vi.mocked(localSimulatorStateModule.clearLocalSimulatorStorage).mockImplementation(() => {
      localStorage.removeItem('zerohue_portfolio');
      localStorage.removeItem('zerohue_orders');
      localStorage.removeItem('zerohue_transactions');
      return true;
    });
    retryHydration.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('clears the local orders cache, rebuilds a clean cash snapshot, and retries hydration', async () => {
    render(
      <MemoryRouter initialEntries={['/markets']}>
        <TerminalShell />
      </MemoryRouter>
    );

    expect(screen.getByText(/rebuilds a clean cash-only portfolio snapshot/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /clear orders cache and rebuild cash snapshot/i })
    );

    await waitFor(() => {
      expect(dbService.clear).toHaveBeenCalledWith('orders');
      expect(retryHydration).toHaveBeenCalledTimes(1);
      expect(mockStoreState.setPortfolio).toHaveBeenCalledWith({
        balance: 72345.67,
        initialBalance: 72345.67,
        holdings: [],
        peakBalance: 72345.67,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      expect(mockStoreState.setOrders).toHaveBeenCalledWith([]);
    });

    expect(JSON.parse(localStorage.getItem('zerohue_portfolio') || 'null')).toEqual({
      balance: 72345.67,
      initialBalance: 72345.67,
      holdings: [],
      peakBalance: 72345.67,
      historicalMDD: 0,
      grossProfit: 0,
      grossLoss: 0,
      validTradesCount: 0,
    });
  });

  it('clears transaction history, resets performance stats, and retries hydration', async () => {
    hydrationErrorCode = 'transactions_unavailable';

    render(
      <MemoryRouter initialEntries={['/history']}>
        <TerminalShell />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/resets realized performance stats on this browser only/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /clear transaction history and reset performance snapshot/i,
      })
    );

    await waitFor(() => {
      expect(dbService.clear).toHaveBeenCalledWith('transactions');
      expect(mockStoreState.setTransactions).toHaveBeenCalledWith([]);
      expect(mockStoreState.setPortfolio).toHaveBeenCalledWith({
        balance: 42000,
        initialBalance: 72345.67,
        holdings: [{ coinId: 'bitcoin', amount: 1, averageCost: 30000 }],
        peakBalance: 72345.67,
        historicalMDD: 0,
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      });
      expect(retryHydration).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces a recovery error instead of retrying when local portfolio persistence cannot be updated', async () => {
    vi.mocked(localSimulatorStateModule.writeLocalPortfolioStorage).mockReturnValueOnce(false);

    render(
      <MemoryRouter initialEntries={['/markets']}>
        <TerminalShell />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole('button', { name: /clear orders cache and rebuild cash snapshot/i })
    );

    await waitFor(() => {
      expect(retryHydration).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/Targeted cache recovery failed/i);
    });
  });

  it('can factory reset local simulator state from the startup error view', async () => {
    render(
      <MemoryRouter initialEntries={['/markets']}>
        <TerminalShell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /factory reset local simulator state/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(dbService.resetLocalPersistence).toHaveBeenCalledTimes(1);
      expect(retryHydration).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a non-blocking persistence banner when IndexedDB syncing is degraded', () => {
    mockInitializationStage = 'ready';
    usePersistenceSyncStore
      .getState()
      .markStoreDegraded(
        'orders',
        5,
        'Local orders persistence is unavailable. Recent changes may not survive a refresh until browser storage recovers.'
      );

    render(
      <MemoryRouter initialEntries={['/markets']}>
        <TerminalShell />
      </MemoryRouter>
    );

    expect(screen.getByText(/Local Persistence Degraded/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Recent changes may not survive a refresh until browser storage recovers/i)
    ).toBeInTheDocument();
  });
});
