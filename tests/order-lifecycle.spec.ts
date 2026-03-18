import { expect, test, Page } from '@playwright/test';
import {
  getCoinPrice,
  getSnapshot,
  gotoTerminal,
  gotoTrade,
  seedAcceptedDisclaimer,
  setCoinPrice,
  waitForOrdersPersisted,
  waitForStoreReady,
} from './helpers/terminal';

const openOrdersPage = async (page: Page) => {
  // Wait for IDB persistence before using a full navigation, otherwise the
  // reload can re-hydrate stale orders while useIDBSync is still debounced.
  await waitForOrdersPersisted(page);
  await page.goto('/orders', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForStoreReady(page);
  await expect(page.getByRole('heading', { name: /Active Orders/i })).toBeVisible({
    timeout: 20_000,
  });
};

test.describe('ZEROHUE order lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await seedAcceptedDisclaimer(page);
  });

  test('limit SELL order can be created and cancelled with holdings restored', async ({ page }) => {
    await gotoTerminal(page);

    await page.evaluate(() => {
      const store = window.__ZEROHUE_STORE__;
      if (!store) throw new Error('ZEROHUE store not found on window');
      const state = store.getState();
      state.setPortfolio({
        ...state.portfolio,
        holdings: [
          {
            id: 'lot-sell-e2e',
            coinId: 'bitcoin',
            amount: 0.05,
            averageCost: 50_000,
            openedAt: Date.now() - 10 * 60 * 1000,
            meetsVolumeCondition: true,
          },
        ],
      });
    });

    const initial = await getSnapshot(page);

    await gotoTrade(page, 'bitcoin');
    await expect
      .poll(async () => getCoinPrice(page, 'bitcoin'), { timeout: 20_000 })
      .toBeGreaterThan(0);
    const livePrice = await getCoinPrice(page, 'bitcoin');
    await page.getByRole('button', { name: /Select Sell order type/i }).click();
    await page.getByRole('button', { name: /Limit order - Execute at specific price/i }).click();
    await page.getByLabel('Limit price input').fill((livePrice * 1.2).toFixed(2));
    await page.getByLabel('Trade amount input').fill('0.02');
    await page.getByRole('button', { name: /Confirm SELL/i }).click();

    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) =>
              order.coinId === 'bitcoin' && order.type === 'SELL' && order.status === 'OPEN'
          )
      );
    });

    const afterPlace = await getSnapshot(page);
    const initialHolding = initial.holdings.find((holding) => holding.coinId === 'bitcoin');
    const afterPlaceHolding = afterPlace.holdings.find((holding) => holding.coinId === 'bitcoin');
    expect(afterPlaceHolding?.amount || 0).toBeLessThan(initialHolding?.amount || 0);

    await openOrdersPage(page);
    const cancelButton = page.getByRole('button', { name: /Cancel( Order)?/i }).first();
    await expect(cancelButton).toBeVisible({ timeout: 20_000 });
    await cancelButton.click({ force: true });
    const confirmCancel = page.getByRole('button', { name: /Yes, Cancel/i }).first();
    await expect(confirmCancel).toBeVisible({ timeout: 20_000 });
    await confirmCancel.click({ force: true });

    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) =>
              order.coinId === 'bitcoin' && order.type === 'SELL' && order.status === 'CANCELLED'
          )
      );
    });

    const afterCancel = await getSnapshot(page);
    const afterCancelHolding = afterCancel.holdings.find((holding) => holding.coinId === 'bitcoin');
    expect(afterCancelHolding?.amount || 0).toBeCloseTo(initialHolding?.amount || 0, 8);
  });

  test('limit BUY order can be created and cancelled with collateral restored', async ({
    page,
  }) => {
    await gotoTerminal(page);

    const initial = await getSnapshot(page);

    await gotoTrade(page, 'bitcoin');
    await page.getByRole('button', { name: /Limit order - Execute at specific price/i }).click();
    await page.getByLabel('Limit price input').fill('1');
    await page.getByLabel('Trade amount input').fill('0.02');
    await page.getByRole('button', { name: /Confirm BUY/i }).click();

    await page.waitForURL('**/portfolio');
    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'OPEN'
          )
      );
    });

    const afterPlace = await getSnapshot(page);
    expect(afterPlace.balance).toBeLessThan(initial.balance);

    await openOrdersPage(page);
    const cancelButton = page.getByRole('button', { name: /Cancel( Order)?/i }).first();
    await expect(cancelButton).toBeVisible({ timeout: 20_000 });
    await cancelButton.click({ force: true });
    const confirmCancel = page.getByRole('button', { name: /Yes, Cancel/i }).first();
    await expect(confirmCancel).toBeVisible({ timeout: 20_000 });
    await confirmCancel.click({ force: true });

    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) =>
              order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'CANCELLED'
          )
      );
    });

    const afterCancel = await getSnapshot(page);
    expect(afterCancel.balance).toBeCloseTo(initial.balance, 2);
  });

  test('open limit orders survive a full page reload', async ({ page }) => {
    await gotoTerminal(page);

    await gotoTrade(page, 'bitcoin');
    await page.getByRole('button', { name: /Limit order - Execute at specific price/i }).click();
    await page.getByLabel('Limit price input').fill('1');
    await page.getByLabel('Trade amount input').fill('0.02');
    await page.getByRole('button', { name: /Confirm BUY/i }).click();

    await page.waitForURL('**/portfolio');
    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'OPEN'
          )
      );
    });

    await waitForOrdersPersisted(page);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForStoreReady(page);

    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      return Boolean(
        store &&
        store
          .getState()
          .orders.some(
            (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'OPEN'
          )
      );
    });

    const snapshot = await getSnapshot(page);
    expect(
      snapshot.orders.some(
        (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'OPEN'
      )
    ).toBe(true);
  });

  test('limit BUY order fills when price reaches trigger level', async ({ page }) => {
    await gotoTrade(page, 'bitcoin');
    await setCoinPrice(page, 'bitcoin', 65_000);
    const livePrice = await getCoinPrice(page, 'bitcoin');
    const limitPrice = Math.max(1, livePrice * 0.6);

    await page.getByRole('button', { name: /Limit order - Execute at specific price/i }).click();
    await page.getByLabel('Limit price input').fill(limitPrice.toFixed(2));
    await page.getByLabel('Trade amount input').fill('0.01');
    await page.getByRole('button', { name: /Confirm BUY/i }).click();

    await page.waitForURL('**/portfolio');
    await page.waitForFunction(
      (targetLimitPrice) => {
        const store = window.__ZEROHUE_STORE__;
        if (!store) return false;
        return store
          .getState()
          .orders.some(
            (order) =>
              order.coinId === 'bitcoin' &&
              order.type === 'BUY' &&
              order.status === 'OPEN' &&
              Math.abs(order.limitPrice - targetLimitPrice) < 0.1
          );
      },
      limitPrice,
      { timeout: 20_000 }
    );

    await setCoinPrice(page, 'bitcoin', limitPrice * 0.95);

    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      if (!store) return false;
      const state = store.getState();
      const hasFilledOrder = state.orders.some(
        (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'FILLED'
      );
      const hasHolding = state.portfolio.holdings.some(
        (holding) => holding.coinId === 'bitcoin' && holding.amount > 0
      );
      return hasFilledOrder && hasHolding;
    });

    const snapshot = await getSnapshot(page);
    expect(
      snapshot.orders.some(
        (order) => order.coinId === 'bitcoin' && order.type === 'BUY' && order.status === 'FILLED'
      )
    ).toBe(true);
    expect(
      snapshot.holdings.some((holding) => holding.coinId === 'bitcoin' && holding.amount > 0)
    ).toBe(true);
    expect(
      snapshot.transactions.some(
        (transaction) => transaction.coinId === 'bitcoin' && transaction.type === 'BUY'
      )
    ).toBe(true);
  });
});
