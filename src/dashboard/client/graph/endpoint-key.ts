/**
 * Client-side endpoint key normalization.
 *
 * SYNC: This mirrors getEndpointKey() from src/utils/endpoint.ts.
 * The client bundle (IIFE) cannot import server modules, so this is
 * a minimal duplicate. If you change normalization logic, update both.
 */

const UUID_LENGTH = 36;
const MIN_HEX_LENGTH = 12;
const MIN_TOKEN_LENGTH = 8;

function isHexChar(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function isUUID(s: string): boolean {
  if (s.length !== UUID_LENGTH) return false;
  for (let i = 0; i < s.length; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (s[i] !== "-") return false;
    } else if (!isHexChar(s[i])) {
      return false;
    }
  }
  return true;
}

function isNumericId(s: string): boolean {
  if (!s.length) return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function isHexHash(s: string): boolean {
  if (s.length < MIN_HEX_LENGTH) return false;
  for (let i = 0; i < s.length; i++) {
    if (!isHexChar(s[i])) return false;
  }
  return true;
}

function isAlphanumericToken(s: string): boolean {
  if (s.length < MIN_TOKEN_LENGTH) return false;
  let hasLetter = false;
  let hasDigit = false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) hasLetter = true;
    else if (code >= 48 && code <= 57) hasDigit = true;
    else if (code !== 95 && code !== 45) return false;
  }
  return hasLetter && hasDigit;
}

const DYNAMIC_PLACEHOLDER = ":id";

function normalizeSegment(segment: string): string {
  if (isUUID(segment) || isNumericId(segment) || isHexHash(segment) || isAlphanumericToken(segment)) {
    return DYNAMIC_PLACEHOLDER;
  }
  return segment;
}

export function endpointKey(method: string, path: string): string {
  const pathname = path.split("?")[0];
  return `${method} ${pathname.split("/").map((s) => (s ? normalizeSegment(s) : s)).join("/")}`;
}
