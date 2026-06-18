import './ui/styles.css';

import { CONFIG } from './config.js';
import { createGameController } from './controller.js';

export function init({ debug = false } = {}) {
  const appRoot = document.getElementById('app');

  if (appRoot === null) {
    throw new Error(CONFIG.TEXTS.missingRoot);
  }

  const controller = createGameController(appRoot);

  controller.start();

  if (debug) {
    console.info(CONFIG.TEXTS.initDone);
  }

  return controller;
}

if (typeof document !== 'undefined' && import.meta.env.MODE !== 'test') {
  init({ debug: import.meta.env.DEV });
}
