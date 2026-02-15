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
  it("formats a GET 200 request", () => {
    const output = formatRequest(makeRequest());
    expect(output).toContain("GET");
    expect(output).toContain("/api/users");
    expect(output).toContain("200");
    expect(output).toContain("23ms");
  });

  it("shows response body for API routes (GET)", () => {
    const output = formatRequest(
      makeRequest({
        responseBody: '{"users":[{"id":1,"name":"John"}]}',
      }),
    );
    // API route GET should show response body — this is what Next.js can't do
    expect(output).toContain('"users"');
    expect(output).toContain('"John"');
  });

  it("does NOT show response body for non-API page routes", () => {
    const output = formatRequest(
      makeRequest({
        url: "/dashboard",
        path: "/dashboard",
        responseBody: '<!DOCTYPE html><html>...</html>',
      }),
    );
    // Page routes should not show HTML body
    expect(output.split("\n")).toHaveLength(1);
  });

  it("formats a POST request with request and response bodies", () => {
    const output = formatRequest(
      makeRequest({
        method: "POST",
        statusCode: 201,
        requestBody: '{"name":"John"}',
        responseBody: '{"id":1,"name":"John"}',
      }),
    );
    expect(output).toContain("POST");
    expect(output).toContain("201");
    expect(output).toContain('"name"');
    expect(output).toContain('"John"');
  });

  it("shows error response body even for non-API routes", () => {
    const output = formatRequest(
      makeRequest({
        url: "/dashboard",
        path: "/dashboard",
        statusCode: 500,
        responseBody: '{"error":"Internal server error"}',
      }),
    );
    expect(output).toContain("500");
    expect(output).toContain("Internal server error");
  });

  it("formats a 500 error with timing", () => {
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

  it("skips RSC payloads in response body", () => {
    const output = formatRequest(
      makeRequest({
        method: "POST",
        responseBody: '0:{"a":"$@1","f":"","b":"development"}',
      }),
    );
    // RSC payload should not be displayed
    expect(output).not.toContain("development");
  });

  it("skips HTML bodies", () => {
    const output = formatRequest(
      makeRequest({
        statusCode: 500,
        responseBody: '<!DOCTYPE html><html><body>Error</body></html>',
      }),
    );
    expect(output).not.toContain("DOCTYPE");
  });

  it("pretty-prints short JSON response bodies", () => {
    const output = formatRequest(
      makeRequest({
        responseBody: '{"id":1,"name":"John"}',
      }),
    );
    // Should be pretty-printed with newlines
    expect(output).toContain('"id": 1');
  });

  it("includes response size", () => {
    const output = formatRequest(makeRequest({ responseSize: 2048 }));
    expect(output).toContain("2.0kb");
  });

  it("truncates long body values", () => {
    const longBody = '{"key":"' + "x".repeat(1000) + '"}';
    const output = formatRequest(
      makeRequest({
        method: "POST",
        requestBody: longBody,
      }),
    );
    expect(output).toContain("...");
  });
});
