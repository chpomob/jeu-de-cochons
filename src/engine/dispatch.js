import { CONFIG } from '../config.js';
import {
  ActionType,
  GamePhase,
  RollEffect,
  TurnPhase,
} from '../types.js';
import { evaluateRoll } from './evaluate.js';
import { rollTwoPigs } from './roll.js';

function clonePig(pig) {
  return {
    landing: pig.landing,
    flankSide: pig.flankSide,
  };
}

function cloneRollResult(result) {
  return {
    type: result.type,
    effect: result.effect,
    points: result.points,
    pig1: clonePig(result.pig1),
    pig2: clonePig(result.pig2),
  };
}

function cloneHistoryEntry(entry) {
  return {
    rollId: entry.rollId,
    turnId: entry.turnId,
    playerId: entry.playerId,
    result: cloneRollResult(entry.result),
  };
}

function cloneState(state) {
  return {
    phase: state.phase,
    players: state.players.map((player) => ({ ...player })),
    currentPlayerIndex: state.currentPlayerIndex,
    turnId: state.turnId,
    rollId: state.rollId,
    turn: { ...state.turn },
    winner: state.winner,
    rollHistory: state.rollHistory.map(cloneHistoryEntry),
  };
}

function success(state) {
  return { state, error: null };
}

function failure(error) {
  return { state: null, error };
}

function getCurrentPlayer(state) {
  return state.players[state.currentPlayerIndex] ?? null;
}

function countSurvivors(players) {
  return players.filter((player) => !player.isEliminated);
}

function finishIfNeeded(state) {
  const survivors = countSurvivors(state.players);

  if (survivors.length > 1) {
    return state;
  }

  const winnerIndex =
    survivors.length === 1
      ? state.players.findIndex((player) => player.id === survivors[0].id)
      : state.currentPlayerIndex;

  return {
    ...state,
    phase: GamePhase.GAME_OVER,
    currentPlayerIndex: winnerIndex,
    winner: survivors[0]?.id ?? null,
    turn: {
      ...state.turn,
      phase: TurnPhase.TURN_OVER,
      turnScore: 0,
    },
  };
}

function startNextTurn(state) {
  const endedState = finishIfNeeded(state);

  if (endedState.phase === GamePhase.GAME_OVER) {
    return endedState;
  }

  const playerCount = endedState.players.length;

  for (let offset = 1; offset <= playerCount; offset += 1) {
    const nextPlayerIndex = (endedState.currentPlayerIndex + offset) % playerCount;
    const nextPlayer = endedState.players[nextPlayerIndex];

    if (!nextPlayer.isEliminated) {
      const nextTurnId = endedState.turnId + 1;

      return {
        ...endedState,
        currentPlayerIndex: nextPlayerIndex,
        turnId: nextTurnId,
        turn: {
          id: nextTurnId,
          playerId: nextPlayer.id,
          phase: TurnPhase.ROLLING,
          turnScore: 0,
        },
      };
    }
  }

  return {
    ...endedState,
    phase: GamePhase.GAME_OVER,
    winner: null,
    turn: {
      ...endedState.turn,
      phase: TurnPhase.TURN_OVER,
      turnScore: 0,
    },
  };
}

function appendRollHistory(state, rollId, result) {
  return [
    ...state.rollHistory,
    {
      rollId,
      turnId: state.turnId,
      playerId: state.turn.playerId,
      result: cloneRollResult(result),
    },
  ];
}

function applyGain(state, rollId, result) {
  return {
    ...state,
    rollId,
    turn: {
      ...state.turn,
      phase: TurnPhase.DECIDING,
      turnScore: state.turn.turnScore + result.points,
    },
    rollHistory: appendRollHistory(state, rollId, result),
  };
}

function applyTurnLoss(state, rollId, result) {
  return startNextTurn({
    ...state,
    rollId,
    turn: {
      ...state.turn,
      phase: TurnPhase.TURN_OVER,
      turnScore: 0,
    },
    rollHistory: appendRollHistory(state, rollId, result),
  });
}

function applyTotalLoss(state, rollId, result) {
  const players = state.players.map((player, index) =>
    index === state.currentPlayerIndex ? { ...player, totalScore: 0 } : player,
  );

  return startNextTurn({
    ...state,
    players,
    rollId,
    turn: {
      ...state.turn,
      phase: TurnPhase.TURN_OVER,
      turnScore: 0,
    },
    rollHistory: appendRollHistory(state, rollId, result),
  });
}

function applyElimination(state, rollId, result) {
  const players = state.players.map((player, index) =>
    index === state.currentPlayerIndex
      ? { ...player, isEliminated: true }
      : player,
  );

  return startNextTurn({
    ...state,
    players,
    rollId,
    turn: {
      ...state.turn,
      phase: TurnPhase.TURN_OVER,
      turnScore: 0,
    },
    rollHistory: appendRollHistory(state, rollId, result),
  });
}

function reduceRollRequested(inputState, action) {
  if (inputState.phase !== GamePhase.PLAYING) {
    return failure('Impossible de lancer hors partie en cours.');
  }

  if (
    inputState.turn.phase !== TurnPhase.ROLLING &&
    inputState.turn.phase !== TurnPhase.DECIDING
  ) {
    return failure('Impossible de lancer hors phase de lancer.');
  }

  const currentPlayer = getCurrentPlayer(inputState);

  if (currentPlayer === null || currentPlayer.isEliminated) {
    return failure('Le joueur courant ne peut pas lancer.');
  }

  const state = cloneState(inputState);
  const rolledPigs = rollTwoPigs(action.rng);
  const result = evaluateRoll(rolledPigs.pig1, rolledPigs.pig2, action.rng);
  const nextRollId = state.rollId + 1;

  if (result.effect === RollEffect.GAIN_POINTS) {
    return success(applyGain(state, nextRollId, result));
  }

  if (result.effect === RollEffect.PERTE_TOUR) {
    return success(applyTurnLoss(state, nextRollId, result));
  }

  if (result.effect === RollEffect.PERTE_TOTALE) {
    return success(applyTotalLoss(state, nextRollId, result));
  }

  if (result.effect === RollEffect.ELIMINATION) {
    return success(applyElimination(state, nextRollId, result));
  }

  return failure('Effet de lancer inconnu.');
}

function reducePresentationOnlyAction(inputState) {
  return success(cloneState(inputState));
}

function reduceBankRequested(inputState) {
  if (inputState.phase !== GamePhase.PLAYING) {
    return failure('Impossible de garder les points hors partie en cours.');
  }

  if (inputState.turn.phase !== TurnPhase.DECIDING) {
    return failure('Impossible de garder les points hors phase de decision.');
  }

  const state = cloneState(inputState);
  const players = state.players.map((player, index) =>
    index === state.currentPlayerIndex
      ? {
        ...player,
        totalScore: player.totalScore + state.turn.turnScore,
      }
      : player,
  );
  const currentPlayer = players[state.currentPlayerIndex];

  if (currentPlayer.totalScore >= CONFIG.VICTORY_THRESHOLD) {
    return success({
      ...state,
      players,
      phase: GamePhase.GAME_OVER,
      winner: currentPlayer.id,
      turn: {
        ...state.turn,
        phase: TurnPhase.TURN_OVER,
        turnScore: 0,
      },
    });
  }

  return success(
    startNextTurn({
      ...state,
      players,
      turn: {
        ...state.turn,
        phase: TurnPhase.TURN_OVER,
        turnScore: 0,
      },
    }),
  );
}

export function dispatch(state, action) {
  try {
    if (state === null || typeof state !== 'object') {
      return failure('Etat de jeu invalide.');
    }

    if (action === null || typeof action !== 'object') {
      return failure('Action invalide.');
    }

    if (action.type === ActionType.ROLL_REQUESTED) {
      return reduceRollRequested(state, action);
    }

    if (
      action.type === ActionType.ANIMATION_COMPLETED ||
      action.type === ActionType.SKIP_ANIMATION
    ) {
      return reducePresentationOnlyAction(state);
    }

    if (action.type === ActionType.BANK_REQUESTED) {
      return reduceBankRequested(state);
    }

    return failure('Type action inconnu.');
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Erreur inconnue.');
  }
}
