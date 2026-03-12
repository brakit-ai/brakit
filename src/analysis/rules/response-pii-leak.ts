import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { EMAIL_RE, INTERNAL_ID_KEYS, INTERNAL_ID_SUFFIX, RULE_HINTS, SELF_SERVICE_PATH, SENSITIVE_FIELD_NAMES } from "./patterns.js";
import { unwrapResponse } from "../../utils/response.js";
import { PII_SCAN_ARRAY_LIMIT, FULL_RECORD_MIN_FIELDS, LIST_PII_MIN_ITEMS, MAX_OBJECT_SCAN_DEPTH } from "../../constants/limits.js";
import { isErrorStatus } from "../../utils/http-status.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

function findEmails(obj: unknown, depth = 0): string[] {
  const emails: string[] = [];
  if (depth >= MAX_OBJECT_SCAN_DEPTH) return emails;
  if (!obj || typeof obj !== "object") return emails;
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, PII_SCAN_ARRAY_LIMIT); i++) {
      emails.push(...findEmails(obj[i], depth + 1));
    }
    return emails;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v === "string" && EMAIL_RE.test(v)) {
      emails.push(v);
    } else if (typeof v === "object" && v !== null) {
      emails.push(...findEmails(v, depth + 1));
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

function hasSensitiveFieldNames(obj: unknown, depth = 0): boolean {
  if (depth >= MAX_OBJECT_SCAN_DEPTH) return false;
  if (!obj || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.length > 0 && hasSensitiveFieldNames(obj[0], depth + 1);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELD_NAMES.test(key)) return true;
  }
  return false;
}

type PIIReason = "echo" | "full-record" | "list-pii" | "sensitive-fields";

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

// Sensitive-field detection: response contains unambiguous PII field names
// (phone, SSN, dateOfBirth, etc.) on a record-like object, regardless of
// whether an email address is present.
function detectSensitiveFieldPII(target: unknown): PIIDetection | null {
  const inspect = Array.isArray(target) && target.length > 0 ? target[0] : target;
  if (!inspect || typeof inspect !== "object" || Array.isArray(inspect)) return null;
  if (!hasSensitiveFieldNames(inspect)) return null;
  if (!hasInternalIds(inspect) && topLevelFieldCount(inspect) < FULL_RECORD_MIN_FIELDS) return null;
  return { reason: "sensitive-fields", emailCount: 0 };
}

// List detection: an array where multiple items contain email addresses and
// look like full records signals a list endpoint leaking user PII.
function detectListPII(target: unknown): PIIDetection | null {
  if (!Array.isArray(target) || target.length < LIST_PII_MIN_ITEMS) return null;

  let itemsWithEmail = 0;
  for (let i = 0; i < Math.min(target.length, PII_SCAN_ARRAY_LIMIT); i++) {
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
    ?? detectListPII(target)
    ?? detectSensitiveFieldPII(target);
}

const REASON_LABELS: Record<PIIReason, string> = {
  echo: "echoes back PII from the request body",
  "full-record": "returns a full record with email and internal IDs",
  "list-pii": "returns a list of records containing email addresses",
  "sensitive-fields": "contains sensitive personal data fields (phone, SSN, date of birth, address, etc.)",
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
      if (isErrorStatus(r.statusCode)) continue;
      if (SELF_SERVICE_PATH.test(r.path)) continue;
      const resJson = ctx.parsedBodies.response.get(r.id);
      if (!resJson) continue;
      const reqJson = ctx.parsedBodies.request.get(r.id) ?? null;

      const detection = detectPII(r.method, reqJson, resJson);
      if (!detection) continue;

      const ep = `${r.method} ${r.path}`;
      const existing = seen.get(ep);
      if (existing) { existing.count++; continue; }

      const finding: SecurityFinding = {
        severity: "warning",
        rule: "response-pii-leak",
        title: "PII Leak in Response",
        desc: `${ep} — exposes PII in response`,
        hint: `Detection: ${REASON_LABELS[detection.reason]}. ${this.hint}`,
        endpoint: ep,
        count: 1,
      };
      seen.set(ep, finding);
      findings.push(finding);
    }
    return findings;
  },
};
