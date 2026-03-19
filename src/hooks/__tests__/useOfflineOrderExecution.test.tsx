import { describe, expect, it } from 'vitest';
import { Coin, Order, Portfolio, Transaction } from '../../types';
import { __offlineExecutionInternals } from '../useOfflineOrderExecution';

describe('useOfflineOrderExecution internals', () => {
  const liveCoins: Coin[] = [
    {
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 100,
      change24h: 0,
      history: [100],
      source: 'BINANCE',
    },
    {
      id: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      price: 50,
      change24h: 0,
      history: [50],
      source: 'BINANCE',
    },
  ];

  it('settles reserved SELL fills without mutating active holdings again', () => {
    const order: Order = {
      id: 'sell-1',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 90,
          openedAt: 100,
          meetsVolumeCondition: false,
          wasFullLotClose: true,
        },
      ],
    };
    const newOrders: Order[] = [order];
    const newTransactions: Transaction[] = [];
    const portfolioUpdates: ((prev: Portfolio) => Portfolio)[] = [];

    __offlineExecutionInternals.processFilledOrder(
      order,
      100,
      200,
      newOrders,
      newTransactions,
      portfolioUpdates,
      liveCoins
    );

    const initialPortfolio: Portfolio = {
      balance: 0,
      initialBalance: 50000,
      holdings: [],
    };
    const nextPortfolio = portfolioUpdates.reduce((acc, fn) => fn(acc), initialPortfolio);

    expect(newOrders[0].status).toBe('FILLED');
    expect(newTransactions).toHaveLength(1);
    expect(newTransactions[0].pricePerCoin).toBe(100);
    expect(nextPortfolio.holdings).toHaveLength(0);
    expect(nextPortfolio.balance).toBeCloseTo(99.9, 8);
  });

  it('keeps active holdings empty when sibling reserved SELL orders remain open', () => {
    const order: Order = {
      id: 'sell-1',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 90,
          openedAt: 100,
          meetsVolumeCondition: false,
          wasFullLotClose: true,
        },
      ],
    };
    const siblingOpenSell: Order = {
      ...order,
      id: 'sell-2',
      amount: 0.5,
      total: 50,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-2',
          coinId: 'bitcoin',
          amount: 0.5,
          averageCost: 92,
          openedAt: 120,
          meetsVolumeCondition: false,
          wasFullLotClose: false,
        },
      ],
    };
    const newOrders: Order[] = [order, siblingOpenSell];
    const newTransactions: Transaction[] = [];
    const portfolioUpdates: ((prev: Portfolio) => Portfolio)[] = [];

    __offlineExecutionInternals.processFilledOrder(
      order,
      100,
      200,
      newOrders,
      newTransactions,
      portfolioUpdates,
      liveCoins
    );

    const initialPortfolio: Portfolio = {
      balance: 0,
      initialBalance: 50000,
      holdings: [],
    };
    const nextPortfolio = portfolioUpdates.reduce((acc, fn) => fn(acc), initialPortfolio);

    expect(nextPortfolio.holdings).toHaveLength(0);
  });

  it('should settle offline limit execution at configured limit price', () => {
    const order: Order = {
      id: 'buy-1',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.resolveOrderExecutionFromCandles(order, 0, [
      { time: 1000, high: 120, low: 80 },
    ]);

    expect(result.executed).toBe(true);
    expect(result.executionPrice).toBe(100);
    expect(result.executionTime).toBe(1000);
  });

  it('should preserve TP/SL and scoring metadata on offline BUY fills', () => {
    const order: Order = {
      id: 'buy-with-risk',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      takeProfitPrice: 120,
      stopLossPrice: 90,
      timestamp: 1,
      status: 'OPEN',
    };
    const newOrders: Order[] = [order];
    const newTransactions: Transaction[] = [];
    const portfolioUpdates: ((prev: Portfolio) => Portfolio)[] = [];

    __offlineExecutionInternals.processFilledOrder(
      order,
      100,
      200,
      newOrders,
      newTransactions,
      portfolioUpdates,
      liveCoins
    );

    const initialPortfolio: Portfolio = {
      balance: 900,
      initialBalance: 1000,
      holdings: [],
      grossProfit: 0,
      grossLoss: 0,
      validTradesCount: 0,
    };
    const nextPortfolio = portfolioUpdates.reduce((acc, fn) => fn(acc), initialPortfolio);

    expect(nextPortfolio.holdings).toHaveLength(1);
    expect(nextPortfolio.holdings[0].takeProfitPrice).toBe(120);
    expect(nextPortfolio.holdings[0].stopLossPrice).toBe(90);
    expect(nextPortfolio.holdings[0].openedAt).toBe(200);
    expect(nextPortfolio.holdings[0].meetsVolumeCondition).toBe(true);
  });

  it('should replay a BUY fill and a later TP/SL trigger within the same offline window', () => {
    const order: Order = {
      id: 'buy-followed-by-tp',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      takeProfitPrice: 110,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order, replayStartTime: 0, source: 'BINANCE' }],
      [],
      [
        { time: 1000, high: 105, low: 95 },
        { time: 2000, high: 120, low: 100 },
      ]
    );

    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      type: 'FILL',
      executionPrice: 100,
      executionTime: 1000,
    });
    expect(result.events[1]).toMatchObject({
      type: 'TRIGGER',
      executionPrice: 110,
      executionTime: 2000,
    });

    const appliedResult = __offlineExecutionInternals.applyReplayEventsToState(
      result.events,
      [order],
      {
        balance: 900,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(appliedResult.filledCount).toBe(1);
    expect(appliedResult.triggeredHoldingCount).toBe(1);
    expect(appliedResult.nextOrders[0].status).toBe('FILLED');
    expect(appliedResult.nextPortfolio.holdings).toEqual([]);
    expect(appliedResult.nextPortfolio.balance).toBeCloseTo(1009.78);
    expect(appliedResult.nextPortfolio.validTradesCount).toBe(0);
    expect(appliedResult.newTransactions).toHaveLength(2);
    expect(appliedResult.newTransactions.map((tx) => tx.type)).toEqual(['BUY', 'SELL']);
  });

  it('marks offline BUY fills as FILLED when applying replay events to state', () => {
    const order: Order = {
      id: 'buy-fill-status',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order,
          executionPrice: 100,
          executionTime: 1000,
        },
      ],
      [order],
      {
        balance: 900,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.filledCount).toBe(1);
    expect(result.nextOrders[0].status).toBe('FILLED');
    expect(result.nextPortfolio.balance).toBe(900);
    expect(result.nextPortfolio.holdings).toHaveLength(1);
    expect(result.newTransactions).toHaveLength(1);
    expect(result.newTransactions[0]).toMatchObject({
      type: 'BUY',
      pricePerCoin: 100,
    });
  });

  it('should not trigger TP/SL in the same candle that fills an offline BUY', () => {
    const order: Order = {
      id: 'buy-and-same-candle-sl',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      stopLossPrice: 90,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order, replayStartTime: 0, source: 'BINANCE' }],
      [],
      [{ time: 1000, high: 110, low: 80 }]
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'FILL',
      executionPrice: 100,
      executionTime: 1000,
    });
  });

  it('emits a cancellation event for invalid reserved SELL orders during replay resolution', () => {
    const order: Order = {
      id: 'invalid-sell',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 120,
      total: 120,
      timestamp: 1,
      status: 'OPEN',
    };

    const replay = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order, replayStartTime: 1234, source: 'BINANCE' }],
      [],
      []
    );

    expect(replay.events).toEqual([
      {
        type: 'CANCEL',
        orderId: 'invalid-sell',
        executionTime: 1234,
      },
    ]);
  });

  it('prefers stop-loss when the same replay candle touches both TP and SL', () => {
    const result = __offlineExecutionInternals.resolveHoldingExecutionFromCandles(
      {
        coinId: 'bitcoin',
        amount: 1,
        averageCost: 100,
        takeProfitPrice: 120,
        stopLossPrice: 90,
      },
      0,
      [{ time: 1000, high: 130, low: 80 }]
    );

    expect(result).toMatchObject({
      executed: true,
      triggerType: 'SL',
      executionPrice: 90,
      executionTime: 1000,
    });
  });

  it('replays TP/SL on lots reserved by an open SELL limit and cancels the order', () => {
    const reservedOrder: Order = {
      id: 'reserved-sell',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 130,
      total: 130,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 100,
          stopLossPrice: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
      ],
    };

    const replay = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order: reservedOrder, replayStartTime: 0, source: 'BINANCE' }],
      [],
      [{ time: 10 * 60 * 1000, high: 120, low: 80 }]
    );

    expect(replay.events).toHaveLength(1);
    expect(replay.events[0]).toMatchObject({
      type: 'ORDER_TRIGGER',
      orderId: 'reserved-sell',
      executionTime: 10 * 60 * 1000,
    });

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      replay.events,
      [reservedOrder],
      {
        balance: 0,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.triggeredHoldingCount).toBe(1);
    expect(result.nextOrders[0].status).toBe('CANCELLED');
    expect(result.nextPortfolio.balance).toBeCloseTo(89.91);
    expect(result.nextPortfolio.validTradesCount).toBe(1);
    expect(result.newTransactions).toHaveLength(1);
    expect(result.newTransactions[0]).toMatchObject({
      type: 'SELL',
      coinId: 'bitcoin',
      pricePerCoin: 90,
    });
  });

  it('prefers the less favorable reserved stop-loss over a same-candle SELL limit fill', () => {
    const reservedOrder: Order = {
      id: 'reserved-sell-conflict',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 120,
      total: 120,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 100,
          stopLossPrice: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
      ],
    };

    const replay = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order: reservedOrder, replayStartTime: 0, source: 'BINANCE' }],
      [],
      [{ time: 10 * 60 * 1000, high: 125, low: 80 }]
    );

    expect(replay.events).toHaveLength(1);
    expect(replay.events[0]).toMatchObject({
      type: 'ORDER_TRIGGER',
      orderId: 'reserved-sell-conflict',
      executionTime: 10 * 60 * 1000,
    });

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      replay.events,
      [reservedOrder],
      {
        balance: 0,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.nextOrders[0].status).toBe('CANCELLED');
    expect(result.newTransactions).toHaveLength(1);
    expect(result.newTransactions[0].pricePerCoin).toBe(90);
    expect(result.nextPortfolio.balance).toBeCloseTo(89.91);
  });

  it('can partially stop reserved lots and fill the remaining SELL limit amount in the same candle', () => {
    const reservedOrder: Order = {
      id: 'reserved-sell-partial-conflict',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 2,
      limitPrice: 120,
      total: 240,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 100,
          stopLossPrice: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
        {
          lotId: 'lot-2',
          coinId: 'bitcoin',
          amount: 1,
          averageCost: 95,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
      ],
    };

    const replay = __offlineExecutionInternals.resolveSymbolReplay(
      [{ order: reservedOrder, replayStartTime: 0, source: 'BINANCE' }],
      [],
      [{ time: 10 * 60 * 1000, high: 125, low: 80 }]
    );

    expect(replay.events).toHaveLength(2);
    expect(replay.events[0]).toMatchObject({
      type: 'ORDER_TRIGGER',
      orderId: 'reserved-sell-partial-conflict',
    });
    expect(replay.events[1]).toMatchObject({
      type: 'FILL',
      executionPrice: 120,
      executionTime: 10 * 60 * 1000,
    });

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      replay.events,
      [reservedOrder],
      {
        balance: 0,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.triggeredHoldingCount).toBe(1);
    expect(result.filledCount).toBe(1);
    expect(result.nextOrders[0].status).toBe('FILLED');
    expect(result.newTransactions.map((tx) => tx.pricePerCoin)).toEqual([90, 120]);
    expect(result.nextPortfolio.balance).toBeCloseTo(209.79);
  });

  it('should apply replay events in global chronological order before mutating state', () => {
    const earlierOrder: Order = {
      id: 'earlier-buy',
      type: 'BUY',
      coinId: 'ethereum',
      coinSymbol: 'ETH',
      amount: 1,
      limitPrice: 50,
      total: 50,
      timestamp: 1,
      status: 'OPEN',
    };
    const laterOrder: Order = {
      id: 'later-buy',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
    };
    const newOrders: Order[] = [laterOrder, earlierOrder];
    const newTransactions: Transaction[] = [];
    const portfolioUpdates: ((prev: Portfolio) => Portfolio)[] = [];

    const result = __offlineExecutionInternals.applyReplayEventsInChronologicalOrder(
      [
        {
          type: 'FILL',
          order: laterOrder,
          executionPrice: 100,
          executionTime: 2000,
        },
        {
          type: 'FILL',
          order: earlierOrder,
          executionPrice: 50,
          executionTime: 1000,
        },
      ],
      newOrders,
      newTransactions,
      portfolioUpdates,
      liveCoins
    );

    expect(result).toMatchObject({
      filledCount: 2,
      triggeredHoldingCount: 0,
    });
    expect(newTransactions.map((tx) => tx.timestamp)).toEqual([1000, 2000]);
  });

  it('should skip replay fills that are already settled in current state', () => {
    const order: Order = {
      id: 'already-filled-buy',
      type: 'BUY',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 1,
      limitPrice: 100,
      total: 100,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order,
          executionPrice: 100,
          executionTime: 1000,
        },
      ],
      [{ ...order, status: 'FILLED', updatedAt: 999 }],
      {
        balance: 900,
        initialBalance: 1000,
        holdings: [
          {
            coinId: 'bitcoin',
            amount: 0.999,
            averageCost: 100.1,
            openedAt: 1000,
            meetsVolumeCondition: true,
          },
        ],
      },
      liveCoins
    );

    expect(result.filledCount).toBe(0);
    expect(result.newTransactions).toHaveLength(0);
    expect(result.nextPortfolio.balance).toBe(900);
  });

  it('should skip replay triggers when the holding is already closed in current state', () => {
    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'TRIGGER',
          holding: {
            coinId: 'bitcoin',
            amount: 1,
            averageCost: 100,
            takeProfitPrice: 110,
            openedAt: 1,
            meetsVolumeCondition: true,
          },
          coinSymbol: 'BTC',
          executionPrice: 110,
          executionTime: 2000,
        },
      ],
      [],
      {
        balance: 1000,
        initialBalance: 1000,
        holdings: [],
      },
      liveCoins
    );

    expect(result.triggeredHoldingCount).toBe(0);
    expect(result.newTransactions).toHaveLength(0);
    expect(result.nextPortfolio.balance).toBe(1000);
  });

  it('does not count a split-lot offline SELL fill while sibling reservations remain open', () => {
    const tailOrder: Order = {
      id: 'sell-tail',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.6,
      limitPrice: 110,
      total: 66,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 0.6,
          averageCost: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: true,
        },
      ],
    };
    const headOrder: Order = {
      id: 'sell-head',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.4,
      limitPrice: 120,
      total: 48,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 0.4,
          averageCost: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: false,
        },
      ],
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order: tailOrder,
          executionPrice: 110,
          executionTime: 10 * 60 * 1000,
        },
      ],
      [tailOrder, headOrder],
      {
        balance: 1000,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.filledCount).toBe(1);
    expect(result.nextPortfolio.validTradesCount).toBe(0);
    expect(result.nextOrders.find((candidate) => candidate.id === 'sell-tail')?.status).toBe(
      'FILLED'
    );
    expect(result.nextOrders.find((candidate) => candidate.id === 'sell-head')?.status).toBe(
      'OPEN'
    );
  });

  it('counts the final split-lot offline SELL fill once no exposure remains', () => {
    const order: Order = {
      id: 'sell-head',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.4,
      limitPrice: 110,
      total: 44,
      timestamp: 1,
      status: 'OPEN',
      lotAllocations: [
        {
          lotId: 'lot-1',
          coinId: 'bitcoin',
          amount: 0.4,
          averageCost: 90,
          openedAt: 1,
          meetsVolumeCondition: true,
          wasFullLotClose: false,
        },
      ],
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order,
          executionPrice: 110,
          executionTime: 10 * 60 * 1000,
        },
      ],
      [order],
      {
        balance: 1000,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.filledCount).toBe(1);
    expect(result.nextPortfolio.validTradesCount).toBe(1);
  });

  it('cancels invalid offline SELL fills without allocations instead of settling them', () => {
    const order: Order = {
      id: 'invalid-sell',
      type: 'SELL',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      amount: 0.4,
      limitPrice: 110,
      total: 44,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order,
          executionPrice: 110,
          executionTime: 10 * 60 * 1000,
        },
      ],
      [order],
      {
        balance: 1000,
        initialBalance: 1000,
        holdings: [],
        validTradesCount: 0,
        grossProfit: 0,
        grossLoss: 0,
      },
      liveCoins
    );

    expect(result.filledCount).toBe(0);
    expect(result.cancelledCount).toBe(1);
    expect(result.newTransactions).toHaveLength(0);
    expect(result.nextPortfolio.balance).toBe(1000);
    expect(result.nextOrders[0]).toMatchObject({
      id: 'invalid-sell',
      status: 'CANCELLED',
      amount: 0,
      total: 0,
      lotAllocations: [],
    });
  });

  it('uses current mark prices for replay 5% threshold checks so replay stays aligned with live execution', () => {
    const order: Order = {
      id: 'eth-replay-buy',
      type: 'BUY',
      coinId: 'ethereum',
      coinSymbol: 'ETH',
      amount: 0.5,
      limitPrice: 100,
      total: 50,
      timestamp: 1,
      status: 'OPEN',
    };

    const result = __offlineExecutionInternals.applyReplayEventsToState(
      [
        {
          type: 'FILL',
          order,
          executionPrice: 100,
          executionTime: 2000,
        },
      ],
      [order],
      {
        balance: 0,
        initialBalance: 1000,
        holdings: [
          {
            id: 'btc-lot',
            coinId: 'bitcoin',
            amount: 1,
            averageCost: 10,
            openedAt: 1,
            meetsVolumeCondition: true,
          },
        ],
        grossProfit: 0,
        grossLoss: 0,
        validTradesCount: 0,
      },
      [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          price: 1000,
          change24h: 0,
          history: [1000],
          source: 'BINANCE',
        },
        {
          id: 'ethereum',
          symbol: 'ETH',
          name: 'Ethereum',
          price: 100,
          change24h: 0,
          history: [100],
          source: 'BINANCE',
        },
      ]
    );

    expect(result.nextPortfolio.holdings).toHaveLength(2);
    const replayedHolding = result.nextPortfolio.holdings.find(
      (holding) => holding.coinId === 'ethereum'
    );
    expect(replayedHolding?.meetsVolumeCondition).toBe(false);
  });
});
