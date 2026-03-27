const UUID_LEN = 36; // 8-4-4-4-12
const MIN_HEX_LEN = 12;
const MIN_TOKEN_LEN = 8;

function isUUID(s: string): boolean {
  if (s.length !== UUID_LEN) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (c !== "-") return false;
    } else {
      if (!isHexChar(c)) return false;
    }
  }
  return true;
}

function isHexChar(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 48 && code <= 57)      // 0-9
    || (code >= 65 && code <= 70)        // A-F
    || (code >= 97 && code <= 102);      // a-f
}

function isNumericId(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function isHexHash(s: string): boolean {
  if (s.length < MIN_HEX_LEN) return false;
  for (let i = 0; i < s.length; i++) {
    if (!isHexChar(s[i])) return false;
  }
  return true;
}

function isAlphanumericToken(s: string): boolean {
  if (s.length < MIN_TOKEN_LEN) return false;
  let hasLetter = false;
  let hasDigit = false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) hasLetter = true;
    else if (code >= 48 && code <= 57) hasDigit = true;
    else if (code !== 95 && code !== 45) return false; // allow _ and -
  }
  return hasLetter && hasDigit;
}

function isDynamicSegment(segment: string): boolean {
  return isUUID(segment) || isNumericId(segment) || isHexHash(segment) || isAlphanumericToken(segment);
}

const DYNAMIC_SEGMENT_PLACEHOLDER = ":id";

function normalizePath(path: string): string {
  const qIdx = path.indexOf("?");
  const pathname = qIdx === -1 ? path : path.slice(0, qIdx);
  return pathname
    .split("/")
    .map((seg) => (seg && isDynamicSegment(seg) ? DYNAMIC_SEGMENT_PLACEHOLDER : seg))
    .join("/");
}

export function getEndpointKey(method: string, path: string): string {
  return `${method} ${normalizePath(path)}`;
}

/** Extract the "METHOD /path" prefix from an insight description, or null if not found. */
export function extractEndpointFromDesc(desc: string): string | null {
  const spaceIdx = desc.indexOf(" ");
  if (spaceIdx <= 0) return null;
  const secondSpace = desc.indexOf(" ", spaceIdx + 1);
  if (secondSpace === -1) return desc;
  return desc.slice(0, secondSpace);
}

export function parseEndpointKey(endpoint: string): { method?: string; path: string } {
  const spaceIdx = endpoint.indexOf(" ");
  if (spaceIdx > 0) {
    return { method: endpoint.slice(0, spaceIdx), path: endpoint.slice(spaceIdx + 1) };
  }
  return { path: endpoint };
}

export function stripQueryString(path: string): string {
  const i = path.indexOf("?");
  return i === -1 ? path : path.slice(0, i);
}
