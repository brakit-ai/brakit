export function getSecurityHelpers(): string {
  return `
  function tryParseJson(body) {
    if (!body) return null;
    try { return JSON.parse(body); } catch(e) { return null; }
  }

  var MASKED_RE = /^\\*+$|\\[REDACTED\\]|\\[FILTERED\\]|CHANGE_ME|^x{3,}$/i;

  function findSecretKeys(obj, prefix) {
    var found = [];
    if (!obj || typeof obj !== 'object') return found;
    if (Array.isArray(obj)) {
      for (var ai = 0; ai < Math.min(obj.length, 5); ai++) {
        found = found.concat(findSecretKeys(obj[ai], prefix));
      }
      return found;
    }
    for (var k in obj) {
      if (SECRET_KEYS.test(k) && obj[k] && typeof obj[k] === 'string' && obj[k].length >= 8 && !MASKED_RE.test(obj[k])) {
        found.push(k);
      }
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        found = found.concat(findSecretKeys(obj[k], prefix + k + '.'));
      }
    }
    return found;
  }
  `;
}
