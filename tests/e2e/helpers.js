import { expect } from '@playwright/test';

const PLAYER_NAMES = Object.freeze(['Alice', 'Bob']);

export async function openMenu(page, seed = '1') {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // localStorage is optional for the game; tests should not fail here.
    }
  });

  await page.goto(`/?seed=${encodeURIComponent(seed)}`);
  await expect(page.locator('.menu-screen')).toBeVisible();
}

export async function startTwoPlayerGame(page, seed = '1') {
  await openMenu(page, seed);
  await page.locator('#animation-speed').selectOption('0.5');

  for (const [index, playerName] of PLAYER_NAMES.entries()) {
    await page.getByTestId(`player-name-input-${index}`).fill(playerName);
  }

  await page.getByTestId('btn-play').click();
  await expect(page.locator('.game-screen')).toBeVisible();
  await expect(page.locator('.screen-title')).toHaveText('Partie en cours');
}

export async function getScore(page, playerIndex) {
  const rawScore = await page
    .getByTestId(`score-player-${playerIndex}-points`)
    .textContent();
  const score = Number.parseInt(rawScore ?? '', 10);

  if (!Number.isFinite(score)) {
    throw new Error(`Score illisible pour le joueur ${playerIndex}.`);
  }

  return score;
}

export async function getActivePlayerIndex(page) {
  return page.locator('.score-player').evaluateAll((players) =>
    players.findIndex((player) => player.getAttribute('aria-current') === 'true'),
  );
}

export async function waitForRollPresentation(page) {
  await page.waitForFunction(() => {
    const gameOver = document.querySelector('.game-over-screen');
    const overlay = document.querySelector('[data-testid="result-overlay"]');

    return (
      gameOver !== null ||
      (overlay instanceof HTMLElement && overlay.hidden === false)
    );
  });
}

export async function rollAndSkipAnimation(page) {
  await expect(page.getByTestId('btn-roll')).toBeEnabled();
  await page.getByTestId('btn-roll').click();
  await page.getByTestId('btn-skip-animation').click();
  await waitForRollPresentation(page);
}

export async function bankOnce(page) {
  const activePlayerIndex = await getActivePlayerIndex(page);

  await expect(page.getByTestId('btn-bank')).toBeEnabled();
  await page.getByTestId('btn-bank').click();
  await page.waitForFunction(
    (previousActivePlayerIndex) => {
      const gameOver = document.querySelector('.game-over-screen');
      const players = [...document.querySelectorAll('.score-player')];
      const activeIndex = players.findIndex(
        (player) => player.getAttribute('aria-current') === 'true',
      );

      return (
        gameOver !== null ||
        (activeIndex !== -1 && activeIndex !== previousActivePlayerIndex)
      );
    },
    activePlayerIndex,
  );
}

export async function playBankingGameToEnd(page, maxTurns = 80) {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (await page.locator('.game-over-screen').isVisible()) {
      return;
    }

    await rollAndSkipAnimation(page);

    if (await page.locator('.game-over-screen').isVisible()) {
      return;
    }

    if (await page.getByTestId('btn-bank').isEnabled()) {
      await bankOnce(page);
    }
  }

  throw new Error(`La partie n'est pas terminee apres ${maxTurns} tours.`);
}
