import {
  composeSequences,
  createLandSequence,
  createStabilizeSequence,
  createThrowSequence,
} from './animation/sequences.js';
import { createAnimationController } from './animation/controller.js';
import { generatePigSprites, getSpriteKey } from './animation/sprites.js';
import { createSoundManager } from './audio/sounds.js';
import { createVibrationManager } from './audio/vibration.js';
import { CONFIG } from './config.js';
import { dispatch } from './engine/dispatch.js';
import { createGame } from './engine/game.js';
import { ActionType, GamePhase, RollEffect, TurnPhase } from './types.js';
import { createApp } from './ui/app.js';
import { createRNG } from './utils/rng.js';
import { loadState, saveState } from './utils/storage.js';

const THROW_DURATION_MS = 300;
const LAND_DURATION_MS = 400;
const STABILIZE_DURATION_MS = 500;
const DEFAULT_CANVAS_WIDTH = 720;
const DEFAULT_CANVAS_HEIGHT = 360;
const MIN_PIG_SCALE = 0.55;
const MAX_PIG_SCALE = 0.9;
const ALLOWED_ANIMATION_SPEEDS = Object.freeze([0.5, 1, 2]);
const DEFAULT_ANIMATION_SPEED = 1;

const SOUND_BY_EFFECT = Object.freeze({
  [RollEffect.GAIN_POINTS]: 'score',
  [RollEffect.PERTE_TOUR]: 'bust',
  [RollEffect.PERTE_TOTALE]: 'jambon',
  [RollEffect.ELIMINATION]: 'cheval',
});

const CATASTROPHE_EFFECTS = Object.freeze([
  RollEffect.PERTE_TOTALE,
  RollEffect.ELIMINATION,
]);

function assertRootElement(rootElement) {
  if (!(rootElement instanceof Element)) {
    throw new TypeError('La racine du controller doit etre un element DOM.');
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function logControllerError(error) {
  console.error('[GameController]', error);
}

function getLatestRollResult(state) {
  if (!Array.isArray(state?.rollHistory) || state.rollHistory.length === 0) {
    return null;
  }

  return state.rollHistory.at(-1)?.result ?? null;
}

function getPositiveFinite(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getStylePixelSize(canvas, propertyName) {
  const rawValue = canvas.style?.[propertyName];

  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return null;
  }

  const value = Number.parseFloat(rawValue);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getLogicalCanvasSize(canvas) {
  const rect =
    typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : null;

  if (
    rect !== null &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  ) {
    return { width: rect.width, height: rect.height };
  }

  const styledWidth = getStylePixelSize(canvas, 'width');
  const styledHeight = getStylePixelSize(canvas, 'height');

  if (styledWidth !== null && styledHeight !== null) {
    return { width: styledWidth, height: styledHeight };
  }

  return {
    width: getPositiveFinite(canvas.width, DEFAULT_CANVAS_WIDTH),
    height: getPositiveFinite(canvas.height, DEFAULT_CANVAS_HEIGHT),
  };
}

function createPigPose(canvasWidth, canvasHeight, pig, offsetDirection) {
  const horizontalGap = Math.min(160, canvasWidth * 0.24);
  const scale = clamp(
    Math.min(canvasWidth, canvasHeight) / 420,
    MIN_PIG_SCALE,
    MAX_PIG_SCALE,
  );

  return {
    x: canvasWidth / 2 + offsetDirection * (horizontalGap / 2),
    y: canvasHeight * 0.64,
    angle: 0,
    scale,
    spriteKey: getSpriteKey(pig.landing, pig.flankSide),
  };
}

function createFinalPoses(canvas, result) {
  const { width, height } = getLogicalCanvasSize(canvas);

  return {
    canvasWidth: width,
    canvasHeight: height,
    finalPoses: {
      pig1: createPigPose(width, height, result.pig1, -1),
      pig2: createPigPose(width, height, result.pig2, 1),
    },
  };
}

function scaleDuration(durationMs, animationSpeed) {
  return durationMs * animationSpeed;
}

function createRollKeyframes(canvas, result, animationSpeed) {
  const { canvasWidth, canvasHeight, finalPoses } = createFinalPoses(
    canvas,
    result,
  );

  return composeSequences(
    createThrowSequence(
      canvasWidth,
      canvasHeight,
      scaleDuration(THROW_DURATION_MS, animationSpeed),
    ),
    createLandSequence(
      finalPoses,
      scaleDuration(LAND_DURATION_MS, animationSpeed),
    ),
    createStabilizeSequence(
      finalPoses,
      scaleDuration(STABILIZE_DURATION_MS, animationSpeed),
    ),
  );
}

function readNormalizedAnimationSpeed() {
  try {
    const state = loadState(CONFIG.STORAGE_KEY);
    const persistedSpeed = state.settings.animationSpeed;

    if (ALLOWED_ANIMATION_SPEEDS.includes(persistedSpeed)) {
      return persistedSpeed;
    }

    state.settings.animationSpeed = DEFAULT_ANIMATION_SPEED;
    saveState(CONFIG.STORAGE_KEY, state);

    return DEFAULT_ANIMATION_SPEED;
  } catch {
    return DEFAULT_ANIMATION_SPEED;
  }
}

function normalizeAnimationSpeed(value, fallback = DEFAULT_ANIMATION_SPEED) {
  return ALLOWED_ANIMATION_SPEEDS.includes(value) ? value : fallback;
}

function stopNavigatorVibration() {
  if (
    typeof globalThis.navigator !== 'object' ||
    globalThis.navigator === null ||
    typeof globalThis.navigator.vibrate !== 'function'
  ) {
    return;
  }

  try {
    globalThis.navigator.vibrate(0);
  } catch {
    // L'arret haptique est best-effort et ne doit pas interrompre le jeu.
  }
}

function isCatastrophe(result) {
  return CATASTROPHE_EFFECTS.includes(result?.effect);
}

function readSeedFromLocation() {
  try {
    if (
      typeof globalThis.location !== 'object' ||
      globalThis.location === null ||
      typeof globalThis.location.search !== 'string'
    ) {
      return undefined;
    }

    const seed = new URLSearchParams(globalThis.location.search).get('seed');

    // Hypothèse de test E2E : une graine vide est équivalente à l'absence de
    // graine, afin de conserver le comportement aléatoire en production.
    return seed === null || seed.trim() === '' ? undefined : seed;
  } catch {
    return undefined;
  }
}

export function createGameController(rootElement) {
  assertRootElement(rootElement);

  let rng = null;
  let sprites = null;
  let app = null;
  let gameState = null;
  let gameScreen = null;
  let animController = null;
  let soundManager = null;
  let vibrationManager = null;
  let animationSpeed = DEFAULT_ANIMATION_SPEED;
  let isStarted = false;
  let isAnimating = false;

  function destroyAnimationController() {
    if (animController !== null) {
      try {
        animController.destroy();
      } catch (error) {
        logControllerError(error);
      }
    }

    animController = null;
    isAnimating = false;
  }

  function destroySoundManager() {
    if (soundManager !== null) {
      try {
        soundManager.destroy();
      } catch (error) {
        logControllerError(error);
      }
    }

    soundManager = null;
  }

  function destroyVibrationManager() {
    if (vibrationManager !== null) {
      try {
        vibrationManager.destroy();
      } catch (error) {
        logControllerError(error);
      }
    }

    vibrationManager = null;
  }

  function playFeedback(type, vibratePattern = type) {
    try {
      soundManager?.play(type);
    } catch (error) {
      logControllerError(error);
    }

    try {
      vibrationManager?.vibrate(vibratePattern);
    } catch (error) {
      logControllerError(error);
    }
  }

  function stopActiveSound() {
    if (soundManager === null) {
      return;
    }

    try {
      if (typeof soundManager.silence === 'function') {
        soundManager.silence();
      }
    } catch (error) {
      logControllerError(error);
    }
  }

  function setGameControlsEnabled(enabled) {
    if (gameScreen === null) {
      return;
    }

    if (enabled !== true) {
      gameScreen.setRollEnabled(false);
      gameScreen.setBankEnabled(false);
      return;
    }

    gameScreen.setRollEnabled(gameState?.turn?.phase !== TurnPhase.TURN_OVER);
    gameScreen.setBankEnabled(gameState?.turn?.phase === TurnPhase.DECIDING);
  }

  function updateGameScreen() {
    if (gameScreen === null || gameState === null) {
      return;
    }

    gameScreen.update(gameState);
  }

  function showGameOverScreen() {
    if (app === null || gameState === null) {
      return;
    }

    destroyAnimationController();
    app.showGameOver(gameState);
    gameScreen = null;
  }

  function playRollOutcomeFeedback(resultState, rollResult) {
    const feedback = SOUND_BY_EFFECT[rollResult?.effect];

    if (feedback !== undefined) {
      playFeedback(feedback);
    }

    if (resultState.phase === GamePhase.GAME_OVER) {
      playFeedback('victory');
    }
  }

  function applyCatastropheShake(rollResult, rollingPlayerId) {
    if (!isCatastrophe(rollResult) || rollingPlayerId === null) {
      return;
    }

    gameScreen?.shakePlayer(rollingPlayerId);
  }

  function finishRollPresentation(resultState, rollResult = null) {
    isAnimating = false;
    gameState = resultState;
    playRollOutcomeFeedback(resultState, rollResult);

    if (gameState.phase === GamePhase.GAME_OVER) {
      showGameOverScreen();
      return;
    }

    updateGameScreen();
    gameScreen?.showResult(rollResult);
  }

  function ensureAnimationController() {
    if (animController !== null) {
      return animController;
    }

    if (gameScreen === null || typeof gameScreen.getCanvas !== 'function') {
      throw new TypeError('Le canvas du jeu est indisponible.');
    }

    if (sprites === null) {
      throw new TypeError('Les sprites ne sont pas initialises.');
    }

    // L'AnimationController depend du canvas de l'ecran de jeu, donc il est
    // initialise a la premiere animation plutot qu'au menu de demarrage.
    animController = createAnimationController(gameScreen.getCanvas(), sprites);

    return animController;
  }

  function startRollAnimation(resultState, result, rollingPlayerId) {
    applyCatastropheShake(result, rollingPlayerId);

    if (gameScreen === null || typeof gameScreen.getCanvas !== 'function') {
      finishRollPresentation(resultState, result);
      return;
    }

    try {
      const keyframes = createRollKeyframes(
        gameScreen.getCanvas(),
        result,
        animationSpeed,
      );
      const controller = ensureAnimationController();

      isAnimating = true;
      setGameControlsEnabled(false);
      controller.start(keyframes, {
        onComplete() {
          finishRollPresentation(resultState, result);
        },
        onError(error) {
          logControllerError(error);
          finishRollPresentation(resultState, result);
        },
        onFrame() {},
      });
    } catch (error) {
      logControllerError(error);
      finishRollPresentation(resultState, result);
    }
  }

  function handleStartGame(playerNames, selectedAnimationSpeed = null) {
    try {
      if (app === null) {
        return false;
      }

      destroyAnimationController();
      animationSpeed = normalizeAnimationSpeed(
        selectedAnimationSpeed,
        readNormalizedAnimationSpeed(),
      );
      gameState = createGame(playerNames);
      gameScreen = app.showGame(gameState);
      updateGameScreen();

      return true;
    } catch (error) {
      logControllerError(error);
      return false;
    }
  }

  function handleRoll() {
    try {
      if (gameState === null || isAnimating) {
        return false;
      }

      const rollingPlayerId = gameState.players[gameState.currentPlayerIndex]?.id ?? null;
      const result = dispatch(gameState, {
        type: ActionType.ROLL_REQUESTED,
        rng,
      });

      if (result.error !== null || result.state === null) {
        logControllerError(result.error ?? 'Lance ignore.');
        return false;
      }

      const nextState = result.state;
      const rollResult = getLatestRollResult(nextState);

      if (rollResult === null) {
        logControllerError(
          'Invariant invalide: aucun resultat de lance apres ROLL_REQUESTED.',
        );
        return false;
      }

      playFeedback('roll', [50]);
      startRollAnimation(nextState, rollResult, rollingPlayerId);

      return true;
    } catch (error) {
      logControllerError(error);
      setGameControlsEnabled(true);
      return false;
    }
  }

  function handleBank() {
    try {
      if (gameState === null || isAnimating) {
        return false;
      }

      const result = dispatch(gameState, { type: ActionType.BANK_REQUESTED });

      if (result.error !== null || result.state === null) {
        logControllerError(result.error ?? 'Bank ignore.');
        return false;
      }

      gameState = result.state;

      if (gameState.phase === GamePhase.GAME_OVER) {
        playFeedback('victory');
        showGameOverScreen();
        return true;
      }

      updateGameScreen();

      return true;
    } catch (error) {
      logControllerError(error);
      setGameControlsEnabled(true);
      return false;
    }
  }

  function handleSkip() {
    try {
      animController?.skip();
    } catch (error) {
      logControllerError(error);
    }
  }

  function handleToggleMute() {
    if (soundManager === null) {
      return false;
    }

    const nextMuted = !soundManager.isMuted();

    try {
      soundManager.setMuted(nextMuted);
    } catch (error) {
      logControllerError(error);
    }

    const actualMuted = soundManager.isMuted();

    if (actualMuted) {
      stopActiveSound();
      stopNavigatorVibration();
    }

    return actualMuted;
  }

  function isMuted() {
    return soundManager?.isMuted() ?? false;
  }

  function handleRestartGame() {
    try {
      destroyAnimationController();
      gameState = null;
      gameScreen = null;
      app?.showMenu();
    } catch (error) {
      logControllerError(error);
    }
  }

  function start() {
    if (isStarted) {
      return;
    }

    rng = createRNG(readSeedFromLocation());
    sprites = generatePigSprites();
    animationSpeed = DEFAULT_ANIMATION_SPEED;
    soundManager = createSoundManager();
    vibrationManager = createVibrationManager({ isMuted });
    app = createApp(rootElement, {
      onStartGame: handleStartGame,
      onRestartGame: handleRestartGame,
      onRoll: handleRoll,
      onBank: handleBank,
      onSkip: handleSkip,
      onToggleMute: handleToggleMute,
      isMuted,
    });
    app.showMenu();
    isStarted = true;
  }

  function destroy() {
    destroyAnimationController();
    destroyVibrationManager();
    destroySoundManager();

    if (app !== null) {
      try {
        app.destroy();
      } catch (error) {
        logControllerError(error);
      }
    }

    rng = null;
    sprites = null;
    app = null;
    gameState = null;
    gameScreen = null;
    animationSpeed = DEFAULT_ANIMATION_SPEED;
    isStarted = false;
  }

  return { start, destroy };
}
