import { CONFIG } from '../config.js';
import {
  RollEffect,
  RollResultType,
  SinglePigLanding,
} from '../types.js';

const DOUBLE_RESULT_BY_LANDING = Object.freeze({
  [SinglePigLanding.TROTTEUR]: RollResultType.DOUBLE_TROTTEUR,
  [SinglePigLanding.TOURNEDOS]: RollResultType.DOUBLE_TOURNEDOS,
  [SinglePigLanding.GROIN_GROIN]: RollResultType.DOUBLE_GROIN_GROIN,
  [SinglePigLanding.BAJOUE]: RollResultType.DOUBLE_BAJOUE,
});

const DOUBLE_POINTS_BY_TYPE = Object.freeze({
  [RollResultType.DOUBLE_TROTTEUR]: 20,
  [RollResultType.DOUBLE_TOURNEDOS]: 20,
  [RollResultType.DOUBLE_GROIN_GROIN]: 40,
  [RollResultType.DOUBLE_BAJOUE]: 60,
});

function assertPig(pig) {
  if (pig === null || typeof pig !== 'object') {
    throw new TypeError('Un cochon doit etre un objet.');
  }

  if (!Object.values(SinglePigLanding).includes(pig.landing)) {
    throw new TypeError('Position de cochon inconnue.');
  }

  if (pig.landing === SinglePigLanding.FLANC && pig.flankSide === null) {
    throw new TypeError('Un flanc doit indiquer son cote.');
  }

  if (pig.landing !== SinglePigLanding.FLANC && pig.flankSide !== null) {
    throw new TypeError('Seul un flanc peut indiquer un cote.');
  }
}

function assertRNG(rng) {
  if (rng === null || typeof rng !== 'object' || typeof rng.random !== 'function') {
    throw new TypeError('Un generateur aleatoire valide est requis.');
  }
}

function getLandingPoints(landing) {
  const configEntry = CONFIG.SINGLE_PIG_WEIGHTS.find(
    (entry) => entry.landing === landing,
  );

  if (configEntry === undefined) {
    throw new TypeError('Position de cochon non configuree.');
  }

  return configEntry.points;
}

function clonePig(pig) {
  return {
    landing: pig.landing,
    flankSide: pig.flankSide,
  };
}

function getBaseRollType(pig1, pig2) {
  const pig1IsFlank = pig1.landing === SinglePigLanding.FLANC;
  const pig2IsFlank = pig2.landing === SinglePigLanding.FLANC;

  if (pig1IsFlank && pig2IsFlank) {
    return pig1.flankSide === pig2.flankSide
      ? RollResultType.BON_FLANC
      : RollResultType.COCHON_NUL;
  }

  if (!pig1IsFlank && pig1.landing === pig2.landing) {
    return DOUBLE_RESULT_BY_LANDING[pig1.landing];
  }

  return RollResultType.SOMME;
}

function getEffect(rollType) {
  if (rollType === RollResultType.COCHON_NUL) {
    return RollEffect.PERTE_TOUR;
  }

  if (rollType === RollResultType.BON_JAMBON) {
    return RollEffect.PERTE_TOTALE;
  }

  if (rollType === RollResultType.COCHON_A_CHEVAL) {
    return RollEffect.ELIMINATION;
  }

  return RollEffect.GAIN_POINTS;
}

function getPoints(rollType, pig1, pig2, effect) {
  if (effect !== RollEffect.GAIN_POINTS) {
    return 0;
  }

  if (rollType === RollResultType.BON_FLANC) {
    return 1;
  }

  if (Object.hasOwn(DOUBLE_POINTS_BY_TYPE, rollType)) {
    return DOUBLE_POINTS_BY_TYPE[rollType];
  }

  if (rollType === RollResultType.SOMME) {
    return getLandingPoints(pig1.landing) + getLandingPoints(pig2.landing);
  }

  throw new TypeError('Type de resultat non calculable.');
}

export function computeResult(rollType, pig1, pig2) {
  assertPig(pig1);
  assertPig(pig2);

  if (!Object.values(RollResultType).includes(rollType)) {
    throw new TypeError('Type de resultat inconnu.');
  }

  const effect = getEffect(rollType);

  return {
    type: rollType,
    effect,
    points: getPoints(rollType, pig1, pig2, effect),
    pig1: clonePig(pig1),
    pig2: clonePig(pig2),
  };
}

export function evaluateRoll(pig1, pig2, rng) {
  assertPig(pig1);
  assertPig(pig2);
  assertRNG(rng);

  let rollType = getBaseRollType(pig1, pig2);

  if (rng.random() < CONFIG.OVERRIDE_JAMBON) {
    // Rare combined outcomes are not individual landings in SinglePigLanding.
    // Keep the rolled pigs as physical roll data and expose the special type.
    rollType = RollResultType.BON_JAMBON;
  } else if (rng.random() < CONFIG.OVERRIDE_CHEVAL) {
    // Rare combined outcomes are not individual landings in SinglePigLanding.
    // Keep the rolled pigs as physical roll data and expose the special type.
    rollType = RollResultType.COCHON_A_CHEVAL;
  }

  return computeResult(rollType, pig1, pig2);
}
