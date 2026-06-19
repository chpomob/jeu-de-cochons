import './ui/styles.css';

import packageJson from '../package.json';
import { CONFIG } from './config.js';
import { createGameController } from './controller.js';

const SERVICE_WORKER_VERSION = packageJson.version;
const SERVICE_WORKER_URL = `/sw.js?version=${encodeURIComponent(
  SERVICE_WORKER_VERSION,
)}`;

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

export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  isProduction = import.meta.env.PROD,
} = {}) {
  const serviceWorker = navigatorRef?.serviceWorker;

  if (
    !isProduction ||
    serviceWorker === undefined ||
    typeof serviceWorker.register !== 'function'
  ) {
    return Promise.resolve(null);
  }

  try {
    return serviceWorker.register(SERVICE_WORKER_URL).catch((error) => {
      console.error('Echec de l enregistrement du service worker.', error);
      return null;
    });
  } catch (error) {
    console.error('Echec de l enregistrement du service worker.', error);
    return Promise.resolve(null);
  }
}

if (typeof document !== 'undefined' && import.meta.env.MODE !== 'test') {
  init({ debug: import.meta.env.DEV });
  registerServiceWorker();
}
