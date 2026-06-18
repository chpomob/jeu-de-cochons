import { describe, expect, it } from 'vitest';

import { getSpriteKey } from '../../src/animation/pigRenderer.js';
import { SinglePigLanding } from '../../src/types.js';

describe('rendu des cochons', () => {
  it('accepte un cote omis pour les poses qui ne sont pas un flanc', () => {
    expect(getSpriteKey(SinglePigLanding.TROTTEUR)).toBe('TROTTEUR');
  });
});
