import { expect, test } from '@playwright/test';

import {
  bankOnce,
  getActivePlayerIndex,
  getScore,
  openMenu,
  startTwoPlayerGame,
  waitForRollPresentation,
} from './helpers.js';

test('navigue au clavier dans le menu', async ({ page }) => {
  await openMenu(page, '1');

  await expect(page.getByTestId('player-name-input-0')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('player-name-input-1')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('btn-play')).toBeFocused();

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('#player-count')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator('#animation-speed')).toBeFocused();
});

test('lance avec R, passe animation avec Espace, puis banke avec B', async ({
  page,
}) => {
  await startTwoPlayerGame(page, '1');

  await page.keyboard.press('R');
  await expect(page.getByTestId('btn-roll')).toBeDisabled();

  await page.keyboard.press('Space');
  await waitForRollPresentation(page);
  await expect(page.getByTestId('btn-bank')).toBeEnabled();

  const scoreBeforeBank = await getScore(page, 0);

  await page.keyboard.press('B');
  await expect(page.getByTestId('score-player-0-points')).not.toHaveText(
    String(scoreBeforeBank),
  );
  expect(await getActivePlayerIndex(page)).toBe(1);
});

test('ignore les raccourcis quand les actions sont desactivees', async ({
  page,
}) => {
  await startTwoPlayerGame(page, '1');

  await page.keyboard.press('R');
  await expect(page.getByTestId('btn-roll')).toBeDisabled();

  await page.locator('.game-screen').focus();
  await page.keyboard.press('B');
  await page.keyboard.press('R');
  await page.keyboard.press('Space');
  await waitForRollPresentation(page);

  expect(await getScore(page, 0)).toBe(0);
  expect(await getActivePlayerIndex(page)).toBe(0);
  await expect(page.locator('.roll-history-entry')).toHaveCount(1);

  await bankOnce(page);
  expect(await getActivePlayerIndex(page)).toBe(1);
});
