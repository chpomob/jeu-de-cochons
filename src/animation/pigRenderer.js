import { FlankSide, SinglePigLanding } from '../types.js';

function assertRenderingContext(ctx) {
  if (
    ctx === null ||
    typeof ctx !== 'object' ||
    typeof ctx.save !== 'function' ||
    typeof ctx.restore !== 'function' ||
    typeof ctx.translate !== 'function' ||
    typeof ctx.rotate !== 'function' ||
    typeof ctx.scale !== 'function' ||
    typeof ctx.drawImage !== 'function'
  ) {
    throw new TypeError('Un contexte CanvasRenderingContext2D valide est requis.');
  }
}

function assertSprite(sprite) {
  if (
    sprite === null ||
    typeof sprite !== 'object' ||
    !Number.isFinite(sprite.width) ||
    !Number.isFinite(sprite.height) ||
    sprite.width <= 0 ||
    sprite.height <= 0
  ) {
    throw new TypeError('Un sprite canvas valide est requis.');
  }
}

function assertTransformValue(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} doit etre un nombre fini.`);
  }
}

export function drawPig(ctx, sprite, x, y, angle, scale = 1.0) {
  assertRenderingContext(ctx);
  assertSprite(sprite);
  assertTransformValue(x, 'x');
  assertTransformValue(y, 'y');
  assertTransformValue(angle, 'angle');
  assertTransformValue(scale, 'scale');

  if (scale <= 0) {
    throw new RangeError('scale doit etre strictement positif.');
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const width = Number.isFinite(sprite.logicalWidth) ? sprite.logicalWidth : sprite.width;
  const height = Number.isFinite(sprite.logicalHeight) ? sprite.logicalHeight : sprite.height;
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function getSpriteKey(landing, flankSide = null) {
  if (landing === SinglePigLanding.FLANC) {
    if (flankSide === FlankSide.DROIT) {
      return 'FLANC_DROIT';
    }

    if (flankSide === FlankSide.GAUCHE) {
      return 'FLANC_GAUCHE';
    }

    throw new TypeError('Un flanc doit fournir un cote valide.');
  }

  if (flankSide !== null) {
    throw new TypeError('Seul un flanc peut fournir un cote.');
  }

  if (landing === SinglePigLanding.TROTTEUR) {
    return 'TROTTEUR';
  }

  if (landing === SinglePigLanding.TOURNEDOS) {
    return 'TOURNEDOS';
  }

  if (landing === SinglePigLanding.GROIN_GROIN) {
    return 'GROIN_GROIN';
  }

  if (landing === SinglePigLanding.BAJOUE) {
    return 'BAJOUE';
  }

  throw new TypeError('Position de cochon inconnue.');
}
