import { describe, expect, it } from 'vitest';

import { computeResult, evaluateRoll } from '../../src/engine/evaluate.js';
import { CONFIG } from '../../src/config.js';
import {
  FlankSide,
  RollEffect,
  RollResultType,
  SinglePigLanding,
} from '../../src/types.js';

const NO_OVERRIDE_RNG = Object.freeze({
  random: () => 1,
});

const DOUBLE_BY_LANDING = Object.freeze({
  [SinglePigLanding.TROTTEUR]: RollResultType.DOUBLE_TROTTEUR,
  [SinglePigLanding.TOURNEDOS]: RollResultType.DOUBLE_TOURNEDOS,
  [SinglePigLanding.GROIN_GROIN]: RollResultType.DOUBLE_GROIN_GROIN,
  [SinglePigLanding.BAJOUE]: RollResultType.DOUBLE_BAJOUE,
});

function getPoints(landing) {
  return CONFIG.SINGLE_PIG_WEIGHTS.find((entry) => entry.landing === landing)
    .points;
}

function getPigVariants(landing) {
  if (landing !== SinglePigLanding.FLANC) {
    return [{ landing, flankSide: null }];
  }

  return [
    { landing, flankSide: FlankSide.DROIT },
    { landing, flankSide: FlankSide.GAUCHE },
  ];
}

function getExpectedType(pig1, pig2) {
  if (
    pig1.landing === SinglePigLanding.FLANC &&
    pig2.landing === SinglePigLanding.FLANC
  ) {
    return pig1.flankSide === pig2.flankSide
      ? RollResultType.BON_FLANC
      : RollResultType.COCHON_NUL;
  }

  if (
    pig1.landing !== SinglePigLanding.FLANC &&
    pig1.landing === pig2.landing
  ) {
    return DOUBLE_BY_LANDING[pig1.landing];
  }

  return RollResultType.SOMME;
}

function getExpectedPoints(type, pig1, pig2) {
  if (type === RollResultType.COCHON_NUL) {
    return 0;
  }

  if (type === RollResultType.BON_FLANC) {
    return 1;
  }

  if (type === RollResultType.DOUBLE_TROTTEUR) {
    return 20;
  }

  if (type === RollResultType.DOUBLE_TOURNEDOS) {
    return 20;
  }

  if (type === RollResultType.DOUBLE_GROIN_GROIN) {
    return 40;
  }

  if (type === RollResultType.DOUBLE_BAJOUE) {
    return 60;
  }

  return getPoints(pig1.landing) + getPoints(pig2.landing);
}

function createOverrideRNG(values) {
  let index = 0;

  return {
    random() {
      const value = values[index] ?? 1;
      index += 1;

      return value;
    },
  };
}

describe('evaluation des lancers', () => {
  it('couvre la table de verite des 5 positions et orientations de flanc', () => {
    for (const landing1 of Object.values(SinglePigLanding)) {
      for (const landing2 of Object.values(SinglePigLanding)) {
        for (const pig1 of getPigVariants(landing1)) {
          for (const pig2 of getPigVariants(landing2)) {
            const expectedType = getExpectedType(pig1, pig2);
            const result = evaluateRoll(pig1, pig2, NO_OVERRIDE_RNG);

            expect(result.type).toBe(expectedType);
            expect(result.points).toBe(
              getExpectedPoints(expectedType, pig1, pig2),
            );
          }
        }
      }
    }
  });

  it('rend Bon Flanc et Cochon Nul mutuellement exclusifs', () => {
    const sameSide = evaluateRoll(
      { landing: SinglePigLanding.FLANC, flankSide: FlankSide.DROIT },
      { landing: SinglePigLanding.FLANC, flankSide: FlankSide.DROIT },
      NO_OVERRIDE_RNG,
    );
    const oppositeSide = evaluateRoll(
      { landing: SinglePigLanding.FLANC, flankSide: FlankSide.DROIT },
      { landing: SinglePigLanding.FLANC, flankSide: FlankSide.GAUCHE },
      NO_OVERRIDE_RNG,
    );

    expect(sameSide.type).toBe(RollResultType.BON_FLANC);
    expect(oppositeSide.type).toBe(RollResultType.COCHON_NUL);
  });

  it('calcule les points fixes des doubles', () => {
    expect(
      computeResult(
        RollResultType.DOUBLE_BAJOUE,
        { landing: SinglePigLanding.BAJOUE, flankSide: null },
        { landing: SinglePigLanding.BAJOUE, flankSide: null },
      ).points,
    ).toBe(60);
    expect(
      computeResult(
        RollResultType.DOUBLE_GROIN_GROIN,
        { landing: SinglePigLanding.GROIN_GROIN, flankSide: null },
        { landing: SinglePigLanding.GROIN_GROIN, flankSide: null },
      ).points,
    ).toBe(40);
    expect(
      computeResult(
        RollResultType.DOUBLE_TROTTEUR,
        { landing: SinglePigLanding.TROTTEUR, flankSide: null },
        { landing: SinglePigLanding.TROTTEUR, flankSide: null },
      ).points,
    ).toBe(20);
  });

  it('calcule SOMME avec les points des deux cochons', () => {
    const result = computeResult(
      RollResultType.SOMME,
      { landing: SinglePigLanding.TROTTEUR, flankSide: null },
      { landing: SinglePigLanding.GROIN_GROIN, flankSide: null },
    );

    expect(result.points).toBe(15);
  });

  it('applique Bon Jambon avant Cochon a Cheval', () => {
    const result = evaluateRoll(
      { landing: SinglePigLanding.TROTTEUR, flankSide: null },
      { landing: SinglePigLanding.GROIN_GROIN, flankSide: null },
      createOverrideRNG([0]),
    );

    expect(result.type).toBe(RollResultType.BON_JAMBON);
    expect(result.effect).toBe(RollEffect.PERTE_TOTALE);
    expect(result.points).toBe(0);
  });

  it('applique Cochon a Cheval quand Bon Jambon ne passe pas', () => {
    const result = evaluateRoll(
      { landing: SinglePigLanding.TROTTEUR, flankSide: null },
      { landing: SinglePigLanding.GROIN_GROIN, flankSide: null },
      createOverrideRNG([1, 0]),
    );

    expect(result.type).toBe(RollResultType.COCHON_A_CHEVAL);
    expect(result.effect).toBe(RollEffect.ELIMINATION);
    expect(result.points).toBe(0);
  });
});
