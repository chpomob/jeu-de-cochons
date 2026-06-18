import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAnimationController } from '../../src/animation/controller.js';

function createCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
  };
  const canvas = {
    width: 300,
    height: 200,
    style: {},
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({ width: 300, height: 200 })),
  };

  return { canvas, ctx };
}

describe('controleur d animation', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('devicePixelRatio', 1);
  });

  it('arrete la boucle si une erreur survient dans une frame asynchrone', () => {
    const { canvas } = createCanvas();
    const controller = createAnimationController(canvas, new Map());
    const onError = vi.fn();
    const keyframes = [
      { elapsed: 0 },
      {
        elapsed: 16,
        pig1: { x: 10, y: 10, angle: 0, scale: 1, spriteKey: 'MANQUANT' },
      },
    ];

    controller.start(keyframes, { onError });
    requestAnimationFrame.mock.calls[0][0](20);
    requestAnimationFrame.mock.calls[1][0](36);

    expect(controller.isRunning()).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('utilise le timestamp de la premiere frame requestAnimationFrame comme origine', () => {
    const { canvas } = createCanvas();
    const controller = createAnimationController(canvas, new Map());
    const onFrame = vi.fn();
    const onComplete = vi.fn();
    const keyframes = [{ elapsed: 0 }, { elapsed: 100, resultText: 'OK' }];

    controller.start(keyframes, { onFrame, onComplete });
    requestAnimationFrame.mock.calls[0][0](1_000);
    requestAnimationFrame.mock.calls[1][0](1_100);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledTimes(3);
  });
});
