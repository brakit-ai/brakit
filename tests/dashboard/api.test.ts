import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  captureRequest,
  clearRequests,
  getRequests,
  type CaptureInput,
} from "../../src/store/request-log.js";

function makeCaptureInput(
  overrides: Partial<CaptureInput> = {},
): CaptureInput {
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

describe("dashboard API data layer", () => {
  beforeEach(() => {
    clearRequests();
  });

  it("getRequests returns captured requests", () => {
    captureRequest(makeCaptureInput({ url: "/api/a" }));
    captureRequest(makeCaptureInput({ url: "/api/b" }));
    captureRequest(makeCaptureInput({ url: "/api/c" }));

    const requests = getRequests();
    expect(requests).toHaveLength(3);
    expect(requests[0].url).toBe("/api/a");
    expect(requests[2].url).toBe("/api/c");
  });

  it("captured requests preserve the method field", () => {
    captureRequest(makeCaptureInput({ method: "GET", url: "/api/a" }));
    captureRequest(makeCaptureInput({ method: "POST", url: "/api/b" }));
    captureRequest(makeCaptureInput({ method: "GET", url: "/api/c" }));

    const all = [...getRequests()].reverse();
    const getOnly = all.filter((r) => r.method === "GET");
    expect(getOnly).toHaveLength(2);
  });

  it("captured requests preserve the statusCode field", () => {
    captureRequest(makeCaptureInput({ statusCode: 200 }));
    captureRequest(makeCaptureInput({ statusCode: 404 }));
    captureRequest(makeCaptureInput({ statusCode: 500 }));

    const all = [...getRequests()];
    const errors = all.filter((r) => r.statusCode >= 400);
    expect(errors).toHaveLength(2);
  });

  it("captured requests preserve the url field", () => {
    captureRequest(makeCaptureInput({ url: "/api/users" }));
    captureRequest(makeCaptureInput({ url: "/api/videos" }));
    captureRequest(makeCaptureInput({ url: "/api/users/123" }));

    const all = [...getRequests()];
    const matched = all.filter((r) =>
      r.url.toLowerCase().includes("users"),
    );
    expect(matched).toHaveLength(2);
  });

  it("captured requests preserve the responseBody field", () => {
    captureRequest(
      makeCaptureInput({
        url: "/api/a",
        responseBody: Buffer.from('{"error":"not found"}'),
        responseContentType: "application/json",
      }),
    );
    captureRequest(
      makeCaptureInput({
        url: "/api/b",
        responseBody: Buffer.from('{"data":"ok"}'),
        responseContentType: "application/json",
      }),
    );

    const all = [...getRequests()];
    const matched = all.filter(
      (r) => r.responseBody?.toLowerCase().includes("not found"),
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].url).toBe("/api/a");
  });

  it("clearRequests empties the store", () => {
    captureRequest(makeCaptureInput());
    captureRequest(makeCaptureInput());
    expect(getRequests()).toHaveLength(2);

    clearRequests();
    expect(getRequests()).toHaveLength(0);
  });

  it("each request has a unique id", () => {
    captureRequest(makeCaptureInput());
    captureRequest(makeCaptureInput());

    const requests = getRequests();
    expect(requests[0].id).not.toBe(requests[1].id);
  });
});
