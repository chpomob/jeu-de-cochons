import { CONFIG } from '../config.js';
import { RollEffect, RollResultType } from '../types.js';

const AUTO_HIDE_DELAY_MS = 2000;

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function getPointText(result) {
  const points = Number.isFinite(result.points) ? result.points : 0;
  const suffix =
    Math.abs(points) === 1
      ? CONFIG.TEXTS.ui.pointSuffix
      : CONFIG.TEXTS.ui.pointsSuffix;

  if (result.effect === RollEffect.GAIN_POINTS) {
    return `${CONFIG.TEXTS.ui.gainPrefix}${points} ${suffix}`;
  }

  if (result.effect === RollEffect.PERTE_TOUR) {
    return `${CONFIG.TEXTS.ui.lossPrefix}${CONFIG.TEXTS.ui.turnScore}`;
  }

  if (result.effect === RollEffect.PERTE_TOTALE) {
    return `${CONFIG.TEXTS.ui.lossPrefix}${CONFIG.TEXTS.ui.totalScore}`;
  }

  return CONFIG.TEXTS.ui.eliminated;
}

function getEffectClass(effect) {
  if (effect === RollEffect.GAIN_POINTS) {
    return 'result-gain';
  }

  if (effect === RollEffect.ELIMINATION) {
    return 'result-elimination';
  }

  return 'result-loss';
}

function isCatastrophe(result) {
  return (
    result.type === RollResultType.BON_JAMBON ||
    result.type === RollResultType.COCHON_A_CHEVAL ||
    result.effect === RollEffect.PERTE_TOTALE ||
    result.effect === RollEffect.ELIMINATION
  );
}

export function renderResultOverlay(container) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur du résultat doit être un élément DOM.');
  }

  const overlay = createElement('div', 'result-overlay');
  const panel = createElement('div', 'result-overlay-panel');
  const name = createElement('p', 'result-name');
  const points = createElement('p', 'result-points');
  const effect = createElement('p', 'result-effect');
  let hideTimer = null;

  overlay.hidden = true;
  overlay.dataset.testid = 'result-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'assertive');
  panel.append(name, points, effect);
  overlay.append(panel);
  container.append(overlay);

  function clearHideTimer() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hide() {
    clearHideTimer();
    overlay.hidden = true;
    overlay.classList.remove(
      'visible',
      'result-gain',
      'result-loss',
      'result-elimination',
      'result-catastrophe',
    );
  }

  function show(result) {
    if (result === null || typeof result !== 'object') {
      throw new TypeError('Le résultat du lancé doit être un objet.');
    }

    clearHideTimer();
    overlay.hidden = false;
    overlay.classList.remove(
      'result-gain',
      'result-loss',
      'result-elimination',
      'result-catastrophe',
    );
    overlay.classList.add('visible', getEffectClass(result.effect));
    overlay.classList.toggle('result-catastrophe', isCatastrophe(result));

    name.textContent =
      CONFIG.TEXTS.rollResultNames[result.type] ?? CONFIG.TEXTS.ui.unavailable;
    points.textContent = getPointText(result);
    effect.textContent =
      CONFIG.TEXTS.rollEffectMessages[result.effect] ??
      CONFIG.TEXTS.ui.unavailable;

    hideTimer = window.setTimeout(hide, AUTO_HIDE_DELAY_MS);
  }

  return { show, hide };
}
