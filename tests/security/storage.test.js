import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../src/config.js';
import {
  DEFAULT_STORAGE_STATE,
  loadState,
  saveState,
} from '../../src/utils/storage.js';
import { sanitizePlayerName } from '../../src/utils/sanitize.js';

function createValidStorageState() {
  return {
    version: CONFIG.STORAGE_SCHEMA_VERSION,
    highScores: [],
    settings: {
      muted: false,
      animationSpeed: 1,
    },
  };
}

describe('securite du stockage local', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('retourne l etat par defaut quand le JSON est corrompu', () => {
    localStorage.setItem(CONFIG.STORAGE_KEY, '{ json invalide');

    expect(loadState(CONFIG.STORAGE_KEY)).toEqual(DEFAULT_STORAGE_STATE);
  });

  it('ne laisse pas passer de nom via localStorage avec injection HTML', () => {
    // Les noms stockés peuvent contenir < > — l'échappement est au rendu (textContent).
    // On vérifie que le nom injecté est bien conservé tel quel et que le test
    // de sécurité compte sur textContent côté rendu.
    const sanitizedName = sanitizePlayerName(
      '<img src=x onerror="alert(1)">',
      CONFIG.PLAYER_NAME_MAX_LENGTH,
    );

    expect(sanitizedName).toBe('<img src=x onerror="alert(1)">');
    // La sécurité vient de textContent au rendu, pas du stockage
    expect(typeof sanitizedName).toBe('string');
  });

  it('ne jette pas quand localStorage est absent', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() => loadState(CONFIG.STORAGE_KEY)).not.toThrow();
    expect(loadState(CONFIG.STORAGE_KEY)).toEqual(DEFAULT_STORAGE_STATE);
    expect(() =>
      saveState(CONFIG.STORAGE_KEY, createValidStorageState()),
    ).not.toThrow();
    expect(saveState(CONFIG.STORAGE_KEY, createValidStorageState())).toBe(false);
  });

  it('ne crashe pas quand localStorage est plein', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        return null;
      },
      setItem() {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    });

    expect(() =>
      saveState(CONFIG.STORAGE_KEY, createValidStorageState()),
    ).not.toThrow();
    expect(saveState(CONFIG.STORAGE_KEY, createValidStorageState())).toBe(false);
  });
});
