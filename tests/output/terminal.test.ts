import { describe, it, expect } from "vitest";
import { formatRequest, formatSize } from "../../src/output/terminal.js";
import type { TracedRequest } from "../../src/types.js";

function makeRequest(overrides: Partial<TracedRequest> = {}): TracedRequest {
  return {
    id: "test-id",
    method: "GET",
    url: "/api/users",
    path: "/api/users",
    headers: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: {},
    responseBody: null,
    startedAt: 0,
    durationMs: 23,
    responseSize: 1234,
    isStatic: false,
    ...overrides,
  };
}

describe("formatSize", () => {
  it("returns empty string for 0 bytes", () => {
    expect(formatSize(0)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatSize(512)).toBe("512b");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1536)).toBe("1.5kb");
  });
});

describe("formatRequest", () => {
  it("formats a one-liner with method, path, status, duration, size", () => {
    const output = formatRequest(makeRequest());
    expect(output).toContain("GET");
    expect(output).toContain("/api/users");
    expect(output).toContain("200");
    expect(output).toContain("23ms");
    expect(output).toContain("1.2kb");
    expect(output.split("\n")).toHaveLength(1);
  });

  it("shows path not full URL", () => {
    const output = formatRequest(
      makeRequest({ url: "/api/users?page=1", path: "/api/users" }),
    );
    expect(output).toContain("/api/users");
  });

  it("does not include response body", () => {
    const output = formatRequest(
      makeRequest({
        responseBody: '{"users":[{"id":1,"name":"John"}]}',
      }),
    );
    expect(output).not.toContain("John");
    expect(output.split("\n")).toHaveLength(1);
  });

  it("does not include request body", () => {
    const output = formatRequest(
      makeRequest({
        method: "POST",
        statusCode: 201,
        requestBody: '{"name":"John"}',
      }),
    );
    expect(output).toContain("POST");
    expect(output).toContain("201");
    expect(output).not.toContain("John");
    expect(output.split("\n")).toHaveLength(1);
  });

  it("formats error status codes", () => {
    const output = formatRequest(
      makeRequest({ statusCode: 500, durationMs: 150 }),
    );
    expect(output).toContain("500");
    expect(output).toContain("150ms");
  });

  it("formats a 404 response", () => {
    const output = formatRequest(makeRequest({ statusCode: 404 }));
    expect(output).toContain("404");
  });

  it("includes response size", () => {
    const output = formatRequest(makeRequest({ responseSize: 2048 }));
    expect(output).toContain("2.0kb");
  });

  it("omits size when responseSize is 0", () => {
    const output = formatRequest(makeRequest({ responseSize: 0 }));
    expect(output).not.toContain("kb");
    expect(output).not.toContain("0b");
  });
});
