import { expect, test } from '@playwright/test';

import {
  bankOnce,
  getActivePlayerIndex,
  getScore,
  playBankingGameToEnd,
  rollAndSkipAnimation,
  startTwoPlayerGame,
} from './helpers.js';

test('joue une partie complete a deux joueurs', async ({ page }) => {
  await startTwoPlayerGame(page, '1');

  await rollAndSkipAnimation(page);

  const scoreBeforeBank = await getScore(page, 0);
  const activeBeforeBank = await getActivePlayerIndex(page);

  expect(activeBeforeBank).toBe(0);
  await bankOnce(page);

  await expect(page.getByTestId('score-player-0-points')).not.toHaveText(
    String(scoreBeforeBank),
  );
  expect(await getScore(page, 0)).toBeGreaterThan(scoreBeforeBank);
  expect(await getActivePlayerIndex(page)).toBe(1);

  await playBankingGameToEnd(page);

  await expect(page.locator('.game-over-screen')).toBeVisible();
  await expect(page.locator('.screen-title')).toHaveText('Fin de partie');
  await expect(page.getByTestId('winner-name')).not.toHaveText('');

  await page.getByTestId('btn-replay').click();
  await expect(page.locator('.menu-screen')).toBeVisible();
  await expect(page.locator('.app-title')).toHaveText('Jeu de Cochons');
});
