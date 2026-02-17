export function getSecurityHelpers(): string {
  return `
  function tryParseJson(body) {
    if (!body) return null;
    try { return JSON.parse(body); } catch(e) { return null; }
  }

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
      if (SECRET_KEYS.test(k) && obj[k] && typeof obj[k] === 'string' && obj[k].length > 0) {
        found.push(k);
      }
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        found = found.concat(findSecretKeys(obj[k], prefix + k + '.'));
      }
    }
    return found;
  }

  function hasPiiFields(obj) {
    if (!obj || typeof obj !== 'object') return [];
    var items = Array.isArray(obj) ? obj.slice(0, 3) : [obj];
    var found = [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      if (!item || typeof item !== 'object') continue;
      for (var k in item) {
        if (PII_KEYS.test(k)) found.push(k);
      }
      if (found.length > 0) break;
    }
    return found;
  }
  `;
}
