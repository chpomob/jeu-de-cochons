import { describe, expect, it } from 'vitest';

import { CONFIG } from '../../src/config.js';
import { renderMenuScreen } from '../../src/ui/MenuScreen.js';

function createContainer() {
  const container = document.createElement('div');

  document.body.replaceChildren(container);

  return container;
}

describe('renderMenuScreen', () => {
  it('rend le formulaire dans le container', () => {
    const container = createContainer();

    renderMenuScreen(container, { onStartGame() {} });

    expect(container.querySelector('form')).not.toBeNull();
  });

  it('adapte le nombre de champs nom au nombre de joueurs sélectionné', () => {
    const container = createContainer();

    renderMenuScreen(container, { onStartGame() {} });

    const select = container.querySelector('#player-count');

    select.value = '4';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(container.querySelectorAll('input[name^="playerName"]')).toHaveLength(
      4,
    );
  });

  it('affiche le bouton Jouer', () => {
    const container = createContainer();

    renderMenuScreen(container, { onStartGame() {} });

    expect(
      [...container.querySelectorAll('button')].some(
        (button) => button.textContent === CONFIG.TEXTS.ui.playButton,
      ),
    ).toBe(true);
  });
});
