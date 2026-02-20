import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { EMAIL_RE, INTERNAL_ID_KEYS, INTERNAL_ID_SUFFIX, RULE_HINTS } from "./patterns.js";

/** Methods that carry a request body worth comparing for echo detection */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

/** Minimum field count to consider a response a "full record dump" */
const FULL_RECORD_MIN_FIELDS = 5;

/** Minimum items in an array to trigger list-PII detection */
const LIST_PII_MIN_ITEMS = 2;

function tryParseJson(body: string | null): unknown {
  if (!body) return null;
  try { return JSON.parse(body); } catch { return null; }
}

/** Recursively find all email-valued string fields in an object. */
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

/** Count top-level keys in an object (or the first item of an array). */
function topLevelFieldCount(obj: unknown): number {
  if (Array.isArray(obj)) {
    return obj.length > 0 ? topLevelFieldCount(obj[0]) : 0;
  }
  if (obj && typeof obj === "object") return Object.keys(obj).length;
  return 0;
}

/** Check whether an object contains internal ID fields (userId, _id, etc.) */
function hasInternalIds(obj: unknown): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (INTERNAL_ID_KEYS.test(key) || INTERNAL_ID_SUFFIX.test(key)) return true;
  }
  return false;
}

/** Get the target object for inspection — unwrap common response wrappers. */
function unwrapResponse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  // Common wrappers: { data: ... }, { result: ... }, { user: ... }
  if (Object.keys(obj).length <= 2) {
    for (const key of ["data", "result", "user", "users", "items", "results"]) {
      if (key in obj && typeof obj[key] === "object" && obj[key] !== null) {
        return obj[key];
      }
    }
  }
  return parsed;
}

type PIIReason = "echo" | "full-record" | "list-pii";

interface PIIDetection {
  reason: PIIReason;
  emailCount: number;
}

function detectPII(
  method: string,
  reqBody: unknown,
  resBody: unknown,
): PIIDetection | null {
  const target = unwrapResponse(resBody);

  // --- Echo Detection ---
  // POST/PUT/PATCH that echoes back email from the request body
  if (WRITE_METHODS.has(method) && reqBody && typeof reqBody === "object") {
    const reqEmails = findEmails(reqBody);
    if (reqEmails.length > 0) {
      const resEmails = findEmails(target);
      const echoed = reqEmails.filter((e) => resEmails.includes(e));
      if (echoed.length > 0) {
        // Only flag if the response also has internal IDs or many fields (full dump)
        const inspectObj = Array.isArray(target) && target.length > 0 ? target[0] : target;
        if (hasInternalIds(inspectObj) || topLevelFieldCount(inspectObj) >= FULL_RECORD_MIN_FIELDS) {
          return { reason: "echo", emailCount: echoed.length };
        }
      }
    }
  }

  // --- Full Record Dump Detection ---
  // Response contains email + internal IDs + many fields
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const fields = topLevelFieldCount(target);
    if (fields >= FULL_RECORD_MIN_FIELDS && hasInternalIds(target)) {
      const emails = findEmails(target);
      if (emails.length > 0) {
        return { reason: "full-record", emailCount: emails.length };
      }
    }
  }

  // --- List PII Detection ---
  // Response array with multiple items containing email fields
  if (Array.isArray(target) && target.length >= LIST_PII_MIN_ITEMS) {
    let itemsWithEmail = 0;
    for (let i = 0; i < Math.min(target.length, 10); i++) {
      const item = target[i];
      if (item && typeof item === "object") {
        const emails = findEmails(item);
        if (emails.length > 0) itemsWithEmail++;
      }
    }
    if (itemsWithEmail >= LIST_PII_MIN_ITEMS) {
      const first = target[0];
      if (hasInternalIds(first) || topLevelFieldCount(first) >= FULL_RECORD_MIN_FIELDS) {
        return { reason: "list-pii", emailCount: itemsWithEmail };
      }
    }
  }

  return null;
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
