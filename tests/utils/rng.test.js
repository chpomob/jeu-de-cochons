import { describe, expect, it } from 'vitest';

import { createRNG } from '../../src/utils/rng.js';

function canonicalMulberry32(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (state + 0x6d2b79f5) | 0;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe('generateur aleatoire', () => {
  it('suit mulberry32 avec un accumulateur borne a 32 bits', () => {
    const rng = createRNG(42);
    const expected = canonicalMulberry32(42);

    for (let index = 0; index < 20; index += 1) {
      expect(rng.random()).toBe(expected());
    }
  });
});
