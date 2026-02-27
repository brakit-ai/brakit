import { describe, it, expect } from "vitest";
import { exposedSecretRule } from "../../src/analysis/rules/exposed-secret.js";
import { tokenInUrlRule } from "../../src/analysis/rules/token-in-url.js";
import { stackTraceLeakRule } from "../../src/analysis/rules/stack-trace-leak.js";
import { errorInfoLeakRule } from "../../src/analysis/rules/error-info-leak.js";
import { insecureCookieRule } from "../../src/analysis/rules/insecure-cookie.js";
import { sensitiveLogsRule } from "../../src/analysis/rules/sensitive-logs.js";
import { corsCredentialsRule } from "../../src/analysis/rules/cors-credentials.js";
import { responsePiiLeakRule } from "../../src/analysis/rules/response-pii-leak.js";
import { makeRequest, makeLog, makeSecurityContext } from "../helpers/index.js";

describe("exposedSecretRule", () => {
  it("detects secret fields in response body", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify({ userId: 1, apiKey: "sk-1234567890abcdef" }),
        }),
      ],
    });
    const findings = exposedSecretRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("exposed-secret");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].desc).toContain("apiKey");
  });

  it("ignores responses without secrets", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify({ name: "John", email: "john@example.com" }),
        }),
      ],
    });
    expect(exposedSecretRule.check(ctx)).toHaveLength(0);
  });

  it("ignores masked secret values", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify({ apiKey: "********" }),
        }),
      ],
    });
    expect(exposedSecretRule.check(ctx)).toHaveLength(0);
  });

  it("skips error responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 500,
          responseBody: JSON.stringify({ apiKey: "sk-1234567890abcdef" }),
        }),
      ],
    });
    expect(exposedSecretRule.check(ctx)).toHaveLength(0);
  });
});

describe("tokenInUrlRule", () => {
  it("detects tokens in query parameters", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          url: "/api/data?access_token=secret12345",
          path: "/api/data",
        }),
      ],
    });
    const findings = tokenInUrlRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("token-in-url");
    expect(findings[0].desc).toContain("access_token");
  });

  it("ignores safe params like code and state", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          url: "/api/callback?code=abc123&state=xyz",
          path: "/api/callback",
        }),
      ],
    });
    expect(tokenInUrlRule.check(ctx)).toHaveLength(0);
  });

  it("ignores URLs without query parameters", () => {
    const ctx = makeSecurityContext({ requests: [makeRequest()] });
    expect(tokenInUrlRule.check(ctx)).toHaveLength(0);
  });
});

describe("stackTraceLeakRule", () => {
  it("detects stack traces in response body", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 500,
          responseBody:
            'Error: DB failed\n    at Database.connect (db.ts:42:15)\n    at processTicksAndRejections',
        }),
      ],
    });
    const findings = stackTraceLeakRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("stack-trace-leak");
    expect(findings[0].severity).toBe("critical");
  });

  it("ignores responses without stack traces", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify({ error: "Something went wrong" }),
        }),
      ],
    });
    expect(stackTraceLeakRule.check(ctx)).toHaveLength(0);
  });
});

describe("errorInfoLeakRule", () => {
  it("detects database connection strings in error responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 500,
          responseBody: "Error: postgres://user:pass@host:5432/mydb connection refused",
        }),
      ],
    });
    const findings = errorInfoLeakRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("error-info-leak");
    expect(findings[0].desc).toContain("database connection string");
  });

  it("detects SQL fragments in error responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 400,
          responseBody: 'Error: SELECT * FROM users WHERE id = 1 failed',
        }),
      ],
    });
    const findings = errorInfoLeakRule.check(ctx);
    expect(findings.some((f) => f.desc.includes("SQL query fragment"))).toBe(true);
  });

  it("ignores success responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 200,
          responseBody: "postgres://user:pass@host/db",
        }),
      ],
    });
    expect(errorInfoLeakRule.check(ctx)).toHaveLength(0);
  });

  it("skips Next.js framework error responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 500,
          responseHeaders: { "x-nextjs-error": "1" },
          responseBody: "postgres://user:pass@host/db",
        }),
      ],
    });
    expect(errorInfoLeakRule.check(ctx)).toHaveLength(0);
  });
});

describe("insecureCookieRule", () => {
  it("detects cookies missing HttpOnly and SameSite", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseHeaders: { "set-cookie": "session=abc123; Path=/; Max-Age=3600" },
        }),
      ],
    });
    const findings = insecureCookieRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("insecure-cookie");
    expect(findings[0].desc).toContain("HttpOnly");
    expect(findings[0].desc).toContain("SameSite");
  });

  it("ignores cookies with all security flags", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseHeaders: {
            "set-cookie": "session=abc123; Path=/; HttpOnly; SameSite=Strict",
          },
        }),
      ],
    });
    expect(insecureCookieRule.check(ctx)).toHaveLength(0);
  });

  it("skips redirect responses as framework responses", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 302,
          responseHeaders: { "set-cookie": "session=abc; Path=/" },
        }),
      ],
    });
    expect(insecureCookieRule.check(ctx)).toHaveLength(0);
  });
});

describe("sensitiveLogsRule", () => {
  it("detects secrets in log messages", () => {
    const ctx = makeSecurityContext({
      logs: [
        makeLog({
          level: "log",
          message: 'Authenticating with password=SuperSecret123',
        }),
      ],
    });
    const findings = sensitiveLogsRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("sensitive-logs");
    expect(findings[0].count).toBe(1);
  });

  it("ignores clean log messages", () => {
    const ctx = makeSecurityContext({
      logs: [
        makeLog({
          level: "info",
          message: "Server started on port 3000",
        }),
      ],
    });
    expect(sensitiveLogsRule.check(ctx)).toHaveLength(0);
  });

  it("ignores brakit's own log messages", () => {
    const ctx = makeSecurityContext({
      logs: [
        makeLog({
          level: "log",
          message: "[brakit] password=SuperSecret123",
        }),
      ],
    });
    expect(sensitiveLogsRule.check(ctx)).toHaveLength(0);
  });
});

describe("corsCredentialsRule", () => {
  it("detects wildcard origin with credentials", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseHeaders: {
            "access-control-allow-origin": "*",
            "access-control-allow-credentials": "true",
          },
        }),
      ],
    });
    const findings = corsCredentialsRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("cors-credentials");
  });

  it("ignores specific origin with credentials", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseHeaders: {
            "access-control-allow-origin": "https://example.com",
            "access-control-allow-credentials": "true",
          },
        }),
      ],
    });
    expect(corsCredentialsRule.check(ctx)).toHaveLength(0);
  });
});

describe("responsePiiLeakRule", () => {
  it("detects list of records with emails and internal IDs", () => {
    const records = [
      { id: 1, userId: "u-1", name: "Alice", email: "alice@example.com" },
      { id: 2, userId: "u-2", name: "Bob", email: "bob@example.com" },
      { id: 3, userId: "u-3", name: "Charlie", email: "charlie@example.com" },
    ];
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify(records),
        }),
      ],
    });
    const findings = responsePiiLeakRule.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("response-pii-leak");
    expect(findings[0].severity).toBe("warning");
  });

  it("ignores responses without PII", () => {
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          responseBody: JSON.stringify({ status: "ok", count: 42 }),
        }),
      ],
    });
    expect(responsePiiLeakRule.check(ctx)).toHaveLength(0);
  });

  it("skips error responses", () => {
    const records = [
      { id: 1, userId: "u-1", email: "alice@example.com" },
      { id: 2, userId: "u-2", email: "bob@example.com" },
    ];
    const ctx = makeSecurityContext({
      requests: [
        makeRequest({
          statusCode: 500,
          responseBody: JSON.stringify(records),
        }),
      ],
    });
    expect(responsePiiLeakRule.check(ctx)).toHaveLength(0);
  });
});
