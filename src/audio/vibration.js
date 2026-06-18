// Patterns haptiques associés à chaque évènement de jeu (en millisecondes).
// Le format suit l'API Vibration : [vibration, pause, vibration, ...].
const VIBRATION_PATTERNS = Object.freeze({
  roll: Object.freeze([50]),
  score: Object.freeze([30, 50, 30]),
  bust: Object.freeze([100, 50, 100]),
  jambon: Object.freeze([200, 100, 200, 100, 400]),
  cheval: Object.freeze([500]),
  victory: Object.freeze([100, 50, 100, 50, 100, 50, 300]),
});

/**
 * Vérifie la disponibilité de l'API Vibration.
 * @returns {boolean}
 */
function isVibrationSupported() {
  return (
    typeof globalThis.navigator === 'object' &&
    globalThis.navigator !== null &&
    typeof globalThis.navigator.vibrate === 'function'
  );
}

/**
 * Résout un pattern : accepte soit un type connu (`'roll'`...), soit un
 * tableau/nombre brut transmis tel quel à `navigator.vibrate`.
 * @param {string | number | number[]} pattern
 * @returns {number | number[] | null}
 */
function resolvePattern(pattern) {
  if (typeof pattern === 'string') {
    const preset = VIBRATION_PATTERNS[pattern];

    return preset === undefined ? null : [...preset];
  }

  if (typeof pattern === 'number' && Number.isFinite(pattern) && pattern >= 0) {
    return pattern;
  }

  if (Array.isArray(pattern)) {
    const isValid = pattern.every(
      (value) => Number.isFinite(value) && value >= 0,
    );

    return isValid ? [...pattern] : null;
  }

  return null;
}

/**
 * Crée un gestionnaire de retour haptique mobile.
 *
 * Si l'API `navigator.vibrate` n'existe pas, toutes les méthodes sont des
 * no-op. Le retour haptique respecte l'état muet : l'option `isMuted` permet
 * au contrôleur de couper la vibration en même temps que le son.
 *
 * Hypothèse : la signature de la spec est `createVibrationManager()`. On accepte
 * un objet d'options optionnel pour brancher le prédicat `isMuted` sans casser
 * cette signature.
 *
 * @param {{ isMuted?: () => boolean }} [options]
 * @returns {{ vibrate(pattern: string | number | number[]): void, destroy(): void }}
 */
export function createVibrationManager(options = {}) {
  const isMuted =
    options !== null && typeof options.isMuted === 'function'
      ? options.isMuted
      : () => false;
  let destroyed = false;

  function vibrate(pattern) {
    if (destroyed || isMuted() === true || !isVibrationSupported()) {
      return;
    }

    const resolved = resolvePattern(pattern);

    if (resolved === null) {
      return;
    }

    try {
      globalThis.navigator.vibrate(resolved);
    } catch {
      // Le retour haptique est optionnel : toute erreur est ignorée.
    }
  }

  function destroy() {
    destroyed = true;

    // Annule une éventuelle vibration en cours, si l'API est disponible.
    if (isVibrationSupported()) {
      try {
        globalThis.navigator.vibrate(0);
      } catch {
        // Ignoré : l'arrêt de la vibration est best-effort.
      }
    }
  }

  return { vibrate, destroy };
}
