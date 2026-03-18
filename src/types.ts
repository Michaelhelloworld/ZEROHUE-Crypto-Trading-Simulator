/**
 * Represents a cryptocurrency asset with market data.
 */
export interface Coin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number; // Percentage
  history: number[]; // Store last N price points for charts
  source?: 'BINANCE' | 'COINBASE';
  category?: 'L1/L2' | 'DeFi' | 'AI/DePIN' | 'MEME';
}

/**
 * Represents a user's holding of a specific coin.
 */
export interface Holding {
  id?: string;
  coinId: string;
  amount: number;
  averageCost: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  // Scoring requirements
  openedAt?: number;
  meetsVolumeCondition?: boolean;
}

/**
 * Represents a completed trade or system transaction.
 */
export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  coinId: string;
  coinSymbol: string;
  amount: number;
  pricePerCoin: number;
  total: number;
  fee?: number;
  timestamp: number;
  updatedAt?: number;
}

/**
 * Represents an open or closed limit order.
 */
export interface Order {
  id: string;
  type: 'BUY' | 'SELL';
  coinId: string;
  coinSymbol: string;
  amount: number;
  limitPrice: number;
  total: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  lotAllocations?: OrderLotAllocation[];
  timestamp: number;
  status: 'OPEN' | 'FILLED' | 'CANCELLED';
  updatedAt?: number;
}

export interface OrderLotAllocation {
  lotId: string;
  coinId: string;
  amount: number;
  averageCost: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openedAt?: number;
  meetsVolumeCondition?: boolean;
  wasFullLotClose: boolean;
}

/**
 * Main state container for user assets.
 */
export interface Portfolio {
  balance: number; // USD cash available (available for new orders)
  initialBalance: number; // Starting capital for PnL calc
  holdings: Holding[];

  // Lazy evaluation scoring trackers
  peakBalance?: number; // Historical highest total equity (for MDD)
  historicalMDD?: number; // Historical Maximum Drawdown
  grossProfit?: number; // Total accumulated realized profit
  grossLoss?: number; // Total accumulated realized loss
  validTradesCount?: number; // Number of FIFO lots that met the 5% + 5min threshold and were fully closed
}

// EOF
