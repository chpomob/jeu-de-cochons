import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGameController } from '../src/controller.js';
import { CONFIG } from '../src/config.js';

function createRoot() {
  const root = document.createElement('div');

  root.id = 'app';
  document.body.replaceChildren(root);

  return root;
}

function fillMenuForm(root, playerNames) {
  const inputs = root.querySelectorAll('input[name^="playerName"]');

  expect(inputs).toHaveLength(playerNames.length);

  playerNames.forEach((name, index) => {
    inputs[index].value = name;
    inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submitMenuForm(root) {
  const form = root.querySelector('form');

  expect(form).not.toBeNull();
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('createGameController', () => {
  let controller = null;

  beforeEach(() => {
    controller = null;
  });

  afterEach(() => {
    controller?.destroy();
    document.body.replaceChildren();
  });

  it('cree un objet avec start et destroy', () => {
    controller = createGameController(createRoot());

    expect(controller).toEqual({
      start: expect.any(Function),
      destroy: expect.any(Function),
    });
  });

  it('affiche le menu apres start', () => {
    const root = createRoot();

    controller = createGameController(root);
    controller.start();

    expect(root.querySelector('form.menu-form')).not.toBeNull();
    expect(root.textContent).toContain(CONFIG.TEXTS.ui.playButton);
  });

  it('ne crashe pas pendant un cycle start destroy', () => {
    const root = createRoot();

    controller = createGameController(root);

    expect(() => {
      controller.start();
      controller.destroy();
    }).not.toThrow();
  });

  it('affiche le jeu apres soumission du formulaire menu', () => {
    const root = createRoot();

    controller = createGameController(root);
    controller.start();

    fillMenuForm(root, ['Alice', 'Bob']);
    submitMenuForm(root);

    expect(root.querySelector('.game-screen')).not.toBeNull();
    expect(root.querySelector('.animation-canvas')).not.toBeNull();
    expect(root.textContent).toContain(CONFIG.TEXTS.ui.gameTitle);
    expect(root.textContent).toContain('Alice');
    expect(root.textContent).toContain('Bob');
  });
});
