import { CONFIG } from '../config.js';
import { RollEffect } from '../types.js';

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function getPointLabel(points) {
  return Math.abs(points) === 1
    ? CONFIG.TEXTS.ui.pointSuffix
    : CONFIG.TEXTS.ui.pointsSuffix;
}

function getFinitePoints(result) {
  return Number.isFinite(result?.points) ? result.points : 0;
}

function getHistoryResult(entry) {
  return entry?.result ?? entry;
}

function getEntryIcon(result) {
  if (result.effect === RollEffect.ELIMINATION) {
    return '!';
  }

  if (
    result.effect === RollEffect.PERTE_TOUR ||
    result.effect === RollEffect.PERTE_TOTALE
  ) {
    return '-';
  }

  return '+';
}

function createEmptyMessage() {
  const emptyMessage = createElement('p', 'roll-history-empty');

  emptyMessage.textContent = CONFIG.TEXTS.ui.noRollHistory;

  return emptyMessage;
}

function createEntryElement(entry) {
  const result = getHistoryResult(entry);
  const item = createElement('li', 'roll-history-entry');
  const icon = createElement('span', 'roll-history-icon');
  const label = createElement('span', 'roll-history-label');
  const points = createElement('span', 'roll-history-points');
  const finitePoints = getFinitePoints(result);
  const resultName =
    CONFIG.TEXTS.rollResultNames[result.type] ?? CONFIG.TEXTS.ui.unavailable;

  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = getEntryIcon(result);
  label.textContent = resultName;
  points.textContent = `${finitePoints} ${getPointLabel(finitePoints)}`;

  item.append(icon, label, points);

  return item;
}

export function renderRollHistory(container, rollHistory) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur de l’historique doit être un élément DOM.');
  }

  const wrapper = createElement('section', 'roll-history');
  const title = createElement('h2', 'panel-title');
  const list = createElement('ol', 'roll-history-list');
  let emptyMessage = createEmptyMessage();

  title.textContent = CONFIG.TEXTS.ui.rollHistoryTitle;
  list.setAttribute('aria-live', 'polite');

  wrapper.append(title, emptyMessage, list);
  container.append(wrapper);

  function syncEmptyState() {
    if (list.children.length === 0 && emptyMessage.parentElement === null) {
      emptyMessage = createEmptyMessage();
      wrapper.insertBefore(emptyMessage, list);
    }

    if (list.children.length > 0) {
      emptyMessage.remove();
    }
  }

  function addEntry(entry) {
    if (entry === null || typeof entry !== 'object') {
      throw new TypeError('Une entrée d’historique doit être un objet.');
    }

    list.append(createEntryElement(entry));
    syncEmptyState();
    list.scrollLeft = list.scrollWidth;
  }

  function clear() {
    list.replaceChildren();
    syncEmptyState();
  }

  for (const entry of Array.isArray(rollHistory) ? rollHistory : []) {
    addEntry(entry);
  }

  syncEmptyState();

  return { addEntry, clear };
}
