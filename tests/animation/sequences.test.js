import { describe, expect, it } from 'vitest';

import {
  composeSequences,
  createResultFadeIn,
  createStabilizeSequence,
  createThrowSequence,
} from '../../src/animation/sequences.js';

function expectStrictlyIncreasingElapsed(sequence) {
  for (let index = 1; index < sequence.length; index += 1) {
    expect(sequence[index].elapsed).toBeGreaterThan(sequence[index - 1].elapsed);
  }
}

function expectDurationCloseTo(sequence, durationMs) {
  expect(sequence[sequence.length - 1].elapsed).toBeCloseTo(durationMs, 6);
}

describe('sequences d animation', () => {
  it('cree une sequence de lancer non vide avec des elapsed croissants', () => {
    const durationMs = 300;
    const sequence = createThrowSequence(800, 600, durationMs);

    expect(sequence.length).toBeGreaterThan(0);
    expect(sequence[0].elapsed).toBe(0);
    expectStrictlyIncreasingElapsed(sequence);
    expectDurationCloseTo(sequence, durationMs);
  });

  it('compose les sequences en ajustant les elapsed cumules', () => {
    const throwSequence = createThrowSequence(800, 600, 300);
    const finalPose = {
      pig1: { x: 300, y: 360, angle: 0, scale: 1, spriteKey: 'TROTTEUR' },
      pig2: { x: 500, y: 360, angle: 0, scale: 1, spriteKey: 'BAJOUE' },
    };
    const stabilizeSequence = createStabilizeSequence(finalPose, 500);
    const fadeInSequence = createResultFadeIn('Resultat', 300);
    const composed = composeSequences(
      throwSequence,
      stabilizeSequence,
      fadeInSequence,
    );

    expect(composed.length).toBe(
      throwSequence.length + stabilizeSequence.length + fadeInSequence.length - 2,
    );
    expect(composed[0].elapsed).toBe(0);
    expectStrictlyIncreasingElapsed(composed);
    expectDurationCloseTo(composed, 1100);
    expect(composed[throwSequence.length].elapsed).toBeGreaterThan(300);

    const fadeInStart = composed.find(
      (keyframe) => keyframe.resultText === 'Resultat' && keyframe.resultOpacity === 0,
    );

    expect(fadeInStart.pig1).toEqual(finalPose.pig1);
    expect(fadeInStart.pig2).toEqual(finalPose.pig2);
  });

  it('fusionne une sequence ponctuelle au point de raccord', () => {
    const composed = composeSequences(
      [{ elapsed: 0, pig1: { x: 1, y: 2, angle: 0, scale: 1, spriteKey: 'TROTTEUR' } }],
      [{ elapsed: 0, resultText: 'Resultat', resultOpacity: 1 }],
    );

    expect(composed).toHaveLength(1);
    expect(composed[0].pig1.spriteKey).toBe('TROTTEUR');
    expect(composed[0].resultText).toBe('Resultat');
  });
});
