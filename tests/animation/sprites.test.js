import { describe, expect, it } from 'vitest';

import { generatePigSprites, getSpriteKey } from '../../src/animation/sprites.js';
import { FlankSide, SinglePigLanding } from '../../src/types.js';

const EXPECTED_KEYS = Object.freeze([
  'FLANC_DROIT',
  'FLANC_GAUCHE',
  'TROTTEUR',
  'TOURNEDOS',
  'GROIN_GROIN',
  'BAJOUE',
]);

describe('sprites proceduraux de cochons', () => {
  it('genere une Map contenant les six poses attendues', () => {
    const sprites = generatePigSprites();

    expect(sprites).toBeInstanceOf(Map);
    expect([...sprites.keys()]).toEqual(EXPECTED_KEYS);
  });

  it('genere des canvas HTML de 200 par 200 pixels', () => {
    const sprites = generatePigSprites();

    for (const key of EXPECTED_KEYS) {
      const sprite = sprites.get(key);

      expect(sprite).toBeInstanceOf(HTMLCanvasElement);
      expect(sprite.width).toBe(200);
      expect(sprite.height).toBe(200);
    }
  });

  it('ne reutilise pas un cache de sprites non dessines quand le contexte 2D est indisponible', () => {
    const sprites = generatePigSprites(201);

    expect(generatePigSprites(201)).not.toBe(sprites);
  });

  it('convertit une position moteur en cle de sprite', () => {
    expect(getSpriteKey(SinglePigLanding.FLANC, FlankSide.DROIT)).toBe(
      'FLANC_DROIT',
    );
    expect(getSpriteKey(SinglePigLanding.FLANC, FlankSide.GAUCHE)).toBe(
      'FLANC_GAUCHE',
    );
    expect(getSpriteKey(SinglePigLanding.TROTTEUR, null)).toBe('TROTTEUR');
  });
});
