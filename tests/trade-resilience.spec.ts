import { expect, test } from '@playwright/test';
import {
  getCoinPrice,
  getSnapshot,
  gotoTrade,
  seedAcceptedDisclaimer,
  setCoinPrice,
} from './helpers/terminal';

test.describe('ZEROHUE trade resilience', () => {
  test.beforeEach(async ({ page }) => {
    await seedAcceptedDisclaimer(page);
  });

  test('market BUY with TP/SL auto-closes on stop-loss and keeps portfolio accounting consistent', async ({
    page,
  }) => {
    await gotoTrade(page, 'bitcoin');
    await setCoinPrice(page, 'bitcoin', 65_000);
    const entryPrice = await getCoinPrice(page, 'bitcoin');
    const { stopLoss } = await page.evaluate((price) => {
      const store = window.__ZEROHUE_STORE__;
      if (!store) throw new Error('ZEROHUE store not found on window');

      const state = store.getState();
      const amount = 0.01;
      const feeRate = 0.001;
      const total = Number((amount * price).toFixed(2));
      const takeProfit = Number((price * 1.2).toFixed(2));
      const stopLoss = Number((price * 0.8).toFixed(2));
      const effectiveAmount = Number((amount * (1 - feeRate)).toFixed(8));

      state.setOrders([]);
      state.setTransactions([
        {
          id: `e2e-seed-buy-${Date.now()}`,
          type: 'BUY',
          coinId: 'bitcoin',
          coinSymbol: 'BTC',
          amount,
          pricePerCoin: price,
          total,
          fee: Number((total * feeRate).toFixed(2)),
          timestamp: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      state.setPortfolio((previous) => ({
        ...previous,
        balance: Number((50_000 - total).toFixed(2)),
        initialBalance: 50_000,
        holdings: [
          {
            coinId: 'bitcoin',
            amount: effectiveAmount,
            averageCost: Number((price / (1 - feeRate)).toFixed(2)),
            takeProfitPrice: takeProfit,
            stopLossPrice: stopLoss,
            openedAt: Date.now(),
            meetsVolumeCondition: false,
          },
        ],
      }));

      return { stopLoss };
    }, entryPrice);

    const afterBuy = await getSnapshot(page);
    expect(
      afterBuy.holdings.some(
        (holding) =>
          holding.coinId === 'bitcoin' &&
          holding.amount > 0 &&
          typeof holding.takeProfitPrice === 'number' &&
          typeof holding.stopLossPrice === 'number'
      )
    ).toBe(true);

    await setCoinPrice(page, 'bitcoin', stopLoss * 0.9);

    await page.waitForFunction(
      () => {
        const store = window.__ZEROHUE_STORE__;
        if (!store) return false;
        const state = store.getState();
        const hasClosedHolding = !state.portfolio.holdings.some(
          (holding) => holding.coinId === 'bitcoin' && holding.amount > 0
        );
        const hasSellTransaction = state.transactions.some(
          (transaction) => transaction.coinId === 'bitcoin' && transaction.type === 'SELL'
        );
        return hasClosedHolding && hasSellTransaction;
      },
      null,
      { timeout: 30_000 }
    );

    const afterStopLoss = await getSnapshot(page);
    expect(afterStopLoss.balance).toBeGreaterThan(afterBuy.balance);
    expect(
      afterStopLoss.transactions.some(
        (transaction) => transaction.coinId === 'bitcoin' && transaction.type === 'SELL'
      )
    ).toBe(true);
  });

  test('coinbase-routed assets can still execute market BUY flows', async ({ page }) => {
    await gotoTrade(page, 'hyperliquid');
    await setCoinPrice(page, 'hyperliquid', 25);
    await page.getByLabel('Trade amount input').fill('2');
    await page.getByRole('button', { name: /Confirm BUY/i }).click();

    await page.waitForURL('**/portfolio');
    await page.waitForFunction(() => {
      const store = window.__ZEROHUE_STORE__;
      if (!store) return false;
      const state = store.getState();
      return (
        state.portfolio.holdings.some((holding) => holding.coinId === 'hyperliquid') &&
        state.transactions.some((transaction) => transaction.coinId === 'hyperliquid')
      );
    });

    const snapshot = await getSnapshot(page);
    expect(snapshot.holdings.some((holding) => holding.coinId === 'hyperliquid')).toBe(true);
    expect(
      snapshot.transactions.some(
        (transaction) => transaction.coinId === 'hyperliquid' && transaction.type === 'BUY'
      )
    ).toBe(true);
  });

  test('trade view stays usable when the TradingView script is blocked', async ({ page }) => {
    await page.route('https://s3.tradingview.com/**', (route) => route.abort());

    await gotoTrade(page, 'bitcoin');

    const chartTab = page.getByRole('button', { name: /^Chart$/i }).first();
    if (await chartTab.isVisible().catch(() => false)) {
      await chartTab.click();
    }

    await expect(page.getByText(/Chart unavailable/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Retry Chart/i })).toBeVisible();

    const tradeTab = page.getByRole('button', { name: /^Trade$/i }).first();
    if (await tradeTab.isVisible().catch(() => false)) {
      await tradeTab.click();
    }
    await expect(page.getByLabel('Trade amount input')).toBeVisible();
  });
});
