import { FlankSide, SinglePigLanding } from '../types.js';

const DEFAULT_SIZE = 200;
const SPRITE_KEYS = Object.freeze([
  'FLANC_DROIT',
  'FLANC_GAUCHE',
  'TROTTEUR',
  'TOURNEDOS',
  'GROIN_GROIN',
  'BAJOUE',
]);
const SPRITE_CONFIGS = Object.freeze({
  FLANC_DROIT: Object.freeze({
    angle: Math.PI / 2,
    spotVisible: true,
    spotOffsetX: -0.12,
    bellyUp: false,
  }),
  FLANC_GAUCHE: Object.freeze({
    angle: -Math.PI / 2,
    spotVisible: true,
    spotOffsetX: 0.16,
    bellyUp: false,
  }),
  TROTTEUR: Object.freeze({
    angle: 0,
    spotVisible: true,
    spotOffsetX: -0.12,
    bellyUp: false,
  }),
  TOURNEDOS: Object.freeze({
    angle: Math.PI,
    spotVisible: false,
    spotOffsetX: -0.12,
    bellyUp: true,
  }),
  GROIN_GROIN: Object.freeze({
    angle: -Math.PI / 4,
    spotVisible: true,
    spotOffsetX: -0.1,
    bellyUp: false,
  }),
  BAJOUE: Object.freeze({
    angle: (3 * Math.PI) / 4,
    spotVisible: true,
    spotOffsetX: 0.08,
    bellyUp: false,
  }),
});
const COLORS = Object.freeze({
  body: '#FFB6C1',
  outline: '#C96A80',
  snout: '#F28FA5',
  innerEar: '#F6A1B2',
  hoof: '#7C3F4F',
  spot: '#000',
});
const MAX_CACHE_ENTRIES = 8;

const spritesByCacheKey = new Map();

function assertSize(size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new TypeError('La taille des sprites doit etre un entier positif.');
  }
}

export function getSpriteKey(landing, flankSide) {
  if (landing === SinglePigLanding.FLANC) {
    if (flankSide === FlankSide.DROIT) {
      return 'FLANC_DROIT';
    }

    if (flankSide === FlankSide.GAUCHE) {
      return 'FLANC_GAUCHE';
    }

    throw new TypeError('Un flanc doit indiquer un cote de sprite valide.');
  }

  if (SPRITE_KEYS.includes(landing)) {
    if (flankSide !== null && flankSide !== undefined) {
      throw new TypeError('Seul un flanc peut indiquer un cote de sprite.');
    }

    return landing;
  }

  throw new TypeError('Position de cochon inconnue pour les sprites.');
}

function createSpriteCanvas(size) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new TypeError('Un document HTML est requis pour generer les sprites.');
  }

  const pixelRatio = getDevicePixelRatio();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size * pixelRatio));
  canvas.height = Math.max(1, Math.round(size * pixelRatio));
  canvas.logicalWidth = size;
  canvas.logicalHeight = size;
  canvas.pixelRatio = pixelRatio;

  if (canvas.style !== undefined) {
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }

  return canvas;
}

function getDevicePixelRatio() {
  if (
    typeof globalThis.devicePixelRatio === 'number' &&
    Number.isFinite(globalThis.devicePixelRatio) &&
    globalThis.devicePixelRatio > 0
  ) {
    return globalThis.devicePixelRatio;
  }

  return 1;
}

function get2DContext(canvas) {
  if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
    return null;
  }

  if (typeof canvas.getContext !== 'function') {
    return null;
  }

  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

function drawEllipse(ctx, x, y, radiusX, radiusY, rotation) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLeg(ctx, x, y, width, height) {
  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.35, y);
  ctx.lineTo(x + width * 0.65, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + width * 0.35);
  ctx.lineTo(x + width, y + height - width * 0.35);
  ctx.quadraticCurveTo(x + width, y + height, x + width * 0.65, y + height);
  ctx.lineTo(x + width * 0.35, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - width * 0.35);
  ctx.lineTo(x, y + width * 0.35);
  ctx.quadraticCurveTo(x, y, x + width * 0.35, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.hoof;
  ctx.fillRect(x + width * 0.05, y + height * 0.72, width * 0.9, height * 0.22);
}

function drawEar(ctx, x, y, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(24, -15);
  ctx.lineTo(18, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.innerEar;
  ctx.beginPath();
  ctx.moveTo(7, 2);
  ctx.lineTo(18, -7);
  ctx.lineTo(15, 10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawTail(ctx, x, y) {
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 10, Math.PI * 0.15, Math.PI * 1.75);
  ctx.arc(x + 8, y - 1, 5, Math.PI * 1.75, Math.PI * 0.15, true);
  ctx.stroke();
}

function drawSnout(ctx, x, y) {
  ctx.fillStyle = COLORS.snout;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 2;
  drawEllipse(ctx, x, y, 17, 13, 0);

  ctx.fillStyle = COLORS.spot;
  ctx.beginPath();
  ctx.arc(x - 6, y - 1, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBellyUpLegs(ctx) {
  drawLeg(ctx, -42, -54, 17, 38);
  drawLeg(ctx, 20, -54, 17, 38);
  drawLeg(ctx, -42, 16, 17, 38);
  drawLeg(ctx, 20, 16, 17, 38);
}

function drawStandingLegs(ctx) {
  drawLeg(ctx, -48, 34, 17, 39);
  drawLeg(ctx, -18, 38, 17, 35);
  drawLeg(ctx, 14, 38, 17, 35);
  drawLeg(ctx, 44, 34, 17, 39);
}

function drawStylizedPig(ctx, size, config) {
  const unit = size / DEFAULT_SIZE;

  ctx.save();
  ctx.scale(unit, unit);

  drawTail(ctx, -69, -7);

  if (config.bellyUp) {
    drawBellyUpLegs(ctx);
  } else {
    drawStandingLegs(ctx);
  }

  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 3;
  drawEllipse(ctx, 0, 0, 68, 45, 0);

  if (config.spotVisible) {
    ctx.fillStyle = COLORS.spot;
    ctx.beginPath();
    ctx.arc(config.spotOffsetX * DEFAULT_SIZE, -4, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEar(ctx, 45, -33, -0.4);
  drawEar(ctx, 66, -18, 0.55);

  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 3;
  drawEllipse(ctx, 61, -2, 32, 27, 0.12);

  ctx.fillStyle = COLORS.spot;
  ctx.beginPath();
  ctx.arc(68, -13, 4, 0, Math.PI * 2);
  ctx.fill();

  drawSnout(ctx, 88, 3);

  ctx.restore();
}

function drawSprite(canvas, config) {
  const ctx = get2DContext(canvas);

  if (ctx === null) {
    return false;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.pixelRatio, canvas.pixelRatio);
  ctx.translate(canvas.logicalWidth / 2, canvas.logicalHeight / 2);
  ctx.rotate(config.angle);
  drawStylizedPig(ctx, canvas.logicalWidth, config);
  ctx.restore();

  return true;
}

function getCacheKey(size) {
  return `${size}@${getDevicePixelRatio()}`;
}

function rememberSprites(cacheKey, sprites) {
  spritesByCacheKey.set(cacheKey, sprites);

  while (spritesByCacheKey.size > MAX_CACHE_ENTRIES) {
    const oldestKey = spritesByCacheKey.keys().next().value;
    spritesByCacheKey.delete(oldestKey);
  }
}

export function generatePigSprites(size = DEFAULT_SIZE) {
  assertSize(size);

  const cacheKey = getCacheKey(size);

  if (spritesByCacheKey.has(cacheKey)) {
    return spritesByCacheKey.get(cacheKey);
  }

  const sprites = new Map();
  let rendered = true;

  for (const key of SPRITE_KEYS) {
    const canvas = createSpriteCanvas(size);
    rendered = drawSprite(canvas, SPRITE_CONFIGS[key]) && rendered;
    sprites.set(key, canvas);
  }

  if (rendered) {
    rememberSprites(cacheKey, sprites);
  }

  return sprites;
}
