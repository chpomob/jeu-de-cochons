import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSoundManager } from '../../src/audio/sounds.js';
import { CONFIG } from '../../src/config.js';
import { loadState } from '../../src/utils/storage.js';

// --- Faux AudioContext minimal couvrant l'API utilisée par sounds.js --------

function createAudioParam() {
  return {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function createNode() {
  // connect renvoie la cible pour permettre le chaînage `.connect(a).connect(b)`.
  return {
    connect: vi.fn((target) => target),
    start: vi.fn(),
    stop: vi.fn(),
    gain: createAudioParam(),
    frequency: createAudioParam(),
    Q: createAudioParam(),
    type: 'sine',
    buffer: null,
  };
}

let instanceCount = 0;
const audioContexts = [];

class FakeAudioContext {
  constructor() {
    instanceCount += 1;
    audioContexts.push(this);
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = createNode();
    this.gainNodes = [];
    this.resume = vi.fn(() => Promise.resolve());
    this.close = vi.fn(() => Promise.resolve());
  }

  createGain() {
    const node = createNode();

    this.gainNodes.push(node);

    return node;
  }

  createOscillator() {
    return createNode();
  }

  createBiquadFilter() {
    return createNode();
  }

  createBufferSource() {
    return createNode();
  }

  createBuffer(channels, length) {
    return {
      getChannelData: () => new Float32Array(length),
    };
  }
}

function installAudioContext() {
  const original = globalThis.AudioContext;

  globalThis.AudioContext = FakeAudioContext;

  return () => {
    globalThis.AudioContext = original;
  };
}

describe('createSoundManager', () => {
  let restore = null;

  beforeEach(() => {
    instanceCount = 0;
    audioContexts.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    if (restore !== null) {
      restore();
      restore = null;
    }
  });

  it('reste un no-op quand la Web Audio API est absente', () => {
    const manager = createSoundManager();

    expect(manager.isMuted()).toBe(false);
    expect(() => manager.play('roll')).not.toThrow();
    expect(() => manager.destroy()).not.toThrow();
  });

  it('initialise l’AudioContext paresseusement au premier play', () => {
    restore = installAudioContext();

    const manager = createSoundManager();

    expect(instanceCount).toBe(0);

    manager.play('roll');
    expect(instanceCount).toBe(1);

    // Les lectures suivantes réutilisent le même contexte.
    manager.play('score');
    expect(instanceCount).toBe(1);

    manager.destroy();
  });

  it('ne crée aucun contexte si le son est muet', () => {
    restore = installAudioContext();

    const manager = createSoundManager();
    manager.setMuted(true);

    manager.play('roll');

    expect(instanceCount).toBe(0);
  });

  it('joue chaque type connu sans erreur et ignore les types inconnus', () => {
    restore = installAudioContext();

    const manager = createSoundManager();

    for (const type of ['roll', 'score', 'bust', 'jambon', 'cheval', 'victory']) {
      expect(() => manager.play(type)).not.toThrow();
    }

    manager.play('type-inconnu');
    expect(instanceCount).toBe(1);

    manager.destroy();
  });

  it('persiste l’état muet dans le stockage local', () => {
    const manager = createSoundManager();

    manager.setMuted(true);

    expect(manager.isMuted()).toBe(true);
    expect(loadState(CONFIG.STORAGE_KEY).settings.muted).toBe(true);

    // Un nouveau gestionnaire relit l'état persisté.
    const reloaded = createSoundManager();
    expect(reloaded.isMuted()).toBe(true);
  });

  it('coupe les sons actifs quand le gestionnaire devient muet', () => {
    restore = installAudioContext();

    const manager = createSoundManager();
    manager.play('victory');

    const context = audioContexts[0];
    const masterGain = context.gainNodes[0];

    manager.setMuted(true);

    expect(manager.isMuted()).toBe(true);
    expect(instanceCount).toBe(1);
    expect(masterGain.gain.cancelScheduledValues).toHaveBeenCalledWith(0);
    expect(masterGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.0001, 0);
  });

  it('ne joue plus rien après destroy', () => {
    restore = installAudioContext();

    const manager = createSoundManager();
    manager.play('roll');
    manager.destroy();

    instanceCount = 0;
    manager.play('victory');

    expect(instanceCount).toBe(0);
  });
});
