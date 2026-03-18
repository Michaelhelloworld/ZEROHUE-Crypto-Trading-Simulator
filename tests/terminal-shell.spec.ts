import { expect, test } from '@playwright/test';
import { gotoTerminal, seedAcceptedDisclaimer } from './helpers/terminal';

test.describe('ZEROHUE terminal shell', () => {
  test.beforeEach(async ({ page }) => {
    await seedAcceptedDisclaimer(page);
  });

  test('loads the terminal and shows the main scroll container', async ({ page }) => {
    await gotoTerminal(page);

    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#main-scroll-container')).toBeVisible();
  });
});
