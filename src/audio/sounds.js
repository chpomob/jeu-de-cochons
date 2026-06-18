import { CONFIG } from '../config.js';
import { loadState, saveState } from '../utils/storage.js';

// Gain global appliqué à tous les sons pour éviter la saturation.
const MASTER_GAIN = 0.55;
// Plancher utilisé pour les rampes exponentielles (qui interdisent la valeur 0).
const SILENCE = 0.0001;

/**
 * Récupère le constructeur d'AudioContext disponible (préfixe webkit inclus).
 * @returns {typeof AudioContext | null}
 */
function getAudioContextConstructor() {
  if (typeof globalThis.AudioContext === 'function') {
    return globalThis.AudioContext;
  }

  // Hypothèse : certains navigateurs WebKit n'exposent que webkitAudioContext.
  if (typeof globalThis.webkitAudioContext === 'function') {
    return globalThis.webkitAudioContext;
  }

  return null;
}

/**
 * Programme une note simple (oscillateur + enveloppe ADSR courte).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {object} options
 */
function scheduleTone(ctx, destination, { frequency, start, duration, peak, type }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type ?? 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(SILENCE, start);
  gain.gain.exponentialRampToValueAtTime(peak ?? 0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration);

  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration);

  return [oscillator];
}

/**
 * Programme un glissando (variation continue de fréquence).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {object} options
 */
function scheduleGlide(ctx, destination, { fromFrequency, toFrequency, start, duration, peak, type }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type ?? 'sine';
  oscillator.frequency.setValueAtTime(fromFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(SILENCE, toFrequency),
    start + duration,
  );

  gain.gain.setValueAtTime(SILENCE, start);
  gain.gain.exponentialRampToValueAtTime(peak ?? 0.3, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration);

  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration);

  return [oscillator];
}

/**
 * Programme une salve de bruit blanc filtrée (utilisée pour le cliquetis).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {object} options
 */
function scheduleNoiseBurst(ctx, destination, { start, duration, frequency, q, peak }) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency ?? 1800, start);
  filter.Q.setValueAtTime(q ?? 0.8, start);

  gain.gain.setValueAtTime(SILENCE, start);
  gain.gain.exponentialRampToValueAtTime(peak ?? 0.5, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration);

  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + duration);

  return [source];
}

// --- Générateurs de sons (durée indicative en commentaire) ------------------

function playRoll(ctx, destination) {
  // ~200 ms : cliquetis de cochons lancés (bruit blanc filtré).
  const now = ctx.currentTime;
  return scheduleNoiseBurst(ctx, destination, {
    start: now,
    duration: 0.18,
    frequency: 1700,
    q: 0.7,
    peak: 0.5,
  });
}

function playScore(ctx, destination) {
  // ~300 ms : deux notes montantes (do5 → mi5).
  const now = ctx.currentTime;
  return [
    ...scheduleTone(ctx, destination, { frequency: 523.25, start: now, duration: 0.15, peak: 0.32 }),
    ...scheduleTone(ctx, destination, { frequency: 659.25, start: now + 0.15, duration: 0.16, peak: 0.32 }),
  ];
}

function playBust(ctx, destination) {
  // ~400 ms : wah-wah descendant (400 Hz → 200 Hz).
  const now = ctx.currentTime;
  return scheduleGlide(ctx, destination, {
    fromFrequency: 400,
    toFrequency: 200,
    start: now,
    duration: 0.4,
    peak: 0.3,
    type: 'sawtooth',
  });
}

function playJambon(ctx, destination) {
  // ~500 ms : crash sourd (basse fréquence descendante + impact bruité).
  const now = ctx.currentTime;
  return [
    ...scheduleGlide(ctx, destination, {
      fromFrequency: 130,
      toFrequency: 45,
      start: now,
      duration: 0.5,
      peak: 0.5,
      type: 'square',
    }),
    ...scheduleNoiseBurst(ctx, destination, {
      start: now,
      duration: 0.16,
      frequency: 400,
      q: 0.5,
      peak: 0.4,
    }),
  ];
}

function playCheval(ctx, destination) {
  // ~600 ms : hennissement stylisé (fréquences aiguës modulées par un LFO).
  const now = ctx.currentTime;
  const duration = 0.6;
  const carrier = ctx.createOscillator();
  const carrierGain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  carrier.type = 'triangle';
  carrier.frequency.setValueAtTime(880, now);
  carrier.frequency.exponentialRampToValueAtTime(660, now + duration);

  // LFO de vibrato : module la fréquence porteuse pour imiter le hennissement.
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(18, now);
  lfoGain.gain.setValueAtTime(120, now);
  lfo.connect(lfoGain).connect(carrier.frequency);

  carrierGain.gain.setValueAtTime(SILENCE, now);
  carrierGain.gain.exponentialRampToValueAtTime(0.32, now + 0.05);
  carrierGain.gain.exponentialRampToValueAtTime(SILENCE, now + duration);

  carrier.connect(carrierGain).connect(destination);
  carrier.start(now);
  carrier.stop(now + duration);
  lfo.start(now);
  lfo.stop(now + duration);

  return [carrier, lfo];
}

function playVictory(ctx, destination) {
  // ~800 ms : fanfare / arpège ascendant (do5, mi5, sol5, do6).
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  return notes.flatMap((frequency, index) =>
    scheduleTone(ctx, destination, {
      frequency,
      start: now + index * 0.18,
      duration: 0.24,
      peak: 0.3,
      type: 'triangle',
    }),
  );
}

const SOUND_GENERATORS = Object.freeze({
  roll: playRoll,
  score: playScore,
  bust: playBust,
  jambon: playJambon,
  cheval: playCheval,
  victory: playVictory,
});

/**
 * Lit l'état muet persisté ; tolère toute défaillance du stockage.
 * @returns {boolean}
 */
function readPersistedMuted() {
  try {
    return loadState(CONFIG.STORAGE_KEY).settings.muted === true;
  } catch {
    return false;
  }
}

/**
 * Persiste l'état muet sans écraser les autres réglages.
 * @param {boolean} muted
 */
function persistMuted(muted) {
  try {
    const state = loadState(CONFIG.STORAGE_KEY);
    state.settings.muted = muted === true;
    saveState(CONFIG.STORAGE_KEY, state);
  } catch {
    // Le son ne doit jamais faire échouer le jeu : on ignore l'erreur.
  }
}

/**
 * Crée un gestionnaire de sons reposant uniquement sur la Web Audio API.
 *
 * L'AudioContext est initialisé paresseusement au premier `play()` afin de
 * respecter la politique d'autoplay des navigateurs (un geste utilisateur est
 * requis). Si la Web Audio API est absente, toutes les méthodes sont des no-op.
 *
 * @returns {{ play(type: string): void, setMuted(muted: boolean): void, isMuted(): boolean, silence(): void, destroy(): void }}
 */
export function createSoundManager() {
  let muted = readPersistedMuted();
  let audioContext = null;
  let masterGain = null;
  const activeNodes = new Set();
  let destroyed = false;

  function setMasterGain(value) {
    if (audioContext === null || masterGain === null) {
      return;
    }

    const gainParam = masterGain.gain;
    const now = audioContext.currentTime;

    if (typeof gainParam.cancelScheduledValues === 'function') {
      gainParam.cancelScheduledValues(now);
    }

    gainParam.setValueAtTime(value, now);
  }

  function stopActiveNodes() {
    for (const node of activeNodes) {
      try {
        node.stop();
      } catch {
        // Le noeud peut deja etre arrete ; couper le son reste best-effort.
      }
    }

    activeNodes.clear();
  }

  function silence() {
    setMasterGain(SILENCE);
    stopActiveNodes();
  }

  function registerActiveNodes(nodes) {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const node of nodes) {
      if (node === null || typeof node !== 'object' || typeof node.stop !== 'function') {
        continue;
      }

      const previousOnEnded = typeof node.onended === 'function' ? node.onended : null;

      activeNodes.add(node);
      node.onended = (...args) => {
        activeNodes.delete(node);

        if (previousOnEnded !== null) {
          previousOnEnded.apply(node, args);
        }
      };
    }
  }

  /**
   * Initialise (ou réutilise) l'AudioContext et son nœud de gain maître.
   * @returns {{ ctx: BaseAudioContext, master: AudioNode } | null}
   */
  function ensureAudioGraph() {
    if (destroyed) {
      return null;
    }

    if (audioContext !== null && masterGain !== null) {
      return { ctx: audioContext, master: masterGain };
    }

    const AudioContextCtor = getAudioContextConstructor();

    if (AudioContextCtor === null) {
      return null;
    }

    try {
      audioContext = new AudioContextCtor();
      masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(
        muted ? SILENCE : MASTER_GAIN,
        audioContext.currentTime,
      );
      masterGain.connect(audioContext.destination);

      return { ctx: audioContext, master: masterGain };
    } catch {
      audioContext = null;
      masterGain = null;

      return null;
    }
  }

  /**
   * Réveille l'AudioContext s'il a été suspendu par le navigateur.
   * @param {BaseAudioContext} ctx
   */
  function resumeIfSuspended(ctx) {
    if (ctx.state !== 'suspended' || typeof ctx.resume !== 'function') {
      return;
    }

    const result = ctx.resume();

    if (result !== undefined && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  }

  function play(type) {
    if (destroyed || muted) {
      return;
    }

    const generator = SOUND_GENERATORS[type];

    if (generator === undefined) {
      // Type inconnu : no-op silencieux pour rester défensif.
      return;
    }

    const graph = ensureAudioGraph();

    if (graph === null) {
      return;
    }

    try {
      resumeIfSuspended(graph.ctx);
      setMasterGain(MASTER_GAIN);
      registerActiveNodes(generator(graph.ctx, graph.master));
    } catch {
      // Une défaillance audio ne doit jamais interrompre le jeu.
    }
  }

  function setMuted(nextMuted) {
    muted = nextMuted === true;
    persistMuted(muted);

    if (muted) {
      silence();
      return;
    }

    setMasterGain(MASTER_GAIN);
  }

  function isMuted() {
    return muted;
  }

  function destroy() {
    destroyed = true;
    muted = true;

    if (audioContext !== null && typeof audioContext.close === 'function') {
      const result = audioContext.close();

      if (result !== undefined && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    }

    audioContext = null;
    masterGain = null;
    activeNodes.clear();
  }

  return { play, setMuted, isMuted, silence, destroy };
}
