function clampProgress(progress) {
  if (!Number.isFinite(progress)) {
    throw new TypeError('Le progres doit etre un nombre fini.');
  }

  return Math.min(1, Math.max(0, progress));
}

function assertNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} doit etre un nombre fini.`);
  }
}

function assertEasing(easing) {
  if (typeof easing !== 'function') {
    throw new TypeError('La fonction easing est requise.');
  }
}

function assertPoint(point, label) {
  if (
    point === null ||
    typeof point !== 'object' ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    throw new TypeError(`${label} doit contenir des coordonnees x/y finies.`);
  }
}

export const Easing = Object.freeze({
  linear(t) {
    return t;
  },

  easeIn(t) {
    return t * t;
  },

  easeOut(t) {
    const inverse = 1 - t;

    return 1 - inverse * inverse;
  },

  easeInOut(t) {
    if (t < 0.5) {
      return 2 * t * t;
    }

    return 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
  },

  bounceOut(t) {
    const firstThreshold = 1 / 2.75;
    const secondThreshold = 2 / 2.75;
    const thirdThreshold = 2.5 / 2.75;
    const bounceFactor = 7.5625;

    if (t < firstThreshold) {
      return bounceFactor * t * t;
    }

    if (t < secondThreshold) {
      const adjusted = t - 1.5 / 2.75;

      return bounceFactor * adjusted * adjusted + 0.75;
    }

    if (t < thirdThreshold) {
      const adjusted = t - 2.25 / 2.75;

      return bounceFactor * adjusted * adjusted + 0.9375;
    }

    const adjusted = t - 2.625 / 2.75;

    return bounceFactor * adjusted * adjusted + 0.984375;
  },
});

export function interpolate(start, end, progress, easing = Easing.linear) {
  assertNumber(start, 'La valeur de depart');
  assertNumber(end, 'La valeur d arrivee');
  assertEasing(easing);

  const easedProgress = easing(clampProgress(progress));

  if (!Number.isFinite(easedProgress)) {
    throw new TypeError('La fonction easing doit retourner un nombre fini.');
  }

  return start + (end - start) * easedProgress;
}

export function interpolatePoint(
  startPoint,
  endPoint,
  progress,
  easing = Easing.linear,
) {
  assertPoint(startPoint, 'Le point de depart');
  assertPoint(endPoint, 'Le point d arrivee');

  return {
    x: interpolate(startPoint.x, endPoint.x, progress, easing),
    y: interpolate(startPoint.y, endPoint.y, progress, easing),
  };
}
