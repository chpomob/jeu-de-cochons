import { describe, expect, it } from 'vitest';

import { escapeHTML, sanitizePlayerName } from '../../src/utils/sanitize.js';

describe('sanitisation des textes', () => {
  it('ne modifie pas les noms valides (échappement HTML au rendu)', () => {
    // Les noms sont stockés bruts ; l'échappement HTML est fait par textContent au rendu
    expect(sanitizePlayerName('A&B <Bob>', 20)).toBe('A&B <Bob>');
  });

  it('coupe les noms par point de code', () => {
    expect(sanitizePlayerName('ab😀', 3)).toBe('ab😀');
  });

  it('echappe explicitement le HTML au point de rendu', () => {
    expect(escapeHTML('A&B <Bob>')).toBe('A&amp;B &lt;Bob&gt;');
  });
});
