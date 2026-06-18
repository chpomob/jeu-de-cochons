import { Easing, interpolate } from './tween.js';

const FRAME_STEP_MS = 1000 / 60;
const DEFAULT_SPRITE_KEY = 'TROTTEUR';
const STABILIZE_WOBBLES = Object.freeze([3, -2, 1, 0]);

function assertDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new TypeError('La duree doit etre un nombre positif.');
  }
}

function assertDimension(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} doit etre un nombre positif.`);
  }
}

function assertText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Le texte de resultat doit etre une chaine.');
  }
}

function createTimeline(durationMs) {
  assertDuration(durationMs);

  const frameCount = Math.max(1, Math.ceil(durationMs / FRAME_STEP_MS));
  const frames = [];

  for (let frame = 0; frame <= frameCount; frame += 1) {
    const progress = frame / frameCount;
    frames.push({
      elapsed: progress * durationMs,
      progress,
    });
  }

  return frames;
}

function clonePigPose(pose) {
  if (pose === undefined) {
    return undefined;
  }

  if (
    pose === null ||
    typeof pose !== 'object' ||
    !Number.isFinite(pose.x) ||
    !Number.isFinite(pose.y) ||
    !Number.isFinite(pose.angle) ||
    !Number.isFinite(pose.scale) ||
    typeof pose.spriteKey !== 'string' ||
    pose.spriteKey.length === 0
  ) {
    throw new TypeError('Une pose de cochon doit contenir x, y, angle, scale et spriteKey.');
  }

  return {
    x: pose.x,
    y: pose.y,
    angle: pose.angle,
    scale: pose.scale,
    spriteKey: pose.spriteKey,
  };
}

function normalizeTwoPigPose(value) {
  // Hypothese: les sequences de lancer manipulent au plus deux cochons.
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TypeError('Les poses finales des cochons sont requises.');
    }

    const lastValue = value[value.length - 1];

    if (
      lastValue !== null &&
      typeof lastValue === 'object' &&
      (Object.hasOwn(lastValue, 'pig1') || Object.hasOwn(lastValue, 'pig2'))
    ) {
      return {
        pig1: clonePigPose(lastValue.pig1),
        pig2: clonePigPose(lastValue.pig2),
      };
    }

    return {
      pig1: clonePigPose(value[0]),
      pig2: clonePigPose(value[1]),
    };
  }

  if (value === null || typeof value !== 'object') {
    throw new TypeError('Les poses finales des cochons sont requises.');
  }

  return {
    pig1: clonePigPose(value.pig1),
    pig2: clonePigPose(value.pig2),
  };
}

function getThrowPose(canvasWidth, canvasHeight, progress, offsetX) {
  return {
    x: canvasWidth / 2 + offsetX,
    y: interpolate(canvasHeight, canvasHeight * 0.2, progress, Easing.easeOut),
    angle: interpolate(0, Math.PI * 4, progress, Easing.easeOut),
    scale: interpolate(0.72, 1, progress, Easing.easeOut),
    spriteKey: DEFAULT_SPRITE_KEY,
  };
}

function getLandingPose(finalPose, progress) {
  if (finalPose === undefined) {
    return undefined;
  }

  const startY = finalPose.y - 180 * finalPose.scale;

  return {
    x: finalPose.x,
    y: interpolate(startY, finalPose.y, progress, Easing.bounceOut),
    angle: interpolate(finalPose.angle - Math.PI * 1.5, finalPose.angle, progress, Easing.easeIn),
    scale: interpolate(finalPose.scale * 1.05, finalPose.scale, progress, Easing.easeOut),
    spriteKey: finalPose.spriteKey,
  };
}

function getStabilizedPose(finalPose, progress) {
  if (finalPose === undefined) {
    return undefined;
  }

  const segmentCount = STABILIZE_WOBBLES.length - 1;
  const exactSegment = Math.min(segmentCount - 1, Math.floor(progress * segmentCount));
  const localStart = exactSegment / segmentCount;
  const localEnd = (exactSegment + 1) / segmentCount;
  const localProgress =
    localEnd === localStart ? 1 : (progress - localStart) / (localEnd - localStart);
  const angleOffsetStart = (STABILIZE_WOBBLES[exactSegment] * Math.PI) / 180;
  const angleOffsetEnd = (STABILIZE_WOBBLES[exactSegment + 1] * Math.PI) / 180;

  return {
    x: finalPose.x,
    y: finalPose.y,
    angle:
      finalPose.angle +
      interpolate(angleOffsetStart, angleOffsetEnd, localProgress, Easing.easeOut),
    scale: finalPose.scale,
    spriteKey: finalPose.spriteKey,
  };
}

function getSequenceDuration(sequence) {
  if (sequence.length === 0) {
    return 0;
  }

  return sequence[sequence.length - 1].elapsed;
}

function assertKeyframe(keyframe) {
  if (
    keyframe === null ||
    typeof keyframe !== 'object' ||
    !Number.isFinite(keyframe.elapsed) ||
    keyframe.elapsed < 0
  ) {
    throw new TypeError('Chaque keyframe doit fournir un elapsed positif ou nul.');
  }
}

function mergeKeyframe(previousState, keyframe, elapsed) {
  return {
    ...previousState,
    ...keyframe,
    elapsed,
  };
}

export function createThrowSequence(canvasWidth, canvasHeight, durationMs) {
  assertDimension(canvasWidth, 'canvasWidth');
  assertDimension(canvasHeight, 'canvasHeight');

  const horizontalGap = Math.min(90, canvasWidth * 0.18);

  return createTimeline(durationMs).map(({ elapsed, progress }) => ({
    elapsed,
    pig1: getThrowPose(canvasWidth, canvasHeight, progress, -horizontalGap / 2),
    pig2: getThrowPose(canvasWidth, canvasHeight, progress, horizontalGap / 2),
  }));
}

export function createLandSequence(pigKeyframes, durationMs) {
  const finalPose = normalizeTwoPigPose(pigKeyframes);

  return createTimeline(durationMs).map(({ elapsed, progress }) => ({
    elapsed,
    pig1: getLandingPose(finalPose.pig1, progress),
    pig2: getLandingPose(finalPose.pig2, progress),
  }));
}

export function createStabilizeSequence(finalPose, durationMs) {
  const normalizedPose = normalizeTwoPigPose(finalPose);

  return createTimeline(durationMs).map(({ elapsed, progress }) => ({
    elapsed,
    pig1: getStabilizedPose(normalizedPose.pig1, progress),
    pig2: getStabilizedPose(normalizedPose.pig2, progress),
  }));
}

export function createResultFadeIn(text, durationMs) {
  assertText(text);

  return createTimeline(durationMs).map(({ elapsed, progress }) => ({
    elapsed,
    resultText: text,
    resultOpacity: interpolate(0, 1, progress, Easing.easeOut),
  }));
}

export function composeSequences(...sequenceArrays) {
  const composed = [];
  let offset = 0;
  let visualState = {};

  for (const sequence of sequenceArrays) {
    if (!Array.isArray(sequence)) {
      throw new TypeError('composeSequences attend uniquement des tableaux.');
    }

    for (let index = 0; index < sequence.length; index += 1) {
      const keyframe = sequence[index];
      assertKeyframe(keyframe);

      if (composed.length > 0 && index === 0 && keyframe.elapsed === 0) {
        visualState = mergeKeyframe(visualState, keyframe, offset);
        composed[composed.length - 1] = visualState;
        continue;
      }

      visualState = mergeKeyframe(visualState, keyframe, keyframe.elapsed + offset);
      composed.push(visualState);
    }

    offset += getSequenceDuration(sequence);
  }

  return composed;
}
