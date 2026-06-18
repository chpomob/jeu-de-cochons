import { renderGameOverScreen } from './GameOverScreen.js';
import { renderGameScreen } from './GameScreen.js';
import { renderMenuScreen } from './MenuScreen.js';

function clearRoot(rootElement) {
  rootElement.replaceChildren();
}

function assertRootElement(rootElement) {
  if (!(rootElement instanceof Element)) {
    throw new TypeError('La racine de l’application doit être un élément DOM.');
  }
}

function assertCallbacks(callbacks) {
  if (
    callbacks === null ||
    typeof callbacks !== 'object' ||
    typeof callbacks.onStartGame !== 'function' ||
    typeof callbacks.onRestartGame !== 'function'
  ) {
    throw new TypeError(
      'L’application exige les callbacks onStartGame et onRestartGame.',
    );
  }
}

function getSafeGameState(gameState) {
  if (
    gameState !== null &&
    typeof gameState === 'object' &&
    Array.isArray(gameState.players)
  ) {
    return gameState;
  }

  return {
    players: [],
    currentPlayerIndex: 0,
    rollHistory: [],
    turn: null,
    turnId: null,
  };
}

export function createApp(rootElement, callbacks) {
  assertRootElement(rootElement);
  assertCallbacks(callbacks);

  let currentScreen = null;

  function getOptionalCallback(callbackName) {
    // Phase 4 ne câble pas encore l’orchestration complète : ces callbacks
    // seront fournis par la Phase 5 quand l’écran de jeu deviendra interactif.
    return typeof callbacks[callbackName] === 'function'
      ? callbacks[callbackName]
      : () => false;
  }

  function destroyCurrentScreen() {
    if (currentScreen !== null && typeof currentScreen.destroy === 'function') {
      currentScreen.destroy();
    }

    currentScreen = null;
    clearRoot(rootElement);
  }

  function showMenu() {
    destroyCurrentScreen();
    currentScreen = renderMenuScreen(rootElement, {
      onStartGame: callbacks.onStartGame,
    });

    return currentScreen;
  }

  function showGame(gameState) {
    destroyCurrentScreen();
    currentScreen = renderGameScreen(rootElement, {
      onRoll: getOptionalCallback('onRoll'),
      onBank: getOptionalCallback('onBank'),
      onSkip: getOptionalCallback('onSkip'),
      onToggleMute: getOptionalCallback('onToggleMute'),
      isMuted: getOptionalCallback('isMuted'),
    });
    currentScreen.update(getSafeGameState(gameState));

    return currentScreen;
  }

  function showGameOver(gameState) {
    destroyCurrentScreen();
    currentScreen = renderGameOverScreen(
      rootElement,
      Array.isArray(gameState?.players) ? gameState.players : [],
      gameState?.winner ?? null,
      {
        onRestartGame: callbacks.onRestartGame,
      },
    );

    return currentScreen;
  }

  function destroy() {
    destroyCurrentScreen();
  }

  return { showMenu, showGame, showGameOver, destroy };
}
