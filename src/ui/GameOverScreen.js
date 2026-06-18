import { CONFIG } from '../config.js';

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function getSortedPlayers(players) {
  return [...players].sort((left, right) => {
    const scoreDelta = right.totalScore - left.totalScore;

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return String(left.name).localeCompare(String(right.name), 'fr-FR');
  });
}

function getWinnerName(players, winnerId) {
  return (
    players.find((player) => player.id === winnerId)?.name ??
    CONFIG.TEXTS.ui.unknownWinner
  );
}

function createScoreRow(player, rank) {
  const row = document.createElement('tr');
  const rankCell = document.createElement('td');
  const nameCell = document.createElement('td');
  const scoreCell = document.createElement('td');
  const statusCell = document.createElement('td');

  rankCell.textContent = String(rank);
  nameCell.textContent = String(player.name ?? CONFIG.TEXTS.ui.unavailable);
  scoreCell.textContent = String(
    Number.isFinite(player.totalScore) ? player.totalScore : 0,
  );
  statusCell.textContent =
    player.isEliminated === true ? CONFIG.TEXTS.ui.eliminated : '';

  row.append(rankCell, nameCell, scoreCell, statusCell);

  return row;
}

export function renderGameOverScreen(container, players, winnerId, callbacks) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur de fin de partie doit être un élément DOM.');
  }

  if (!Array.isArray(players)) {
    throw new TypeError('L’écran de fin exige une liste de joueurs.');
  }

  if (
    callbacks === null ||
    typeof callbacks !== 'object' ||
    typeof callbacks.onRestartGame !== 'function'
  ) {
    throw new TypeError('L’écran de fin exige un callback onRestartGame.');
  }

  const screen = createElement(
    'section',
    'game-over-screen screen screen-fade-in',
  );
  const title = createElement('h1', 'screen-title');
  const winnerBlock = createElement('div', 'winner-block');
  const winnerLabel = createElement('p', 'winner-label');
  const winnerName = createElement('p', 'winner-name');
  const scoreTitle = createElement('h2', 'panel-title');
  const table = createElement('table', 'score-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const tbody = document.createElement('tbody');
  const restartButton = createElement('button', 'ui-button ui-button-primary');
  const sortedPlayers = getSortedPlayers(players);
  const headers = [
    CONFIG.TEXTS.ui.rankLabel,
    CONFIG.TEXTS.ui.playerNameLabel,
    CONFIG.TEXTS.ui.totalScore,
    CONFIG.TEXTS.ui.eliminated,
  ];

  title.textContent = CONFIG.TEXTS.ui.gameOverTitle;
  winnerLabel.textContent = CONFIG.TEXTS.ui.winnerLabel;
  winnerName.textContent = getWinnerName(players, winnerId);
  winnerName.dataset.testid = 'winner-name';
  scoreTitle.textContent = CONFIG.TEXTS.ui.scoresTitle;
  restartButton.type = 'button';
  restartButton.textContent = CONFIG.TEXTS.ui.newGameButton;
  restartButton.dataset.testid = 'btn-replay';

  for (const header of headers) {
    const headerCell = document.createElement('th');

    headerCell.scope = 'col';
    headerCell.textContent = header;
    headerRow.append(headerCell);
  }

  sortedPlayers.forEach((player, index) => {
    tbody.append(createScoreRow(player, index + 1));
  });

  thead.append(headerRow);
  table.append(thead, tbody);
  winnerBlock.append(winnerLabel, winnerName);
  screen.append(title, winnerBlock, scoreTitle, table, restartButton);
  container.append(screen);

  function handleRestart() {
    callbacks.onRestartGame();
  }

  restartButton.addEventListener('click', handleRestart);

  return {
    destroy() {
      restartButton.removeEventListener('click', handleRestart);
      screen.remove();
    },
  };
}
