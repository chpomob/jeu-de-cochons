const UINT32_MAX_PLUS_ONE = 4294967296;
const MULBERRY32_INCREMENT = 0x6d2b79f5;

function hashSeed(seed) {
  const seedText = String(seed);
  let hash = 2166136261;

  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createMulberry32(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (state + MULBERRY32_INCREMENT) | 0;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  };
}

function normalizeSeed(seed) {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new TypeError('La graine numerique doit etre finie.');
    }

    return seed >>> 0;
  }

  if (typeof seed === 'string') {
    return hashSeed(seed);
  }

  throw new TypeError('La graine doit etre un nombre ou une chaine.');
}

function assertWeightedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('weightedPick attend un tableau non vide.');
  }

  let totalWeight = 0;

  for (const item of items) {
    if (item === null || typeof item !== 'object') {
      throw new TypeError('Chaque item pondere doit etre un objet.');
    }

    if (!Number.isFinite(item.weight) || item.weight <= 0) {
      throw new TypeError('Chaque poids doit etre un nombre positif fini.');
    }

    totalWeight += item.weight;
  }

  return totalWeight;
}

export function createRNG(seed) {
  const hasSeed = seed !== undefined && seed !== null;
  const randomSource = hasSeed
    ? createMulberry32(normalizeSeed(seed))
    : Math.random;

  return Object.freeze({
    random() {
      return randomSource();
    },

    weightedPick(items) {
      const totalWeight = assertWeightedItems(items);
      const target = randomSource() * totalWeight;
      let cumulativeWeight = 0;

      for (const item of items) {
        cumulativeWeight += item.weight;

        if (target < cumulativeWeight) {
          return item;
        }
      }

      return items.at(-1);
    },
  });
}
