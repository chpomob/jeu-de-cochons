import { CONFIG } from '../config.js';
import { sanitizePlayerName } from '../utils/sanitize.js';
import { loadState, saveState } from '../utils/storage.js';

const PLAYER_COUNT_OPTIONS = Array.from(
  { length: CONFIG.MAX_PLAYERS - CONFIG.MIN_PLAYERS + 1 },
  (_, index) => CONFIG.MIN_PLAYERS + index,
);

// Multiplicateurs de durée d'animation (1.0 = vitesse normale).
// Hypothèse : la spec décrit des ressentis (Rapide ~0,5×, Lent ~2×) tout en
// imposant « 1.0 = normal » ; on stocke donc le multiplicateur, pas une durée.
const ANIMATION_SPEED_OPTIONS = Object.freeze([
  Object.freeze({ value: 0.5, label: CONFIG.TEXTS.ui.animationSpeedFast }),
  Object.freeze({ value: 1, label: CONFIG.TEXTS.ui.animationSpeedNormal }),
  Object.freeze({ value: 2, label: CONFIG.TEXTS.ui.animationSpeedSlow }),
]);

function readPersistedAnimationSpeed() {
  try {
    const speed = loadState(CONFIG.STORAGE_KEY).settings.animationSpeed;
    const matched = ANIMATION_SPEED_OPTIONS.find(
      (option) => option.value === speed,
    );

    return matched === undefined ? 1 : matched.value;
  } catch {
    return 1;
  }
}

function persistAnimationSpeed(speed) {
  try {
    const state = loadState(CONFIG.STORAGE_KEY);
    state.settings.animationSpeed = speed;
    saveState(CONFIG.STORAGE_KEY, state);
  } catch {
    // Le réglage de vitesse est best-effort : on ignore une panne du stockage.
  }
}

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className !== undefined) {
    element.className = className;
  }

  return element;
}

function sanitizeInputValue(value) {
  return sanitizePlayerName(value, CONFIG.PLAYER_NAME_MAX_LENGTH);
}

function getNormalizedPlayerName(value) {
  return sanitizeInputValue(value).trim();
}

function hasDuplicateNames(names) {
  const normalizedNames = names.map((name) => name.toLocaleLowerCase('fr-FR'));

  return new Set(normalizedNames).size !== normalizedNames.length;
}

function setValidationMessage(messageElement, message) {
  messageElement.textContent = message;
  messageElement.hidden = message === '';
}

function createNameField(index) {
  const field = createElement('div', 'menu-player-field');
  const inputId = `player-name-${index + 1}`;
  const label = createElement('label', 'ui-label');
  const input = createElement('input', 'ui-input');

  label.setAttribute('for', inputId);
  label.textContent = `${CONFIG.TEXTS.ui.playerNameLabel} ${index + 1}`;

  input.id = inputId;
  input.name = `playerName${index + 1}`;
  input.type = 'text';
  input.autocomplete = 'off';
  input.required = true;
  input.placeholder = `${CONFIG.TEXTS.ui.playerNamePlaceholder} ${index + 1}`;
  input.dataset.testid = `player-name-input-${index}`;

  field.append(label, input);

  return { field, input };
}

export function renderMenuScreen(container, callbacks) {
  if (!(container instanceof Element)) {
    throw new TypeError('Le conteneur du menu doit être un élément DOM.');
  }

  if (
    callbacks === null ||
    typeof callbacks !== 'object' ||
    typeof callbacks.onStartGame !== 'function'
  ) {
    throw new TypeError('Le menu exige un callback onStartGame.');
  }

  const screen = createElement('section', 'menu-screen screen screen-fade-in');
  const title = createElement('h1', 'app-title');
  const intro = createElement('p', 'screen-subtitle');
  const form = createElement('form', 'menu-form');
  const countField = createElement('div', 'menu-field');
  const countLabel = createElement('label', 'ui-label');
  const playerCountSelect = createElement('select', 'ui-select');
  const speedField = createElement('div', 'menu-field');
  const speedLabel = createElement('label', 'ui-label');
  const animationSpeedSelect = createElement('select', 'ui-select');
  const playersFieldset = createElement('fieldset', 'menu-player-list');
  const playersLegend = createElement('legend', 'sr-only');
  const validationMessage = createElement('p', 'form-error');
  const submitButton = createElement('button', 'ui-button ui-button-primary');
  const nameInputs = [];

  title.textContent = CONFIG.TEXTS.ui.menuTitle;
  intro.textContent = CONFIG.TEXTS.ui.menuIntro;

  countLabel.setAttribute('for', 'player-count');
  countLabel.textContent = CONFIG.TEXTS.ui.playerCountLabel;
  playerCountSelect.id = 'player-count';
  playerCountSelect.name = 'playerCount';

  for (const playerCount of PLAYER_COUNT_OPTIONS) {
    const option = document.createElement('option');

    option.value = String(playerCount);
    option.textContent = String(playerCount);
    playerCountSelect.append(option);
  }

  speedLabel.setAttribute('for', 'animation-speed');
  speedLabel.textContent = CONFIG.TEXTS.ui.animationSpeedLabel;
  animationSpeedSelect.id = 'animation-speed';
  animationSpeedSelect.name = 'animationSpeed';

  for (const { value, label } of ANIMATION_SPEED_OPTIONS) {
    const option = document.createElement('option');

    option.value = String(value);
    option.textContent = label;
    animationSpeedSelect.append(option);
  }

  animationSpeedSelect.value = String(readPersistedAnimationSpeed());

  playersLegend.textContent = CONFIG.TEXTS.ui.playerCountLabel;
  validationMessage.id = 'menu-validation-message';
  validationMessage.setAttribute('role', 'alert');
  validationMessage.hidden = true;

  submitButton.type = 'submit';
  submitButton.textContent = CONFIG.TEXTS.ui.playButton;
  submitButton.dataset.testid = 'btn-play';

  countField.append(countLabel, playerCountSelect);
  speedField.append(speedLabel, animationSpeedSelect);
  playersFieldset.append(playersLegend);
  form.append(
    countField,
    speedField,
    playersFieldset,
    validationMessage,
    submitButton,
  );
  screen.append(title, intro, form);
  container.append(screen);

  function renderNameFields(playerCount) {
    const existingNames = nameInputs.map((input) => input.value);

    nameInputs.splice(0, nameInputs.length);
    playersFieldset.replaceChildren(playersLegend);

    for (let index = 0; index < playerCount; index += 1) {
      const { field, input } = createNameField(index);

      input.value = sanitizeInputValue(existingNames[index] ?? '');
      nameInputs.push(input);
      playersFieldset.append(field);
    }
  }

  function sanitizeInputOnInput(event) {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const sanitizedValue = sanitizeInputValue(event.target.value);

    if (event.target.value !== sanitizedValue) {
      event.target.value = sanitizedValue;
    }
  }

  function handlePlayerCountChange() {
    const selectedCount = Number.parseInt(playerCountSelect.value, 10);
    const safeCount = PLAYER_COUNT_OPTIONS.includes(selectedCount)
      ? selectedCount
      : CONFIG.MIN_PLAYERS;

    renderNameFields(safeCount);
    setValidationMessage(validationMessage, '');
  }

  function handleAnimationSpeedChange() {
    const selected = Number.parseFloat(animationSpeedSelect.value);
    const safeSpeed = ANIMATION_SPEED_OPTIONS.some(
      (option) => option.value === selected,
    )
      ? selected
      : 1;

    animationSpeedSelect.value = String(safeSpeed);
    persistAnimationSpeed(safeSpeed);
  }

  function getSelectedAnimationSpeed() {
    const selected = Number.parseFloat(animationSpeedSelect.value);

    return ANIMATION_SPEED_OPTIONS.some((option) => option.value === selected)
      ? selected
      : 1;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const playerNames = nameInputs.map((input) =>
      getNormalizedPlayerName(input.value),
    );

    if (playerNames.some((name) => name === '')) {
      setValidationMessage(
        validationMessage,
        CONFIG.TEXTS.ui.validationEmptyNames,
      );
      return;
    }

    if (hasDuplicateNames(playerNames)) {
      setValidationMessage(
        validationMessage,
        CONFIG.TEXTS.ui.validationDuplicateNames,
      );
      return;
    }

    setValidationMessage(validationMessage, '');
    callbacks.onStartGame(playerNames, getSelectedAnimationSpeed());
  }

  playerCountSelect.addEventListener('change', handlePlayerCountChange);
  animationSpeedSelect.addEventListener('change', handleAnimationSpeedChange);
  form.addEventListener('input', sanitizeInputOnInput);
  form.addEventListener('submit', handleSubmit);

  renderNameFields(CONFIG.MIN_PLAYERS);
  nameInputs[0]?.focus();

  return {
    destroy() {
      playerCountSelect.removeEventListener('change', handlePlayerCountChange);
      animationSpeedSelect.removeEventListener(
        'change',
        handleAnimationSpeedChange,
      );
      form.removeEventListener('input', sanitizeInputOnInput);
      form.removeEventListener('submit', handleSubmit);
      screen.remove();
    },
  };
}
