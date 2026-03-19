import { expect, test } from '@playwright/test';
import { gotoTerminal, gotoTerminalRoute, seedAcceptedDisclaimer } from './helpers/terminal';

test.describe('ZEROHUE terminal shell', () => {
  test.beforeEach(async ({ page }) => {
    await seedAcceptedDisclaimer(page);
  });

  test('loads the terminal and shows the main scroll container', async ({ page }) => {
    await gotoTerminal(page);

    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#main-scroll-container')).toBeVisible();
  });

  test('keeps terminal views visible after loading trailing-slash routes', async ({ page }) => {
    const routes = [
      { path: '/markets/', heading: 'Markets' },
      { path: '/portfolio/', heading: 'Your Holdings' },
      { path: '/orders/', heading: 'Active Orders' },
      { path: '/history/', heading: 'Transaction History' },
    ];

    for (const route of routes) {
      await gotoTerminalRoute(page, route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    }
  });
});
