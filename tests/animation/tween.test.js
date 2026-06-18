import { describe, expect, it } from 'vitest';

import { Easing, interpolate, interpolatePoint } from '../../src/animation/tween.js';

describe('interpolations d animation', () => {
  it('interpole lineairement une valeur numerique', () => {
    expect(interpolate(0, 100, 0.5)).toBe(50);
  });

  it('applique easeIn quadratique', () => {
    expect(interpolate(0, 100, 0.5, Easing.easeIn)).toBe(25);
  });

  it('conserve les bornes avec bounceOut', () => {
    expect(interpolate(0, 100, 0, Easing.bounceOut)).toBe(0);
    expect(interpolate(0, 100, 1, Easing.bounceOut)).toBe(100);
  });

  it('interpole un point en deux dimensions', () => {
    expect(interpolatePoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({
      x: 5,
      y: 10,
    });
  });
});
