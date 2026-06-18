import { drawPig } from './pigRenderer.js';

function noop() {}

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

function assertCanvas(canvas) {
  if (
    canvas === null ||
    typeof canvas !== 'object' ||
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    typeof canvas.getContext !== 'function'
  ) {
    throw new TypeError('Un canvas HTML valide est requis.');
  }
}

function assertSprites(sprites) {
  if (sprites === null || typeof sprites !== 'object' || typeof sprites.get !== 'function') {
    throw new TypeError('Une Map de sprites est requise.');
  }
}

function assertKeyframes(keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    throw new TypeError('Une animation requiert au moins une keyframe.');
  }

  let previousElapsed = -Infinity;

  for (const keyframe of keyframes) {
    if (
      keyframe === null ||
      typeof keyframe !== 'object' ||
      !Number.isFinite(keyframe.elapsed) ||
      keyframe.elapsed < 0
    ) {
      throw new TypeError('Chaque keyframe doit fournir un elapsed positif ou nul.');
    }

    if (keyframe.elapsed < previousElapsed) {
      throw new RangeError('Les keyframes doivent etre triees par elapsed croissant.');
    }

    previousElapsed = keyframe.elapsed;
  }
}

function normalizeCallbacks(callbacks = {}) {
  if (callbacks === null || typeof callbacks !== 'object') {
    throw new TypeError('Les callbacks doivent etre fournis dans un objet.');
  }

  return {
    onComplete: callbacks.onComplete ?? noop,
    onError: callbacks.onError ?? noop,
    onFrame: callbacks.onFrame ?? noop,
    onSkip: callbacks.onSkip ?? noop,
  };
}

function assertCallbacks(callbacks) {
  if (
    typeof callbacks.onComplete !== 'function' ||
    typeof callbacks.onError !== 'function' ||
    typeof callbacks.onFrame !== 'function' ||
    typeof callbacks.onSkip !== 'function'
  ) {
    throw new TypeError('Les callbacks d animation doivent etre des fonctions.');
  }
}

function getFrameAtElapsed(keyframes, elapsed) {
  let lower = 0;
  let upper = keyframes.length - 1;

  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);

    if (keyframes[middle].elapsed <= elapsed) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }

  return keyframes[Math.max(0, upper)];
}

function drawResultText(ctx, viewport, keyframe) {
  if (typeof keyframe.resultText !== 'string') {
    return;
  }

  const opacity = Number.isFinite(keyframe.resultOpacity)
    ? Math.min(1, Math.max(0, keyframe.resultOpacity))
    : 1;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#2F1B20';
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(keyframe.resultText, viewport.width / 2, viewport.height * 0.15);
  ctx.restore();
}

function drawPigFromKeyframe(ctx, sprites, pigKeyframe) {
  if (pigKeyframe === undefined) {
    return;
  }

  const sprite = sprites.get(pigKeyframe.spriteKey);

  if (sprite === undefined) {
    throw new TypeError(`Sprite introuvable: ${pigKeyframe.spriteKey}.`);
  }

  drawPig(
    ctx,
    sprite,
    pigKeyframe.x,
    pigKeyframe.y,
    pigKeyframe.angle,
    pigKeyframe.scale,
  );
}

export function createAnimationController(canvas, sprites) {
  assertCanvas(canvas);
  assertSprites(sprites);

  const ctx = canvas.getContext('2d');

  if (ctx === null) {
    throw new TypeError('Le contexte Canvas 2D est indisponible.');
  }

  let requestId = null;
  let running = false;
  let activeKeyframes = [];
  let activeCallbacks = normalizeCallbacks();
  let startedAt = null;
  let logicalWidth = canvas.width;
  let logicalHeight = canvas.height;

  function cancelCurrentFrame() {
    if (requestId !== null) {
      cancelAnimationFrame(requestId);
      requestId = null;
    }
  }

  function syncCanvasPixelRatio() {
    const ratio = getDevicePixelRatio();
    const rect =
      typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;

    if (rect !== null && rect.width > 0 && rect.height > 0) {
      logicalWidth = rect.width;
      logicalHeight = rect.height;
    } else if (canvas.style !== undefined) {
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
    }

    const pixelWidth = Math.max(1, Math.round(logicalWidth * ratio));
    const pixelHeight = Math.max(1, Math.round(logicalHeight * ratio));

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }

    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    return {
      width: logicalWidth,
      height: logicalHeight,
    };
  }

  function render(keyframe) {
    const viewport = syncCanvasPixelRatio();

    ctx.clearRect(0, 0, viewport.width, viewport.height);
    drawPigFromKeyframe(ctx, sprites, keyframe.pig1);
    drawPigFromKeyframe(ctx, sprites, keyframe.pig2);
    drawResultText(ctx, viewport, keyframe);
    activeCallbacks.onFrame(keyframe);
  }

  function completeWith(keyframe) {
    running = false;
    cancelCurrentFrame();
    render(keyframe);
    activeCallbacks.onComplete();
  }

  function failWith(error) {
    const onError = activeCallbacks.onError;

    running = false;
    cancelCurrentFrame();
    activeKeyframes = [];
    activeCallbacks = normalizeCallbacks();
    onError(error);
  }

  function step(timestamp) {
    if (!running) {
      return;
    }

    requestId = null;

    try {
      if (startedAt === null) {
        startedAt = timestamp;
      }

      const elapsed = timestamp - startedAt;
      const lastKeyframe = activeKeyframes[activeKeyframes.length - 1];

      if (elapsed >= lastKeyframe.elapsed) {
        completeWith(lastKeyframe);
        return;
      }

      const currentKeyframe = getFrameAtElapsed(activeKeyframes, elapsed);
      render(currentKeyframe);

      requestId = requestAnimationFrame(step);
    } catch (error) {
      failWith(error);
    }
  }

  return {
    start(keyframes, callbacks = {}) {
      assertKeyframes(keyframes);

      const normalizedCallbacks = normalizeCallbacks(callbacks);
      assertCallbacks(normalizedCallbacks);

      cancelCurrentFrame();
      activeKeyframes = keyframes;
      activeCallbacks = normalizedCallbacks;
      startedAt = null;
      running = true;

      try {
        render(activeKeyframes[0]);
      } catch (error) {
        running = false;
        activeKeyframes = [];
        activeCallbacks = normalizeCallbacks();
        throw error;
      }

      requestId = requestAnimationFrame(step);
    },

    skip() {
      if (!running) {
        return;
      }

      const lastKeyframe = activeKeyframes[activeKeyframes.length - 1];
      running = false;
      cancelCurrentFrame();
      render(lastKeyframe);
      activeCallbacks.onSkip();
      activeCallbacks.onComplete();
    },

    isRunning() {
      return running;
    },

    destroy() {
      running = false;
      cancelCurrentFrame();
      activeKeyframes = [];
      activeCallbacks = normalizeCallbacks();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
