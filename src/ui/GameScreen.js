import { CONFIG } from '../config.js';
import { TurnPhase } from '../types.js';
import { renderResultOverlay } from './ResultOverlay.js';
import { renderRollHistory } from './RollHistory.js';
import { renderScoreBar } from './ScoreBar.js';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 360;

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function assertCallbacks(callbacks) {
  if (
    callbacks === null ||
    typeof callbacks !== 'object' ||
    typeof callbacks.onRoll !== 'function' ||
    typeof callbacks.onBank !== 'function'
  ) {
    throw new TypeError('L’écran de jeu exige les callbacks onRoll et onBank.');
  }
}

function getCurrentTurnHistory(gameState) {
  if (!Array.isArray(gameState.rollHistory)) {
    return [];
  }

  return gameState.rollHistory.filter(
    (entry) => entry.turnId === gameState.turnId,
  );
}

function getCurrentPlayer(gameState) {
  return gameState.players[gameState.currentPlayerIndex] ?? null;
}

function setButtonEnabled(button, enabled) {
  button.disabled = enabled !== true;
}

function readInitialMuted(callbacks) {
  if (typeof callbacks.isMuted !== 'function') {
    return false;
  }

  try {
    return callbacks.isMuted() === true;
  } catch {
    return false;
  }
}

function isInteractiveKeyTarget(target) {
  return (
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function renderGameScreen(container, callbacks) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur du jeu doit être un élément DOM.');
  }

  assertCallbacks(callbacks);

  const screen = createElement('section', 'game-screen screen screen-fade-in');
  const header = createElement('header', 'game-header');
  const headerTop = createElement('div', 'game-header-top');
  const title = createElement('h1', 'screen-title');
  const muteButton = createElement('button', 'ui-button ui-button-ghost mute-button');
  const turnSummary = createElement('p', 'turn-summary');
  const scoreRegion = createElement('div', 'score-region');
  const playArea = createElement('div', 'game-play-area');
  const canvasWrap = createElement('div', 'animation-stage');
  const canvas = createElement('canvas', 'animation-canvas');
  const overlayHost = createElement('div', 'overlay-host');
  const controls = createElement('div', 'game-controls');
  const rollButton = createElement('button', 'ui-button ui-button-primary');
  const bankButton = createElement('button', 'ui-button ui-button-secondary');
  const skipButton = createElement('button', 'ui-button ui-button-ghost');
  const historyRegion = createElement('div', 'history-region');
  const scoreBar = renderScoreBar(scoreRegion, [], 0);
  const rollHistory = renderRollHistory(historyRegion, []);
  const resultOverlay = renderResultOverlay(overlayHost);
  let rollEnabled = true;
  let bankEnabled = true;
  let muted = readInitialMuted(callbacks);
  let lastPlayerIndex = null;

  screen.tabIndex = -1;
  title.textContent = CONFIG.TEXTS.ui.gameTitle;

  muteButton.type = 'button';
  muteButton.setAttribute('role', 'switch');
  muteButton.dataset.testid = 'btn-mute';
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.dataset.testid = 'animation-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', CONFIG.TEXTS.ui.animationCanvasLabel);

  rollButton.type = 'button';
  bankButton.type = 'button';
  skipButton.type = 'button';
  bankButton.textContent = CONFIG.TEXTS.ui.bankButton;
  skipButton.textContent = CONFIG.TEXTS.ui.skipButton;
  rollButton.dataset.testid = 'btn-roll';
  bankButton.dataset.testid = 'btn-bank';
  skipButton.dataset.testid = 'btn-skip-animation';

  headerTop.append(title, muteButton);
  header.append(headerTop, turnSummary);
  controls.append(rollButton, bankButton, skipButton);
  canvasWrap.append(canvas, overlayHost);
  playArea.append(canvasWrap, controls);
  screen.append(header, scoreRegion, playArea, historyRegion);
  container.append(screen);

  function canRoll() {
    return rollEnabled === true && rollButton.disabled === false;
  }

  function canBank() {
    return bankEnabled === true && bankButton.disabled === false;
  }

  function handleRoll() {
    if (!canRoll()) {
      return;
    }

    rollButton.disabled = true;
    if (callbacks.onRoll() === false) {
      setRollEnabled(true);
    }
  }

  function handleBank() {
    if (!canBank()) {
      return;
    }

    bankButton.disabled = true;
    if (callbacks.onBank() === false) {
      setBankEnabled(true);
    }
  }

  function handleSkip() {
    if (typeof callbacks.onSkip === 'function') {
      callbacks.onSkip();
    }
  }

  function updateMuteButton() {
    muteButton.textContent = muted
      ? CONFIG.TEXTS.ui.soundOffIcon
      : CONFIG.TEXTS.ui.soundOnIcon;
    muteButton.setAttribute('aria-checked', muted ? 'true' : 'false');
    muteButton.setAttribute(
      'aria-label',
      muted ? CONFIG.TEXTS.ui.unmuteLabel : CONFIG.TEXTS.ui.muteLabel,
    );
    muteButton.title = muted
      ? CONFIG.TEXTS.ui.unmuteLabel
      : CONFIG.TEXTS.ui.muteLabel;
  }

  function handleMuteToggle() {
    // Le contrôleur applique et persiste l'état muet, puis renvoie sa nouvelle
    // valeur. En l'absence de callback, on bascule localement (mode dégradé).
    const next =
      typeof callbacks.onToggleMute === 'function'
        ? callbacks.onToggleMute()
        : !muted;

    muted = next === true;
    updateMuteButton();
  }

  function handleKeyDown(event) {
    if (isInteractiveKeyTarget(event.target)) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      handleRoll();
      return;
    }

    if (event.key === 'b' || event.key === 'B') {
      event.preventDefault();
      handleBank();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      handleSkip();
    }
  }

  function updateRollButtonLabel(gameState) {
    const currentTurnHistory = getCurrentTurnHistory(gameState);

    rollButton.textContent =
      currentTurnHistory.length === 0
        ? CONFIG.TEXTS.ui.rollButton
        : CONFIG.TEXTS.ui.rerollButton;
  }

  function animateTurnChange(gameState) {
    // Relance l'animation de glissement uniquement lorsque le joueur change.
    if (gameState.currentPlayerIndex === lastPlayerIndex) {
      return;
    }

    lastPlayerIndex = gameState.currentPlayerIndex;
    turnSummary.classList.remove('turn-changed');
    // Force un reflow pour pouvoir rejouer l'animation à chaque changement.
    void turnSummary.offsetWidth;
    turnSummary.classList.add('turn-changed');
  }

  function updateTurnSummary(gameState) {
    const currentPlayer = getCurrentPlayer(gameState);
    const playerName = currentPlayer?.name ?? CONFIG.TEXTS.ui.unavailable;
    const turnScore = Number.isFinite(gameState.turn?.turnScore)
      ? gameState.turn.turnScore
      : 0;

    turnSummary.textContent = `${CONFIG.TEXTS.ui.currentTurn} : ${playerName} · ${CONFIG.TEXTS.ui.turnScore} : ${turnScore}`;
    animateTurnChange(gameState);
  }

  function updateHistory(gameState) {
    rollHistory.clear();

    for (const entry of getCurrentTurnHistory(gameState)) {
      rollHistory.addEntry(entry);
    }
  }

  function update(gameState) {
    if (
      gameState === null ||
      typeof gameState !== 'object' ||
      !Array.isArray(gameState.players)
    ) {
      throw new TypeError('Etat de jeu invalide pour l’écran de jeu.');
    }

    scoreBar.update(gameState.players, gameState.currentPlayerIndex);
    updateRollButtonLabel(gameState);
    updateTurnSummary(gameState);
    updateHistory(gameState);

    setRollEnabled(gameState.turn?.phase !== TurnPhase.TURN_OVER);
    setBankEnabled(gameState.turn?.phase === TurnPhase.DECIDING);
  }

  function showResult(result) {
    resultOverlay.show(result);
  }

  function shakePlayer(playerId) {
    scoreBar.shake(playerId);
  }

  function setRollEnabled(enabled) {
    rollEnabled = enabled === true;
    setButtonEnabled(rollButton, rollEnabled);
  }

  function setBankEnabled(enabled) {
    bankEnabled = enabled === true;
    setButtonEnabled(bankButton, bankEnabled);
  }

  function destroy() {
    resultOverlay.hide();
    rollButton.removeEventListener('click', handleRoll);
    bankButton.removeEventListener('click', handleBank);
    skipButton.removeEventListener('click', handleSkip);
    muteButton.removeEventListener('click', handleMuteToggle);
    screen.removeEventListener('keydown', handleKeyDown);
    screen.remove();
  }

  rollButton.addEventListener('click', handleRoll);
  bankButton.addEventListener('click', handleBank);
  skipButton.addEventListener('click', handleSkip);
  muteButton.addEventListener('click', handleMuteToggle);
  screen.addEventListener('keydown', handleKeyDown);
  updateMuteButton();
  setRollEnabled(true);
  setBankEnabled(false);
  screen.focus({ preventScroll: true });

  return {
    update,
    showResult,
    shakePlayer,
    setRollEnabled,
    setBankEnabled,
    getCanvas() {
      return canvas;
    },
    destroy,
  };
}
