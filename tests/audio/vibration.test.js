import { afterEach, describe, expect, it, vi } from 'vitest';

import { createVibrationManager } from '../../src/audio/vibration.js';

function installVibrate(implementation = vi.fn(() => true)) {
  const original = Object.getOwnPropertyDescriptor(navigator, 'vibrate');

  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: implementation,
  });

  return () => {
    if (original === undefined) {
      delete navigator.vibrate;
    } else {
      Object.defineProperty(navigator, 'vibrate', original);
    }
  };
}

describe('createVibrationManager', () => {
  let restore = null;

  afterEach(() => {
    if (restore !== null) {
      restore();
      restore = null;
    }
  });

  it('reste un no-op silencieux quand navigator.vibrate est absent', () => {
    // jsdom n'expose pas vibrate par défaut : aucun appel ne doit échouer.
    const manager = createVibrationManager();

    expect(() => manager.vibrate('roll')).not.toThrow();
    expect(() => manager.destroy()).not.toThrow();
  });

  it('résout les patterns nommés vers les durées attendues', () => {
    const vibrate = vi.fn(() => true);
    restore = installVibrate(vibrate);

    const manager = createVibrationManager();

    manager.vibrate('roll');
    manager.vibrate('jambon');

    expect(vibrate).toHaveBeenNthCalledWith(1, [50]);
    expect(vibrate).toHaveBeenNthCalledWith(2, [200, 100, 200, 100, 400]);
  });

  it('transmet un tableau brut valide tel quel', () => {
    const vibrate = vi.fn(() => true);
    restore = installVibrate(vibrate);

    const manager = createVibrationManager();

    manager.vibrate([10, 20, 30]);

    expect(vibrate).toHaveBeenCalledWith([10, 20, 30]);
  });

  it('ignore un type inconnu et un pattern invalide', () => {
    const vibrate = vi.fn(() => true);
    restore = installVibrate(vibrate);

    const manager = createVibrationManager();

    manager.vibrate('inconnu');
    manager.vibrate([Number.NaN, -1]);

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('respecte l’état muet fourni par isMuted', () => {
    const vibrate = vi.fn(() => true);
    restore = installVibrate(vibrate);

    let muted = true;
    const manager = createVibrationManager({ isMuted: () => muted });

    manager.vibrate('score');
    expect(vibrate).not.toHaveBeenCalled();

    muted = false;
    manager.vibrate('score');
    expect(vibrate).toHaveBeenCalledWith([30, 50, 30]);
  });

  it('ne vibre plus après destroy', () => {
    const vibrate = vi.fn(() => true);
    restore = installVibrate(vibrate);

    const manager = createVibrationManager();

    manager.destroy();
    vibrate.mockClear();
    manager.vibrate('victory');

    expect(vibrate).not.toHaveBeenCalled();
  });
});
