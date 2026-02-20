import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { EMAIL_RE, INTERNAL_ID_KEYS, INTERNAL_ID_SUFFIX, RULE_HINTS } from "./patterns.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);
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

function unwrapResponse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 3) return parsed;

  let best: unknown = null;
  let bestSize = 0;
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > bestSize) {
      best = val;
      bestSize = val.length;
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const size = Object.keys(val as Record<string, unknown>).length;
      if (size > bestSize) {
        best = val;
        bestSize = size;
      }
    }
  }
  return best && bestSize >= 3 ? best : parsed;
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

  if (WRITE_METHODS.has(method) && reqBody && typeof reqBody === "object") {
    const reqEmails = findEmails(reqBody);
    if (reqEmails.length > 0) {
      const resEmails = findEmails(target);
      const echoed = reqEmails.filter((e) => resEmails.includes(e));
      if (echoed.length > 0) {
        const inspectObj = Array.isArray(target) && target.length > 0 ? target[0] : target;
        if (hasInternalIds(inspectObj) || topLevelFieldCount(inspectObj) >= FULL_RECORD_MIN_FIELDS) {
          return { reason: "echo", emailCount: echoed.length };
        }
      }
    }
  }

  if (target && typeof target === "object" && !Array.isArray(target)) {
    const fields = topLevelFieldCount(target);
    if (fields >= FULL_RECORD_MIN_FIELDS && hasInternalIds(target)) {
      const emails = findEmails(target);
      if (emails.length > 0) {
        return { reason: "full-record", emailCount: emails.length };
      }
    }
  }

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
