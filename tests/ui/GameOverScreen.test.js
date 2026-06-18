import { describe, expect, it } from 'vitest';

import { renderGameOverScreen } from '../../src/ui/GameOverScreen.js';

const PLAYERS = Object.freeze([
  Object.freeze({
    id: 'player-1',
    name: 'Alice',
    totalScore: 42,
    isEliminated: false,
  }),
  Object.freeze({
    id: 'player-2',
    name: 'Bob',
    totalScore: 35,
    isEliminated: true,
  }),
  Object.freeze({
    id: 'player-3',
    name: 'Claire',
    totalScore: 58,
    isEliminated: false,
  }),
]);

function createContainer() {
  const container = document.createElement('div');

  document.body.replaceChildren(container);

  return container;
}

describe('renderGameOverScreen', () => {
  it('affiche le nom du gagnant', () => {
    const container = createContainer();

    renderGameOverScreen(container, PLAYERS, 'player-3', {
      onRestartGame() {},
    });

    expect(container.textContent).toContain('Claire');
  });

  it('liste tous les joueurs avec leur score', () => {
    const container = createContainer();

    renderGameOverScreen(container, PLAYERS, 'player-3', {
      onRestartGame() {},
    });

    for (const player of PLAYERS) {
      expect(container.textContent).toContain(player.name);
      expect(container.textContent).toContain(String(player.totalScore));
    }
  });
});
