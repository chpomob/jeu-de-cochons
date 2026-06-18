import { describe, expect, it } from 'vitest';

import { rollSinglePig, rollTwoPigs } from '../../src/engine/roll.js';
import { CONFIG } from '../../src/config.js';
import { FlankSide, SinglePigLanding } from '../../src/types.js';
import { createRNG } from '../../src/utils/rng.js';

const LANDINGS = Object.values(SinglePigLanding);
const FLANK_SIDES = Object.values(FlankSide);

describe('tirage des cochons', () => {
  it('retourne une position et un cote de flanc coherent avec un RNG seede', () => {
    const rng = createRNG(42);
    const pig = rollSinglePig(rng);

    expect(LANDINGS).toContain(pig.landing);
    expect(
      pig.landing === SinglePigLanding.FLANC
        ? FLANK_SIDES.includes(pig.flankSide)
        : pig.flankSide === null,
    ).toBe(true);
  });

  it('retourne null comme cote pour une position non flanc', () => {
    const rng = createRNG(42);
    let pig = rollSinglePig(rng);

    while (pig.landing === SinglePigLanding.FLANC) {
      pig = rollSinglePig(rng);
    }

    expect(pig.flankSide).toBeNull();
  });

  it('retourne droit ou gauche pour un flanc', () => {
    const rng = createRNG(42);
    let pig = rollSinglePig(rng);

    while (pig.landing !== SinglePigLanding.FLANC) {
      pig = rollSinglePig(rng);
    }

    expect(FLANK_SIDES).toContain(pig.flankSide);
  });

  it('tire deux cochons independants', () => {
    const rng = createRNG(42);
    const result = rollTwoPigs(rng);

    expect(LANDINGS).toContain(result.pig1.landing);
    expect(LANDINGS).toContain(result.pig2.landing);
  });

  it('fait apparaitre chaque position sur 1000 tirages seedes', () => {
    const rng = createRNG(42);
    const counts = new Map(LANDINGS.map((landing) => [landing, 0]));

    for (let index = 0; index < 1000; index += 1) {
      const pig = rollSinglePig(rng);
      counts.set(pig.landing, counts.get(pig.landing) + 1);
    }

    for (const { landing } of CONFIG.SINGLE_PIG_WEIGHTS) {
      expect(counts.get(landing)).toBeGreaterThan(0);
    }
  });
});
