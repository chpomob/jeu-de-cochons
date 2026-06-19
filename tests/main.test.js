import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from '../src/main.js';

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignore l enregistrement hors production', async () => {
    const register = vi.fn();

    const result = await registerServiceWorker({
      isProduction: false,
      navigatorRef: { serviceWorker: { register } },
    });

    expect(result).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('enregistre le service worker en production', async () => {
    const registration = { scope: '/' };
    const register = vi.fn().mockResolvedValue(registration);

    const result = await registerServiceWorker({
      isProduction: true,
      navigatorRef: { serviceWorker: { register } },
    });

    expect(result).toBe(registration);
    expect(register).toHaveBeenCalledWith('/sw.js?version=0.1.0');
  });

  it('absorbe les echecs d enregistrement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await registerServiceWorker({
      isProduction: true,
      navigatorRef: {
        serviceWorker: {
          register() {
            throw new Error('refus navigateur');
          },
        },
      },
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledOnce();
  });
});
