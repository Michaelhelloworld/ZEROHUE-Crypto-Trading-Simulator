import { expect, Page } from '@playwright/test';

type OrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED';
type TradeType = 'BUY' | 'SELL';
const APP_READY_TIMEOUT_MS = 90_000;

interface StoreCoin {
  id: string;
  price: number;
  history?: number[];
}

interface StoreHolding {
  id?: string;
  coinId: string;
  amount: number;
  averageCost?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openedAt?: number;
  meetsVolumeCondition?: boolean;
}

interface StoreOrder {
  id: string;
  coinId: string;
  coinSymbol?: string;
  amount?: number;
  status: OrderStatus;
  limitPrice: number;
  total?: number;
  timestamp?: number;
  updatedAt?: number;
  type: TradeType;
}

interface StoreTransaction {
  id?: string;
  coinId: string;
  coinSymbol?: string;
  amount?: number;
  pricePerCoin?: number;
  total?: number;
  fee?: number;
  timestamp?: number;
  updatedAt?: number;
  type: TradeType;
}

interface StorePortfolio {
  balance: number;
  initialBalance?: number;
  holdings: StoreHolding[];
}

interface StoreState {
  coins: StoreCoin[];
  portfolio: StorePortfolio;
  orders: StoreOrder[];
  transactions: StoreTransaction[];
  setCoins: (coins: StoreCoin[]) => void;
  setPortfolio: (
    portfolio: StorePortfolio | ((previous: StorePortfolio) => StorePortfolio)
  ) => void;
  setOrders: (orders: StoreOrder[] | ((previous: StoreOrder[]) => StoreOrder[])) => void;
  setTransactions: (
    transactions: StoreTransaction[] | ((previous: StoreTransaction[]) => StoreTransaction[])
  ) => void;
}

interface StoreApi {
  getState: () => StoreState;
}

export interface Snapshot {
  balance: number;
  holdings: StoreHolding[];
  orders: StoreOrder[];
  transactions: StoreTransaction[];
}

declare global {
  interface Window {
    __ZEROHUE_STORE__?: StoreApi;
  }
}

export const seedAcceptedDisclaimer = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('zerohue_disclaimer_accepted', 'true');
  });
};

export const acceptDisclaimerIfPresent = async (page: Page) => {
  const openButton = page.getByRole('button', { name: /Open Simulator/i }).first();
  if (!(await openButton.isVisible().catch(() => false))) {
    return;
  }

  if (await openButton.isDisabled().catch(() => false)) {
    const agreementToggle = page.getByText(/I have read and agree to the terms above\./i).first();
    if (await agreementToggle.isVisible().catch(() => false)) {
      await agreementToggle.click();
    }
  }

  await openButton.click();
};

export const ensureTradePanelVisible = async (page: Page) => {
  const tradeAmountInput = page.getByLabel('Trade amount input');
  if (await tradeAmountInput.isVisible().catch(() => false)) {
    return;
  }

  const tradeTab = page.getByRole('button', { name: /^Trade$/i }).first();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await tradeAmountInput.isVisible().catch(() => false)) {
      return;
    }
    if (await tradeTab.isVisible().catch(() => false)) {
      await tradeTab.scrollIntoViewIfNeeded().catch(() => {});
      await tradeTab.click({ force: true, timeout: 5_000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
  }

  await expect(tradeAmountInput).toBeVisible({ timeout: 5_000 });
};

export const waitForStoreReady = async (page: Page) => {
  await page.waitForFunction(() => Boolean(window.__ZEROHUE_STORE__), null, {
    timeout: APP_READY_TIMEOUT_MS,
  });
};

export const waitForOrdersPersisted = async (page: Page) => {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const store = window.__ZEROHUE_STORE__;
          if (!store) return false;

          const expectedOrders = store.getState().orders.map((order) => ({
            id: order.id,
            status: order.status,
            version: order.updatedAt ?? order.timestamp ?? 0,
          }));

          const persistedOrders = await new Promise<
            Array<{ id: string; status: OrderStatus; updatedAt?: number; timestamp?: number }>
          >((resolve, reject) => {
            const request = indexedDB.open('zerohue_db');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('orders', 'readonly');
              const ordersStore = tx.objectStore('orders');
              const getAllRequest = ordersStore.getAll();

              getAllRequest.onerror = () => {
                db.close();
                reject(getAllRequest.error);
              };

              getAllRequest.onsuccess = () => {
                const result = getAllRequest.result;
                db.close();
                resolve(result);
              };
            };
          });

          return expectedOrders.every((expectedOrder) =>
            persistedOrders.some(
              (persistedOrder) =>
                persistedOrder.id === expectedOrder.id &&
                persistedOrder.status === expectedOrder.status &&
                (persistedOrder.updatedAt ?? persistedOrder.timestamp ?? 0) ===
                  expectedOrder.version
            )
          );
        }),
      {
        timeout: 20_000,
      }
    )
    .toBe(true);
};

export const waitForPortfolioPersisted = async (page: Page) => {
  const hasCommittedPortfolioSnapshot = async () =>
    page.evaluate(async () => {
      const rawPortfolio = localStorage.getItem('zerohue_portfolio');
      if (!rawPortfolio) return false;

      let parsedEnvelope: {
        version?: number;
        commitVersion?: number;
      } | null = null;
      try {
        parsedEnvelope = JSON.parse(rawPortfolio) as {
          version?: number;
          commitVersion?: number;
        };
      } catch {
        return false;
      }

      if (
        !parsedEnvelope ||
        parsedEnvelope.version !== 1 ||
        typeof parsedEnvelope.commitVersion !== 'number' ||
        !Number.isFinite(parsedEnvelope.commitVersion) ||
        parsedEnvelope.commitVersion <= 0
      ) {
        return false;
      }

      const commitMeta = await new Promise<{
        key: string;
        value: string;
        updatedAt: number;
      } | null>((resolve, reject) => {
        const request = indexedDB.open('zerohue_db');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('app_meta', 'readonly');
          const appMetaStore = tx.objectStore('app_meta');
          const getRequest = appMetaStore.get('portfolio_snapshot_commit');

          getRequest.onerror = () => {
            db.close();
            reject(getRequest.error);
          };

          getRequest.onsuccess = () => {
            const result = getRequest.result ?? null;
            db.close();
            resolve(result);
          };
        };
      });

      if (!commitMeta) return false;

      try {
        const parsedCommit = JSON.parse(commitMeta.value) as {
          version?: number;
          latestCommitVersion?: number;
          status?: string;
        };

        return (
          parsedCommit.version === 1 &&
          parsedCommit.status === 'committed' &&
          parsedCommit.latestCommitVersion === parsedEnvelope.commitVersion
        );
      } catch {
        return false;
      }
    });

  await expect.poll(hasCommittedPortfolioSnapshot, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(500);
  await expect.poll(hasCommittedPortfolioSnapshot, { timeout: 5_000 }).toBe(true);
};

export const getCoinPrice = async (page: Page, coinId: string) =>
  page.evaluate((targetCoinId) => {
    const store = window.__ZEROHUE_STORE__;
    if (!store) throw new Error('ZEROHUE store not found on window');
    const coin = store.getState().coins.find((item) => item.id === targetCoinId);
    if (!coin) throw new Error(`Coin not found: ${targetCoinId}`);
    return coin.price;
  }, coinId);

export const setCoinPrice = async (page: Page, coinId: string, nextPrice: number) => {
  await page.evaluate(
    ({ targetCoinId, price }) => {
      const store = window.__ZEROHUE_STORE__;
      if (!store) throw new Error('ZEROHUE store not found on window');
      const state = store.getState();
      state.setCoins(
        state.coins.map((coin) =>
          coin.id === targetCoinId
            ? { ...coin, price, history: [...(coin.history || []), price] }
            : coin
        )
      );
    },
    { targetCoinId: coinId, price: nextPrice }
  );
};

export const gotoTerminal = async (page: Page) => {
  await gotoTerminalRoute(page, '/markets');
};

export const gotoTerminalRoute = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'commit', timeout: APP_READY_TIMEOUT_MS });
  await acceptDisclaimerIfPresent(page);
  await waitForStoreReady(page);
  await expect(page.locator('#main-scroll-container')).toBeVisible({ timeout: 20_000 });
};

export const getSnapshot = async (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const store = window.__ZEROHUE_STORE__;
    if (!store) throw new Error('ZEROHUE store not found on window');
    const state = store.getState();

    return {
      balance: state.portfolio.balance,
      holdings: state.portfolio.holdings.map((holding) => ({
        coinId: holding.coinId,
        amount: holding.amount,
        takeProfitPrice: holding.takeProfitPrice,
        stopLossPrice: holding.stopLossPrice,
      })),
      orders: state.orders.map((order) => ({
        id: order.id,
        coinId: order.coinId,
        status: order.status,
        limitPrice: order.limitPrice,
        type: order.type,
      })),
      transactions: state.transactions.map((transaction) => ({
        coinId: transaction.coinId,
        type: transaction.type,
      })),
    };
  });

export const gotoTrade = async (page: Page, coinId: string) => {
  await page.goto(`/trade/${coinId}`, { waitUntil: 'commit', timeout: APP_READY_TIMEOUT_MS });
  await acceptDisclaimerIfPresent(page);
  await waitForStoreReady(page);
  await ensureTradePanelVisible(page);
  await expect
    .poll(
      () =>
        page.evaluate((targetCoinId) => {
          const store = window.__ZEROHUE_STORE__;
          if (!store) return 0;
          const coin = store.getState().coins.find((item) => item.id === targetCoinId);
          return coin?.price ?? 0;
        }, coinId),
      { timeout: 20_000 }
    )
    .toBeGreaterThan(0);
  await ensureTradePanelVisible(page);
  await expect(page.getByLabel('Trade amount input')).toBeVisible({ timeout: 20_000 });
};

export const submitTradeAndWaitForPortfolio = async (page: Page, tradeType: 'BUY' | 'SELL') => {
  const confirmButton = page.getByRole('button', { name: new RegExp(`Confirm ${tradeType}`, 'i') });
  await expect(confirmButton).toBeVisible({ timeout: 20_000 });
  await expect(confirmButton).toBeEnabled({ timeout: 20_000 });
  await confirmButton.scrollIntoViewIfNeeded().catch(() => {});
  await confirmButton.click({ force: true });
  await expect(page).toHaveURL(/\/portfolio$/, { timeout: 30_000 });
};

export const selectTradeOrderType = async (page: Page, orderType: 'MARKET' | 'LIMIT') => {
  const orderTypeLabel =
    orderType === 'LIMIT'
      ? /Limit order - Execute at specific price/i
      : /Market order - Execute at current price/i;
  const orderTypeButton = page.getByRole('button', { name: orderTypeLabel });
  await expect(orderTypeButton).toBeVisible({ timeout: 20_000 });
  await expect(orderTypeButton).toBeEnabled({ timeout: 20_000 });
  await orderTypeButton.scrollIntoViewIfNeeded().catch(() => {});
  await orderTypeButton.click({ force: true });
  await expect(orderTypeButton).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
};

export const confirmCancelFirstOrder = async (page: Page) => {
  const cancelButton = page.getByRole('button', { name: /Cancel( Order)?/i }).first();
  const confirmCancel = page.getByRole('button', { name: /Yes, Cancel/i }).first();

  await expect(cancelButton).toBeVisible({ timeout: 20_000 });
  await cancelButton.scrollIntoViewIfNeeded().catch(() => {});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await cancelButton.click({ force: true });
    if (await confirmCancel.isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(250);
  }

  await expect(confirmCancel).toBeVisible({ timeout: 5_000 });
  await confirmCancel.click({ force: true });
};
