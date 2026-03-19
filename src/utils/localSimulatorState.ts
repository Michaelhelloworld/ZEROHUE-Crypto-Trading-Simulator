import {
  LAST_ONLINE_AT_BINANCE_KEY,
  LAST_ONLINE_AT_COINBASE_KEY,
  LAST_ONLINE_AT_KEY,
} from '../constants/storage';
import { Portfolio } from '../types';
import { safeStorage } from './safeStorage';

export const PORTFOLIO_STORAGE_KEY = 'zerohue_portfolio';
export const ORDERS_STORAGE_KEY = 'zerohue_orders';
export const TRANSACTIONS_STORAGE_KEY = 'zerohue_transactions';

export const clearLegacyOrderStorage = () => {
  return safeStorage.removeItem(ORDERS_STORAGE_KEY);
};

export const clearLegacyTransactionStorage = () => {
  return safeStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
};

export const clearLocalPortfolioStorage = () => {
  return safeStorage.removeItem(PORTFOLIO_STORAGE_KEY);
};

export const writeLocalPortfolioStorage = (portfolio: Portfolio) => {
  return safeStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
};

export const clearLocalSimulatorStorage = () => {
  let didClearCriticalState = true;

  didClearCriticalState = clearLocalPortfolioStorage() && didClearCriticalState;
  didClearCriticalState = safeStorage.removeItem(ORDERS_STORAGE_KEY) && didClearCriticalState;
  didClearCriticalState = safeStorage.removeItem(TRANSACTIONS_STORAGE_KEY) && didClearCriticalState;

  safeStorage.removeItem(LAST_ONLINE_AT_KEY);
  safeStorage.removeItem(LAST_ONLINE_AT_BINANCE_KEY);
  safeStorage.removeItem(LAST_ONLINE_AT_COINBASE_KEY);

  return didClearCriticalState;
};
