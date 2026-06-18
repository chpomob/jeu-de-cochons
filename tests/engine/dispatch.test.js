import { describe, expect, it } from 'vitest';

import { dispatch } from '../../src/engine/dispatch.js';
import { createGame } from '../../src/engine/game.js';
import {
  ActionType,
  GamePhase,
  RollResultType,
  SinglePigLanding,
  TurnPhase,
} from '../../src/types.js';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const propertyValue of Object.values(value)) {
    deepFreeze(propertyValue);
  }

  return value;
}

function createScriptedRNG(landings, randomValues = []) {
  let landingIndex = 0;
  let randomIndex = 0;

  return {
    weightedPick(items) {
      const landing = landings[landingIndex];
      landingIndex += 1;

      return items.find((item) => item.landing === landing);
    },

    random() {
      const value = randomValues[randomIndex] ?? 1;
      randomIndex += 1;

      return value;
    },
  };
}

function createGainRNG() {
  return createScriptedRNG(
    [SinglePigLanding.TOURNEDOS, SinglePigLanding.TROTTEUR],
    [1, 1],
  );
}

function rollGain(state) {
  return dispatch(state, {
    type: ActionType.ROLL_REQUESTED,
    rng: createGainRNG(),
  }).state;
}

describe('reducer de jeu', () => {
  it('ROLL_REQUESTED augmente le score de tour et passe en decision', () => {
    const state = deepFreeze(createGame(['Alice', 'Bob']));
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createGainRNG(),
    });

    expect(result.error).toBeNull();
    expect(result.state).not.toBe(state);
    expect(result.state.turn.turnScore).toBe(10);
    expect(result.state.turn.phase).toBe(TurnPhase.DECIDING);
    expect(result.state.rollHistory).toHaveLength(1);
  });

  it('BANK_REQUESTED ajoute le score au total et passe au joueur suivant', () => {
    const rolledState = deepFreeze(rollGain(createGame(['Alice', 'Bob'])));
    const result = dispatch(rolledState, { type: ActionType.BANK_REQUESTED });

    expect(result.error).toBeNull();
    expect(result.state.players[0].totalScore).toBe(10);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.state.turn.playerId).toBe('player-2');
    expect(result.state.turn.phase).toBe(TurnPhase.ROLLING);
  });

  it('BANK_REQUESTED hors decision retourne une erreur', () => {
    const state = deepFreeze(createGame(['Alice', 'Bob']));
    const result = dispatch(state, { type: ActionType.BANK_REQUESTED });

    expect(result.state).toBeNull();
    expect(result.error).toContain('decision');
  });

  it('ROLL_REQUESTED depuis decision relance et cumule le score de tour', () => {
    const state = deepFreeze(rollGain(createGame(['Alice', 'Bob'])));
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createGainRNG(),
    });

    expect(result.error).toBeNull();
    expect(result.state.turn.turnScore).toBe(20);
    expect(result.state.turn.phase).toBe(TurnPhase.DECIDING);
    expect(result.state.currentPlayerIndex).toBe(0);
    expect(result.state.rollHistory).toHaveLength(2);
  });

  it('ROLL_REQUESTED hors lancer ou decision retourne une erreur', () => {
    const state = deepFreeze({
      ...createGame(['Alice', 'Bob']),
      turn: {
        id: 1,
        playerId: 'player-1',
        phase: TurnPhase.TURN_OVER,
        turnScore: 0,
      },
    });
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createGainRNG(),
    });

    expect(result.state).toBeNull();
    expect(result.error).toContain('lancer');
  });

  it('ANIMATION_COMPLETED reste une action de presentation sans effet moteur', () => {
    const state = deepFreeze({
      ...createGame(['Alice', 'Bob']),
      rollId: 4,
    });
    const result = dispatch(state, {
      type: ActionType.ANIMATION_COMPLETED,
      rollId: 3,
    });

    expect(result.error).toBeNull();
    expect(result.state).toEqual(state);
    expect(result.state).not.toBe(state);
  });

  it('Cochon Nul perd le tour et passe au joueur suivant', () => {
    const state = deepFreeze(createGame(['Alice', 'Bob']));
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createScriptedRNG(
        [SinglePigLanding.FLANC, SinglePigLanding.FLANC],
        [0, 1, 1, 1],
      ),
    });

    expect(result.error).toBeNull();
    expect(result.state.turn.turnScore).toBe(0);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.state.turn.phase).toBe(TurnPhase.ROLLING);
    expect(result.state.rollHistory.at(-1).result.type).toBe(
      RollResultType.COCHON_NUL,
    );
  });

  it('Bon Jambon remet le total a zero et passe au joueur suivant', () => {
    const state = deepFreeze({
      ...createGame(['Alice', 'Bob']),
      players: [
        {
          id: 'player-1',
          name: 'Alice',
          totalScore: 50,
          isEliminated: false,
        },
        {
          id: 'player-2',
          name: 'Bob',
          totalScore: 0,
          isEliminated: false,
        },
      ],
    });
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createScriptedRNG(
        [SinglePigLanding.TROTTEUR, SinglePigLanding.TOURNEDOS],
        [0],
      ),
    });

    expect(result.error).toBeNull();
    expect(result.state.players[0].totalScore).toBe(0);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.state.turn.phase).toBe(TurnPhase.ROLLING);
  });

  it('declare la victoire apres une banque qui atteint le seuil', () => {
    const state = deepFreeze({
      ...rollGain(createGame(['Alice', 'Bob'])),
      players: [
        {
          id: 'player-1',
          name: 'Alice',
          totalScore: 95,
          isEliminated: false,
        },
        {
          id: 'player-2',
          name: 'Bob',
          totalScore: 0,
          isEliminated: false,
        },
      ],
    });
    const result = dispatch(state, { type: ActionType.BANK_REQUESTED });

    expect(result.error).toBeNull();
    expect(result.state.phase).toBe(GamePhase.GAME_OVER);
    expect(result.state.winner).toBe('player-1');
    expect(result.state.players[0].totalScore).toBe(105);
  });

  it('Cochon a Cheval elimine le joueur et passe au suivant', () => {
    const state = deepFreeze(createGame(['Alice', 'Bob']));
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createScriptedRNG(
        [SinglePigLanding.TROTTEUR, SinglePigLanding.TOURNEDOS],
        [1, 0],
      ),
    });

    expect(result.error).toBeNull();
    expect(result.state.players[0].isEliminated).toBe(true);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.state.turn.phase).toBe(TurnPhase.TURN_OVER);
    expect(result.state.phase).toBe(GamePhase.GAME_OVER);
    expect(result.state.winner).toBe('player-2');
  });

  it('termine automatiquement si un seul joueur reste en jeu', () => {
    const baseState = createGame(['Alice', 'Bob', 'Claire']);
    const state = deepFreeze({
      ...baseState,
      players: [
        baseState.players[0],
        { ...baseState.players[1], isEliminated: true },
        baseState.players[2],
      ],
    });
    const result = dispatch(state, {
      type: ActionType.ROLL_REQUESTED,
      rng: createScriptedRNG(
        [SinglePigLanding.TROTTEUR, SinglePigLanding.TOURNEDOS],
        [1, 0],
      ),
    });

    expect(result.error).toBeNull();
    expect(result.state.phase).toBe(GamePhase.GAME_OVER);
    expect(result.state.winner).toBe('player-3');
  });

  it('simule une partie complete jusqu a une victoire au score', () => {
    let state = createGame(['Alice', 'Bob']);
    const rng = createScriptedRNG(
      [
        SinglePigLanding.BAJOUE,
        SinglePigLanding.BAJOUE,
        SinglePigLanding.BAJOUE,
        SinglePigLanding.BAJOUE,
        SinglePigLanding.BAJOUE,
        SinglePigLanding.BAJOUE,
      ],
      [1, 1, 1, 1, 1, 1],
    );

    while (state.phase !== GamePhase.GAME_OVER) {
      const rollResult = dispatch(state, {
        type: ActionType.ROLL_REQUESTED,
        rng,
      });

      expect(rollResult.error).toBeNull();
      state = rollResult.state;

      if (state.phase === GamePhase.PLAYING) {
        const bankResult = dispatch(state, {
          type: ActionType.BANK_REQUESTED,
        });

        expect(bankResult.error).toBeNull();
        state = bankResult.state;
      }
    }

    const winner = state.players.find((player) => player.id === state.winner);

    expect(winner.totalScore).toBeGreaterThanOrEqual(100);
  });
});
