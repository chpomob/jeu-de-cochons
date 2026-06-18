import { expect, test } from '@playwright/test';

import {
  getActivePlayerIndex,
  getScore,
  rollAndSkipAnimation,
  startTwoPlayerGame,
  waitForRollPresentation,
} from './helpers.js';

test('spam clic Banker ne banke qu une seule fois', async ({ page }) => {
  await startTwoPlayerGame(page, '1');
  await rollAndSkipAnimation(page);

  await expect(page.getByTestId('btn-bank')).toBeEnabled();
  await page.getByTestId('btn-bank').evaluate((button) => {
    for (let index = 0; index < 5; index += 1) {
      button.click();
    }
  });

  await expect(page.getByTestId('score-player-0-points')).toHaveText('10');
  expect(await getScore(page, 1)).toBe(0);
  expect(await getActivePlayerIndex(page)).toBe(1);
});

test('spam clic Relancer ne declenche qu une seule action', async ({ page }) => {
  await startTwoPlayerGame(page, '1');
  await rollAndSkipAnimation(page);

  await expect(page.getByTestId('btn-roll')).toBeEnabled();
  await page.getByTestId('btn-roll').evaluate((button) => {
    for (let index = 0; index < 5; index += 1) {
      button.click();
    }
  });
  await page.getByTestId('btn-skip-animation').click();
  await waitForRollPresentation(page);

  await expect(page.locator('.roll-history-entry')).toHaveCount(2);
});

test('resize la fenetre en pleine partie sans crash', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 960, height: 720 });
  await startTwoPlayerGame(page, '1');
  await rollAndSkipAnimation(page);

  const widthBeforeResize = await page
    .getByTestId('animation-canvas')
    .evaluate((canvas) => canvas.getBoundingClientRect().width);

  await page.setViewportSize({ width: 420, height: 720 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="animation-canvas"]');

    if (!(canvas instanceof HTMLCanvasElement)) {
      return false;
    }

    const rect = canvas.getBoundingClientRect();

    return rect.width > 0 && rect.width <= window.innerWidth;
  });

  const widthAfterResize = await page
    .getByTestId('animation-canvas')
    .evaluate((canvas) => canvas.getBoundingClientRect().width);

  expect(widthAfterResize).toBeLessThan(widthBeforeResize);
  await expect(page.locator('.game-screen')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('double Bank immediat ne double pas le score', async ({ page }) => {
  await startTwoPlayerGame(page, '1');
  await rollAndSkipAnimation(page);

  await expect(page.getByTestId('btn-bank')).toBeEnabled();
  await page.getByTestId('btn-bank').evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByTestId('score-player-0-points')).toHaveText('10');
  expect(await getActivePlayerIndex(page)).toBe(1);
});
