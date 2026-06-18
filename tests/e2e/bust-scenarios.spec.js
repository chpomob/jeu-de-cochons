import { expect, test } from '@playwright/test';

import {
  bankOnce,
  getActivePlayerIndex,
  rollAndSkipAnimation,
  startTwoPlayerGame,
} from './helpers.js';

test('affiche un gain puis un Cochon nul qui passe le tour', async ({ page }) => {
  await startTwoPlayerGame(page, 'bust-2');

  await rollAndSkipAnimation(page);
  await expect(page.getByTestId('result-overlay')).toHaveClass(/result-gain/);
  await bankOnce(page);

  expect(await getActivePlayerIndex(page)).toBe(1);

  await rollAndSkipAnimation(page);

  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await expect(page.getByTestId('result-overlay')).toContainText('Cochon nul');
  await expect(page.getByTestId('result-overlay')).toHaveClass(/result-loss/);
  expect(await getActivePlayerIndex(page)).toBe(0);
});
