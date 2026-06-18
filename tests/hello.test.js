import { describe, expect, it } from 'vitest';

import { CONFIG } from '../src/config.js';
import {
  ActionType,
  FlankSide,
  GamePhase,
  RollEffect,
  RollResultType,
  SinglePigLanding,
  TurnPhase,
} from '../src/types.js';

const ENUMS = [
  ActionType,
  FlankSide,
  GamePhase,
  RollEffect,
  RollResultType,
  SinglePigLanding,
  TurnPhase,
];

describe('configuration métier', () => {
  it('définit une distribution complète pour un cochon seul', () => {
    const totalWeight = CONFIG.SINGLE_PIG_WEIGHTS.reduce(
      (sum, landing) => sum + landing.weight,
      0,
    );

    expect(totalWeight).toBe(100);
  });

  it('référence uniquement des positions déclarées dans SinglePigLanding', () => {
    const declaredLandings = new Set(Object.values(SinglePigLanding));

    expect(
      CONFIG.SINGLE_PIG_WEIGHTS.every(({ landing }) =>
        declaredLandings.has(landing),
      ),
    ).toBe(true);
  });
});

describe('types publics', () => {
  it('garde des valeurs uniques dans chaque enum', () => {
    for (const enumObject of ENUMS) {
      const values = Object.values(enumObject);

      expect(new Set(values).size).toBe(values.length);
    }
  });
});
