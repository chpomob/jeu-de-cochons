import { CONFIG } from '../config.js';

export const DEFAULT_STORAGE_STATE = Object.freeze({
  version: CONFIG.STORAGE_SCHEMA_VERSION,
  highScores: Object.freeze([]),
  settings: Object.freeze({
    muted: false,
    animationSpeed: 1.0,
  }),
});

function cloneDefaultState() {
  return {
    version: DEFAULT_STORAGE_STATE.version,
    highScores: [],
    settings: {
      muted: DEFAULT_STORAGE_STATE.settings.muted,
      animationSpeed: DEFAULT_STORAGE_STATE.settings.animationSpeed,
    },
  };
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function isValidHighScore(score) {
  return (
    isPlainObject(score) &&
    typeof score.playerName === 'string' &&
    score.playerName.length <= CONFIG.PLAYER_NAME_MAX_LENGTH &&
    Number.isFinite(score.score) &&
    score.score >= 0 &&
    (score.date === undefined || typeof score.date === 'string')
  );
}

function normalizeHighScore(score) {
  return {
    playerName: score.playerName.slice(0, CONFIG.PLAYER_NAME_MAX_LENGTH),
    score: score.score,
    ...(score.date === undefined ? {} : { date: score.date }),
  };
}

function normalizeState(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  if (value.version !== CONFIG.STORAGE_SCHEMA_VERSION) {
    return null;
  }

  if (!Array.isArray(value.highScores)) {
    return null;
  }

  if (!value.highScores.every(isValidHighScore)) {
    return null;
  }

  if (!isPlainObject(value.settings)) {
    return null;
  }

  if (typeof value.settings.muted !== 'boolean') {
    return null;
  }

  if (
    !Number.isFinite(value.settings.animationSpeed) ||
    value.settings.animationSpeed <= 0
  ) {
    return null;
  }

  return {
    version: value.version,
    highScores: value.highScores
      .slice(0, CONFIG.HIGH_SCORE_MAX_ENTRIES)
      .map(normalizeHighScore),
    settings: {
      muted: value.settings.muted,
      animationSpeed: value.settings.animationSpeed,
    },
  };
}

function getLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  return globalThis.localStorage;
}

export function loadState(storageKey) {
  try {
    const storage = getLocalStorage();

    if (storage === null) {
      return cloneDefaultState();
    }

    const rawState = storage.getItem(storageKey);

    if (rawState === null) {
      return cloneDefaultState();
    }

    const parsedState = JSON.parse(rawState);
    const normalizedState = normalizeState(parsedState);

    return normalizedState ?? cloneDefaultState();
  } catch {
    return cloneDefaultState();
  }
}

export function saveState(storageKey, state) {
  const normalizedState = normalizeState(state);

  if (normalizedState === null) {
    throw new TypeError('Etat de stockage invalide.');
  }

  try {
    const storage = getLocalStorage();

    if (storage === null) {
      return false;
    }

    storage.setItem(storageKey, JSON.stringify(normalizedState));

    return true;
  } catch {
    return false;
  }
}
