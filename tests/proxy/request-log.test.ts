import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  captureRequest,
  onRequest,
  getRequests,
  clearRequests,
  isStaticPath,
  flattenHeaders,
  type CaptureInput,
} from "../../src/store/request-log.js";

function makeCaptureInput(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    requestId: randomUUID(),
    method: "GET",
    url: "/api/users",
    requestHeaders: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: Buffer.from('{"ok":true}'),
    responseContentType: "application/json",
    startTime: performance.now() - 25,
    config: { maxBodyCapture: 10240 },
    ...overrides,
  };
}

describe("isStaticPath", () => {
  it("identifies _next/ paths as static", () => {
    expect(isStaticPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isStaticPath("/_next/image")).toBe(true);
  });

  it("identifies common file extensions as static", () => {
    expect(isStaticPath("/logo.png")).toBe(true);
    expect(isStaticPath("/styles.css")).toBe(true);
    expect(isStaticPath("/favicon.ico")).toBe(true);
    expect(isStaticPath("/font.woff2")).toBe(true);
  });

  it("identifies API routes as non-static", () => {
    expect(isStaticPath("/api/users")).toBe(false);
    expect(isStaticPath("/dashboard")).toBe(false);
    expect(isStaticPath("/")).toBe(false);
  });
});

describe("flattenHeaders", () => {
  it("flattens string headers", () => {
    const result = flattenHeaders({ "content-type": "text/html" });
    expect(result["content-type"]).toBe("text/html");
  });

  it("joins array headers with commas", () => {
    const result = flattenHeaders({
      "set-cookie": ["a=1", "b=2"],
    });
    expect(result["set-cookie"]).toBe("a=1, b=2");
  });

  it("skips undefined values", () => {
    const result = flattenHeaders({ host: undefined });
    expect(result).not.toHaveProperty("host");
  });
});

describe("captureRequest", () => {
  beforeEach(() => {
    clearRequests();
  });

  it("creates a TracedRequest with correct fields", () => {
    const input = makeCaptureInput({
      method: "POST",
      url: "/api/users?page=2",
      requestBody: Buffer.from('{"name":"John"}'),
      statusCode: 201,
    });

    const result = captureRequest(input);

    expect(result.id).toBeTypeOf("string");
    expect(result.method).toBe("POST");
    expect(result.url).toBe("/api/users?page=2");
    expect(result.path).toBe("/api/users");
    expect(result.requestBody).toBe('{"name":"John"}');
    expect(result.statusCode).toBe(201);
    expect(result.responseBody).toBe('{"ok":true}');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.isStatic).toBe(false);
  });

  it("stores requests in the ring buffer", () => {
    for (let i = 0; i < 5; i++) {
      captureRequest(makeCaptureInput({ url: `/api/test/${i}` }));
    }
    expect(getRequests()).toHaveLength(5);
  });

  it("enforces ring buffer max size", () => {
    for (let i = 0; i < 1005; i++) {
      captureRequest(makeCaptureInput({ url: `/api/test/${i}` }));
    }
    expect(getRequests()).toHaveLength(1000);
    expect(getRequests()[0].url).toBe("/api/test/5");
  });

  it("calls onRequest listeners", () => {
    const captured: string[] = [];
    onRequest((req) => captured.push(req.url));

    captureRequest(makeCaptureInput({ url: "/api/hello" }));

    expect(captured).toContain("/api/hello");
  });

  it("marks static paths correctly", () => {
    const result = captureRequest(
      makeCaptureInput({ url: "/_next/static/chunks/main.js" }),
    );
    expect(result.isStatic).toBe(true);
  });

  it("does not capture response body for binary content types", () => {
    const result = captureRequest(
      makeCaptureInput({
        responseContentType: "image/png",
        responseBody: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    );
    expect(result.responseBody).toBeNull();
  });

  it("truncates bodies at maxBodyCapture", () => {
    const largeBody = Buffer.alloc(20000, "x");
    const result = captureRequest(
      makeCaptureInput({
        method: "POST",
        requestBody: largeBody,
        responseBody: largeBody,
        responseContentType: "text/plain",
        config: { maxBodyCapture: 100 },
      }),
    );
    expect(result.requestBody!.length).toBe(100);
    expect(result.responseBody!.length).toBe(100);
  });
});
