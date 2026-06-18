import { CONFIG } from '../config.js';
import { GamePhase, TurnPhase } from '../types.js';
import { sanitizePlayerName } from '../utils/sanitize.js';

function assertPlayerNames(playerNames) {
  if (!Array.isArray(playerNames)) {
    throw new TypeError('La liste des joueurs doit etre un tableau.');
  }

  if (
    playerNames.length < CONFIG.MIN_PLAYERS ||
    playerNames.length > CONFIG.MAX_PLAYERS
  ) {
    throw new RangeError(
      `La partie exige entre ${CONFIG.MIN_PLAYERS} et ${CONFIG.MAX_PLAYERS} joueurs.`,
    );
  }
}

export function createPlayer(id, name) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('Un joueur doit avoir un identifiant non vide.');
  }

  return {
    id,
    name: sanitizePlayerName(name, CONFIG.PLAYER_NAME_MAX_LENGTH),
    totalScore: 0,
    isEliminated: false,
  };
}

export function createGame(playerNames) {
  assertPlayerNames(playerNames);

  const players = playerNames.map((name, index) =>
    createPlayer(`player-${index + 1}`, name),
  );
  const firstPlayer = players[0];

  return {
    phase: GamePhase.PLAYING,
    players,
    currentPlayerIndex: 0,
    turnId: 1,
    rollId: 0,
    turn: {
      id: 1,
      playerId: firstPlayer.id,
      phase: TurnPhase.ROLLING,
      turnScore: 0,
    },
    winner: null,
    rollHistory: [],
  };
}
