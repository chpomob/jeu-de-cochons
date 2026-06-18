import { describe, expect, it } from 'vitest';

import { CONFIG } from '../../src/config.js';
import { loadState, saveState } from '../../src/utils/storage.js';

function createStorageState(highScores) {
  return {
    version: CONFIG.STORAGE_SCHEMA_VERSION,
    highScores,
    settings: {
      muted: false,
      animationSpeed: 1,
    },
  };
}

describe('stockage local', () => {
  it('borne les meilleurs scores normalises', () => {
    const highScores = Array.from(
      { length: CONFIG.HIGH_SCORE_MAX_ENTRIES + 3 },
      (_, index) => ({
        playerName: `Player ${index}`,
        score: index,
      }),
    );

    expect(saveState('scores', createStorageState(highScores))).toBe(true);

    const persistedState = JSON.parse(localStorage.getItem('scores'));

    expect(persistedState.highScores).toHaveLength(
      CONFIG.HIGH_SCORE_MAX_ENTRIES,
    );
  });

  it('charge un etat borne depuis un stockage modifie', () => {
    const highScores = Array.from(
      { length: CONFIG.HIGH_SCORE_MAX_ENTRIES + 2 },
      (_, index) => ({
        playerName: `Player ${index}`,
        score: index,
      }),
    );

    localStorage.setItem(
      'scores',
      JSON.stringify(createStorageState(highScores)),
    );

    expect(loadState('scores').highScores).toHaveLength(
      CONFIG.HIGH_SCORE_MAX_ENTRIES,
    );
  });
});
