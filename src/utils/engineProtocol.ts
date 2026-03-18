import { Coin, Order, Portfolio, Transaction } from '../types';

export interface TickPayload {
  requestId: number;
  requestVersion: number;
  coins: Coin[];
  orders: Order[];
  portfolio: Portfolio;
}

export interface EngineInput {
  type: 'TICK';
  payload: TickPayload;
}

export interface EngineNotification {
  type: 'TP' | 'SL';
  coinSymbol: string;
  price: number;
}

export interface TickResultPayload {
  requestId: number;
  requestVersion: number;
  portfolioUpdates: Portfolio | null;
  nextOrders: Order[] | null;
  newTransactions: Transaction[];
  notifications: EngineNotification[];
}

export interface EngineOutput {
  type: 'TICK_RESULT';
  payload: TickResultPayload;
}

export const createTickInput = (payload: TickPayload): EngineInput => ({
  type: 'TICK',
  payload,
});

export const isOutOfOrderTickResult = (
  expectedRequestId: number | null,
  payload: TickResultPayload
) => expectedRequestId === null || payload.requestId !== expectedRequestId;

export const isStaleTickResult = (currentVersion: number, payload: TickResultPayload) =>
  currentVersion !== payload.requestVersion;
