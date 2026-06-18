import { CONFIG } from '../config.js';
import { FlankSide, SinglePigLanding } from '../types.js';

function assertRNG(rng) {
  if (
    rng === null ||
    typeof rng !== 'object' ||
    typeof rng.random !== 'function' ||
    typeof rng.weightedPick !== 'function'
  ) {
    throw new TypeError('Un generateur aleatoire valide est requis.');
  }
}

export function rollSinglePig(rng) {
  assertRNG(rng);

  const pickedLanding = rng.weightedPick(CONFIG.SINGLE_PIG_WEIGHTS);
  const landing = pickedLanding.landing;
  const flankSide =
    landing === SinglePigLanding.FLANC
      ? rng.random() < CONFIG.FLANK_SIDE_PROBABILITY
        ? FlankSide.DROIT
        : FlankSide.GAUCHE
      : null;

  return { landing, flankSide };
}

export function rollTwoPigs(rng) {
  assertRNG(rng);

  return {
    pig1: rollSinglePig(rng),
    pig2: rollSinglePig(rng),
  };
}
