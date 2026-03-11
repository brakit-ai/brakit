import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { EMAIL_RE, INTERNAL_ID_KEYS, INTERNAL_ID_SUFFIX, RULE_HINTS } from "./patterns.js";
import { unwrapResponse } from "../../utils/response.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);
// A response with this many top-level fields likely represents a full database
// record (e.g. user profile) rather than a simple acknowledgment.
const FULL_RECORD_MIN_FIELDS = 5;
const LIST_PII_MIN_ITEMS = 2;

function tryParseJson(body: string | null): unknown {
  if (!body) return null;
  try { return JSON.parse(body); } catch { return null; }
}

function findEmails(obj: unknown): string[] {
  const emails: string[] = [];
  if (!obj || typeof obj !== "object") return emails;
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 10); i++) {
      emails.push(...findEmails(obj[i]));
    }
    return emails;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v === "string" && EMAIL_RE.test(v)) {
      emails.push(v);
    } else if (typeof v === "object" && v !== null) {
      emails.push(...findEmails(v));
    }
  }
  return emails;
}

function topLevelFieldCount(obj: unknown): number {
  if (Array.isArray(obj)) {
    return obj.length > 0 ? topLevelFieldCount(obj[0]) : 0;
  }
  if (obj && typeof obj === "object") return Object.keys(obj).length;
  return 0;
}

function hasInternalIds(obj: unknown): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (INTERNAL_ID_KEYS.test(key) || INTERNAL_ID_SUFFIX.test(key)) return true;
  }
  return false;
}

type PIIReason = "echo" | "full-record" | "list-pii";

interface PIIDetection {
  reason: PIIReason;
  emailCount: number;
}

// Echo detection: POST/PUT/PATCH that echoes back submitted email addresses
// alongside internal IDs or many fields indicates the full record was returned
// rather than a minimal acknowledgment — a common over-fetching PII leak.
function detectEchoPII(method: string, reqBody: unknown, target: unknown): PIIDetection | null {
  if (!WRITE_METHODS.has(method) || !reqBody || typeof reqBody !== "object") return null;

  const reqEmails = findEmails(reqBody);
  if (reqEmails.length === 0) return null;

  const resEmails = findEmails(target);
  const echoed = reqEmails.filter((e) => resEmails.includes(e));
  if (echoed.length === 0) return null;

  const inspectObj = Array.isArray(target) && target.length > 0 ? target[0] : target;
  if (hasInternalIds(inspectObj) || topLevelFieldCount(inspectObj) >= FULL_RECORD_MIN_FIELDS) {
    return { reason: "echo", emailCount: echoed.length };
  }
  return null;
}

// Full-record detection: a single object response with internal IDs (e.g. _id,
// userId) and email addresses is likely an entire user/entity record exposed.
function detectFullRecordPII(target: unknown): PIIDetection | null {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;

  const fields = topLevelFieldCount(target);
  if (fields < FULL_RECORD_MIN_FIELDS || !hasInternalIds(target)) return null;

  const emails = findEmails(target);
  if (emails.length === 0) return null;

  return { reason: "full-record", emailCount: emails.length };
}

// List detection: an array where multiple items contain email addresses and
// look like full records signals a list endpoint leaking user PII.
function detectListPII(target: unknown): PIIDetection | null {
  if (!Array.isArray(target) || target.length < LIST_PII_MIN_ITEMS) return null;

  let itemsWithEmail = 0;
  for (let i = 0; i < Math.min(target.length, 10); i++) {
    const item = target[i];
    if (item && typeof item === "object" && findEmails(item).length > 0) {
      itemsWithEmail++;
    }
  }
  if (itemsWithEmail < LIST_PII_MIN_ITEMS) return null;

  const first = target[0];
  if (hasInternalIds(first) || topLevelFieldCount(first) >= FULL_RECORD_MIN_FIELDS) {
    return { reason: "list-pii", emailCount: itemsWithEmail };
  }
  return null;
}

function detectPII(
  method: string,
  reqBody: unknown,
  resBody: unknown,
): PIIDetection | null {
  const target = unwrapResponse(resBody);
  return detectEchoPII(method, reqBody, target)
    ?? detectFullRecordPII(target)
    ?? detectListPII(target);
}

const REASON_LABELS: Record<PIIReason, string> = {
  echo: "echoes back PII from the request body",
  "full-record": "returns a full record with email and internal IDs",
  "list-pii": "returns a list of records containing email addresses",
};

export const responsePiiLeakRule: SecurityRule = {
  id: "response-pii-leak",
  severity: "warning",
  name: "PII Leak in Response",
  hint: RULE_HINTS["response-pii-leak"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      if (r.statusCode >= 400) continue;
      const resJson = tryParseJson(r.responseBody);
      if (!resJson) continue;
      const reqJson = tryParseJson(r.requestBody);

      const detection = detectPII(r.method, reqJson, resJson);
      if (!detection) continue;

      const ep = `${r.method} ${r.path}`;
      const dedupKey = `${ep}:${detection.reason}`;
      const existing = seen.get(dedupKey);
      if (existing) { existing.count++; continue; }

      const finding: SecurityFinding = {
        severity: "warning",
        rule: "response-pii-leak",
        title: "PII Leak in Response",
        desc: `${ep} — ${REASON_LABELS[detection.reason]}`,
        hint: this.hint,
        endpoint: ep,
        count: 1,
      };
      seen.set(dedupKey, finding);
      findings.push(finding);
    }
    return findings;
  },
};
