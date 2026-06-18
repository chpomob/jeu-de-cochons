const HTML_ENTITIES = Object.freeze({
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
});

const HTML_ESCAPE_PATTERN = /[<>"']|&(?!amp;|lt;|gt;|quot;|#39;)/g;

export function escapeHTML(str) {
  return String(str).replace(
    HTML_ESCAPE_PATTERN,
    (character) => (character === '&' ? '&amp;' : HTML_ENTITIES[character]),
  );
}

/**
 * Nettoie un nom de joueur : tronque, supprime les caractères de contrôle,
 * et retire les chevrons HTML. L'échappement HTML est fait au rendu (textContent).
 */
export function sanitizePlayerName(name, maxLength) {
  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new TypeError('La longueur maximale doit etre un entier positif.');
  }

  return Array.from(String(name))
    .filter(function (char) {
      var code = char.codePointAt(0);
      // Rejeter les caractères de contrôle (sauf espace, tab) et les surrogates isolés
      return (
        code === 0x20 || code === 0x09 ||
        (code >= 0x21 && code <= 0x7E) ||
        code >= 0xA0
      );
    })
    .slice(0, maxLength)
    .join('')
    .trim();
}
