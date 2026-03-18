import { create } from 'zustand';
import { Coin, Portfolio, Order, Transaction, Holding } from '../types';
import { INITIAL_COINS } from '../constants/data';

export const DEFAULT_PORTFOLIO: Portfolio = {
  balance: 50000,
  initialBalance: 50000,
  holdings: [],
  peakBalance: 50000,
  historicalMDD: 0,
  grossProfit: 0,
  grossLoss: 0,
  validTradesCount: 0,
};

const didEnginePortfolioChange = (prev: Portfolio, next: Portfolio) =>
  prev.balance !== next.balance ||
  prev.holdings !== next.holdings ||
  prev.grossProfit !== next.grossProfit ||
  prev.grossLoss !== next.grossLoss ||
  prev.validTradesCount !== next.validTradesCount;

export interface AppState {
  // --- Market Slice ---
  coins: Coin[];
  region: 'GLOBAL' | 'US';
  binanceStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  coinbaseStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  engineStateVersion: number;

  setCoins: (coins: Coin[] | ((prev: Coin[]) => Coin[])) => void;
  setRegion: (region: 'GLOBAL' | 'US' | ((prev: 'GLOBAL' | 'US') => 'GLOBAL' | 'US')) => void;
  setBinanceStatus: (
    status:
      | 'connected'
      | 'disconnected'
      | 'error'
      | 'connecting'
      | ((
          prev: 'connected' | 'disconnected' | 'error' | 'connecting'
        ) => 'connected' | 'disconnected' | 'error' | 'connecting')
  ) => void;
  setCoinbaseStatus: (
    status:
      | 'connected'
      | 'disconnected'
      | 'error'
      | 'connecting'
      | ((
          prev: 'connected' | 'disconnected' | 'error' | 'connecting'
        ) => 'connected' | 'disconnected' | 'error' | 'connecting')
  ) => void;

  // --- Portfolio & Transaction Slice ---
  portfolio: Portfolio;
  orders: Order[];
  transactions: Transaction[];

  setPortfolio: (portfolio: Portfolio | ((prev: Portfolio) => Portfolio)) => void;
  setOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void;
  setTransactions: (transactions: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;

  // --- UI Slice ---
  isResetModalOpen: boolean;
  setIsResetModalOpen: (isOpen: boolean) => void;
  selectedHoldingForEdit: { holding: Holding; coin: Coin } | null;
  setSelectedHoldingForEdit: (data: { holding: Holding; coin: Coin } | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // --- Initial Market State ---
  coins: INITIAL_COINS,
  region: 'GLOBAL',
  binanceStatus: 'disconnected',
  coinbaseStatus: 'disconnected',
  engineStateVersion: 0,

  setCoins: (update) =>
    set((state) => ({
      coins: typeof update === 'function' ? update(state.coins) : update,
    })),
  setRegion: (update) =>
    set((state) => ({
      region: typeof update === 'function' ? update(state.region) : update,
    })),
  setBinanceStatus: (update) =>
    set((state) => ({
      binanceStatus: typeof update === 'function' ? update(state.binanceStatus) : update,
    })),
  setCoinbaseStatus: (update) =>
    set((state) => ({
      coinbaseStatus: typeof update === 'function' ? update(state.coinbaseStatus) : update,
    })),

  // --- Initial Portfolio State ---
  portfolio: DEFAULT_PORTFOLIO,
  orders: [],
  transactions: [],

  setPortfolio: (update) =>
    set((state) => {
      const nextPortfolio = typeof update === 'function' ? update(state.portfolio) : update;
      if (nextPortfolio === state.portfolio) return state;

      return {
        portfolio: nextPortfolio,
        engineStateVersion: didEnginePortfolioChange(state.portfolio, nextPortfolio)
          ? state.engineStateVersion + 1
          : state.engineStateVersion,
      };
    }),

  setOrders: (update) =>
    set((state) => {
      const nextOrders = typeof update === 'function' ? update(state.orders) : update;
      if (nextOrders === state.orders) return state;

      return {
        orders: nextOrders,
        engineStateVersion: state.engineStateVersion + 1,
      };
    }),

  setTransactions: (update) =>
    set((state) => ({
      transactions: typeof update === 'function' ? update(state.transactions) : update,
    })),

  // --- Initial UI State ---
  isResetModalOpen: false,
  setIsResetModalOpen: (isOpen) => set({ isResetModalOpen: isOpen }),
  selectedHoldingForEdit: null,
  setSelectedHoldingForEdit: (data) => set({ selectedHoldingForEdit: data }),
}));

declare global {
  interface Window {
    __ZEROHUE_STORE__?: typeof useStore;
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__ZEROHUE_STORE__ = useStore;
}
