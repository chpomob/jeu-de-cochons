import { describe, expect, it } from 'vitest';

import { evaluateRoll } from '../../src/engine/evaluate.js';
import { rollTwoPigs } from '../../src/engine/roll.js';
import { CONFIG } from '../../src/config.js';
import { RollResultType, SinglePigLanding } from '../../src/types.js';
import { createRNG } from '../../src/utils/rng.js';

const SAMPLE_SIZE = 1_000_000;
const FREQUENT_THRESHOLD = 0.05;
const FREQUENT_RELATIVE_TOLERANCE = 0.01;
const RARE_RELATIVE_TOLERANCE = 0.03;

function getLandingProbability(entry) {
  const totalWeight = CONFIG.SINGLE_PIG_WEIGHTS.reduce(
    (sum, item) => sum + item.weight,
    0,
  );

  return entry.weight / totalWeight;
}

function addProbability(probabilities, type, probability) {
  probabilities.set(type, probabilities.get(type) + probability);
}

function createBaseProbabilities() {
  const probabilities = new Map(
    Object.values(RollResultType).map((type) => [type, 0]),
  );
  const flankRightProbability = CONFIG.FLANK_SIDE_PROBABILITY;
  const sameFlankProbability =
    flankRightProbability ** 2 + (1 - flankRightProbability) ** 2;
  const oppositeFlankProbability = 1 - sameFlankProbability;

  for (const pig1 of CONFIG.SINGLE_PIG_WEIGHTS) {
    for (const pig2 of CONFIG.SINGLE_PIG_WEIGHTS) {
      const probability =
        getLandingProbability(pig1) * getLandingProbability(pig2);
      const pig1IsFlank = pig1.landing === SinglePigLanding.FLANC;
      const pig2IsFlank = pig2.landing === SinglePigLanding.FLANC;

      if (pig1IsFlank && pig2IsFlank) {
        addProbability(
          probabilities,
          RollResultType.BON_FLANC,
          probability * sameFlankProbability,
        );
        addProbability(
          probabilities,
          RollResultType.COCHON_NUL,
          probability * oppositeFlankProbability,
        );
      } else if (!pig1IsFlank && pig1.landing === pig2.landing) {
        addProbability(probabilities, getDoubleType(pig1.landing), probability);
      } else {
        addProbability(probabilities, RollResultType.SOMME, probability);
      }
    }
  }

  return probabilities;
}

function getDoubleType(landing) {
  if (landing === SinglePigLanding.TROTTEUR) {
    return RollResultType.DOUBLE_TROTTEUR;
  }

  if (landing === SinglePigLanding.TOURNEDOS) {
    return RollResultType.DOUBLE_TOURNEDOS;
  }

  if (landing === SinglePigLanding.GROIN_GROIN) {
    return RollResultType.DOUBLE_GROIN_GROIN;
  }

  return RollResultType.DOUBLE_BAJOUE;
}

function createExpectedProbabilities() {
  const baseProbabilities = createBaseProbabilities();
  const noOverrideProbability =
    (1 - CONFIG.OVERRIDE_JAMBON) * (1 - CONFIG.OVERRIDE_CHEVAL);
  const probabilities = new Map(
    Object.values(RollResultType).map((type) => [type, 0]),
  );

  for (const [type, probability] of baseProbabilities) {
    probabilities.set(type, probability * noOverrideProbability);
  }

  probabilities.set(RollResultType.BON_JAMBON, CONFIG.OVERRIDE_JAMBON);
  probabilities.set(
    RollResultType.COCHON_A_CHEVAL,
    (1 - CONFIG.OVERRIDE_JAMBON) * CONFIG.OVERRIDE_CHEVAL,
  );

  return probabilities;
}

describe('calibration probabiliste', () => {
  it(
    'respecte la distribution configuree sur un million de lancers',
    () => {
      const rng = createRNG(42);
      const counts = new Map(
        Object.values(RollResultType).map((type) => [type, 0]),
      );
      const expectedProbabilities = createExpectedProbabilities();

      for (let index = 0; index < SAMPLE_SIZE; index += 1) {
        const roll = rollTwoPigs(rng);
        const result = evaluateRoll(roll.pig1, roll.pig2, rng);

        counts.set(result.type, counts.get(result.type) + 1);
      }

      let observedTotal = 0;

      for (const [type, expectedProbability] of expectedProbabilities) {
        const observedProbability = counts.get(type) / SAMPLE_SIZE;
        const relativeTolerance =
          expectedProbability >= FREQUENT_THRESHOLD
            ? FREQUENT_RELATIVE_TOLERANCE
            : RARE_RELATIVE_TOLERANCE;
        const absoluteTolerance = expectedProbability * relativeTolerance;

        observedTotal += observedProbability;
        expect(observedProbability).toBeGreaterThanOrEqual(
          expectedProbability - absoluteTolerance,
        );
        expect(observedProbability).toBeLessThanOrEqual(
          expectedProbability + absoluteTolerance,
        );
      }

      expect(observedTotal).toBeCloseTo(1, 10);
    },
    30000,
  );
});
