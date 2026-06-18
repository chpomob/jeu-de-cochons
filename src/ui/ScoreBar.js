import { CONFIG } from '../config.js';

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function getLeaderIndex(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }

  let leaderIndex = null;
  let leaderScore = -Infinity;
  let hasTie = false;

  players.forEach((player, index) => {
    const totalScore = Number.isFinite(player.totalScore)
      ? player.totalScore
      : 0;

    if (totalScore > leaderScore) {
      leaderScore = totalScore;
      leaderIndex = index;
      hasTie = false;
      return;
    }

    if (totalScore === leaderScore) {
      hasTie = true;
    }
  });

  return leaderScore > 0 && hasTie === false ? leaderIndex : null;
}

function getPlayerId(player, index) {
  return typeof player.id === 'string' && player.id !== ''
    ? player.id
    : `player-${index + 1}`;
}

function createPlayerBlock(player, index) {
  const block = createElement('li', 'score-player');
  const name = createElement('span', 'score-player-name');
  const score = createElement('span', 'score-player-points');
  const status = createElement('span', 'score-player-status');
  const id = getPlayerId(player, index);

  block.dataset.playerId = id;
  block.dataset.testid = `score-player-${index}`;
  score.dataset.testid = `score-player-${index}-points`;
  status.setAttribute('aria-hidden', 'true');
  block.append(name, score, status);

  return block;
}

function updatePlayerBlock(block, player, index, currentPlayerIndex, leaderIndex) {
  const name = block.querySelector('.score-player-name');
  const score = block.querySelector('.score-player-points');
  const status = block.querySelector('.score-player-status');
  const playerName = String(player.name ?? CONFIG.TEXTS.ui.unavailable);
  const totalScore = Number.isFinite(player.totalScore) ? player.totalScore : 0;
  const isActive = index === currentPlayerIndex;
  const isLeader = leaderIndex === index;

  block.classList.toggle('active', isActive);
  block.classList.toggle('leader', isLeader);
  block.classList.toggle('eliminated', player.isEliminated === true);
  block.setAttribute(
    'aria-label',
    `${playerName}, ${CONFIG.TEXTS.ui.totalScore} ${totalScore}`,
  );

  if (isActive) {
    block.setAttribute('aria-current', 'true');
  } else {
    block.removeAttribute('aria-current');
  }

  name.textContent = playerName;
  name.title = playerName;
  score.textContent = String(totalScore);
  status.textContent = player.isEliminated === true ? '×' : '';
  status.setAttribute(
    'aria-label',
    player.isEliminated === true ? CONFIG.TEXTS.ui.eliminated : '',
  );
}

export function renderScoreBar(container, players, currentPlayerIndex) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur des scores doit être un élément DOM.');
  }

  const list = createElement('ol', 'score-bar');

  list.setAttribute('aria-label', CONFIG.TEXTS.ui.scoreBoardLabel);
  container.append(list);

  function update(nextPlayers, nextCurrentPlayerIndex) {
    if (!Array.isArray(nextPlayers)) {
      throw new TypeError('La barre de scores exige une liste de joueurs.');
    }

    const leaderIndex = getLeaderIndex(nextPlayers);
    const existingBlocks = new Map(
      [...list.children].map((child) => [child.dataset.playerId, child]),
    );
    const nextPlayerIds = new Set();

    nextPlayers.forEach((player, index) => {
      const expectedId = getPlayerId(player, index);
      let block = existingBlocks.get(expectedId);

      nextPlayerIds.add(expectedId);

      if (block === undefined) {
        block = createPlayerBlock(player, index);
      }

      if (list.children[index] !== block) {
        list.insertBefore(block, list.children[index] ?? null);
      }

      updatePlayerBlock(
        block,
        player,
        index,
        nextCurrentPlayerIndex,
        leaderIndex,
      );
    });

    for (const block of [...list.children]) {
      if (!nextPlayerIds.has(block.dataset.playerId)) {
        block.remove();
      }
    }
  }

  function findBlockByPlayerId(playerId) {
    if (typeof playerId !== 'string' || playerId === '') {
      return null;
    }

    return [...list.children].find(
      (child) => child.dataset.playerId === playerId,
    ) ?? null;
  }

  function shake(playerId) {
    const block = findBlockByPlayerId(playerId);

    if (block === null) {
      return;
    }

    // Retire puis réapplique la classe pour relancer l'animation même si le
    // joueur enchaîne deux catastrophes consécutives.
    block.classList.remove('shake');
    // Force un reflow afin que la suppression soit prise en compte avant l'ajout.
    void block.offsetWidth;
    block.classList.add('shake');
  }

  update(players, currentPlayerIndex);

  return { update, shake };
}
