import { describe, it, expect } from "vitest";
import { labelRequest, extractSourcePage } from "../../src/analysis/label.js";
import type { TracedRequest } from "../../src/types.js";

function makeReq(overrides: Partial<TracedRequest> = {}): TracedRequest {
  return {
    id: "test-" + Math.random().toString(36).slice(2, 8),
    method: "GET",
    url: "/api/users",
    path: "/api/users",
    headers: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: {},
    responseBody: null,
    startedAt: 0,
    durationMs: 50,
    responseSize: 100,
    isStatic: false,
    ...overrides,
  };
}

describe("labelRequest", () => {
  it("labels auth handshake (307 with clerk params)", () => {
    const req = makeReq({
      statusCode: 307,
      url: "/?__clerk_handshake=eyJ...",
      path: "/",
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("auth-handshake");
    expect(labeled.label).toBe("Auth handshake");
  });

  it("labels middleware rewrite to /api/* as data-fetch with human label", () => {
    const req = makeReq({
      method: "GET",
      path: "/",
      url: "/",
      responseHeaders: { "x-middleware-rewrite": "http://localhost:3001/api/user" },
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("data-fetch");
    expect(labeled.label).toBe("Loaded user");
  });

  it("labels middleware rewrite to non-API route as middleware", () => {
    const req = makeReq({
      path: "/en",
      url: "/en",
      responseHeaders: { "x-middleware-rewrite": "/fr/home" },
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("middleware");
    expect(labeled.label).toContain("Redirected");
  });

  it("labels GET /api/user as 'Loaded user'", () => {
    const req = makeReq({ method: "GET", path: "/api/user", url: "/api/user" });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("data-fetch");
    expect(labeled.label).toBe("Loaded user");
  });

  it("labels GET /api/videos as 'Loaded video'", () => {
    const req = makeReq({ method: "GET", path: "/api/videos", url: "/api/videos" });
    const labeled = labelRequest(req);
    expect(labeled.label).toBe("Loaded video");
  });

  it("labels POST /api/videos as 'Created video'", () => {
    const req = makeReq({ method: "POST", path: "/api/videos", url: "/api/videos" });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("api-call");
    expect(labeled.label).toBe("Created video");
  });

  it("labels POST /api/videos/enhance as 'Enhanced video enhance'", () => {
    const req = makeReq({ method: "POST", path: "/api/videos/enhance", url: "/api/videos/enhance" });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("api-call");
    expect(labeled.label).toContain("Enhanced");
  });

  it("labels DELETE /api/videos as 'Deleted video'", () => {
    const req = makeReq({ method: "DELETE", path: "/api/videos", url: "/api/videos" });
    const labeled = labelRequest(req);
    expect(labeled.label).toBe("Deleted video");
  });

  it("labels failed data fetch", () => {
    const req = makeReq({ method: "GET", path: "/api/user", url: "/api/user", statusCode: 404 });
    const labeled = labelRequest(req);
    expect(labeled.label).toContain("Failed to load");
  });

  it("labels POST to page route as server-action", () => {
    const req = makeReq({
      method: "POST",
      path: "/",
      url: "/",
      responseHeaders: { "content-type": "text/x-component" },
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("server-action");
  });

  it("labels page load", () => {
    const req = makeReq({
      path: "/dashboard",
      url: "/dashboard",
      responseHeaders: { "content-type": "text/html; charset=utf-8" },
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("page-load");
    expect(labeled.label).toBe("Loaded page");
  });

  it("labels RSC navigation", () => {
    const req = makeReq({
      url: "/prompt?_rsc=vusbg",
      path: "/prompt",
    });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("navigation");
    expect(labeled.label).toBe("Navigated");
  });

  it("labels static assets", () => {
    const req = makeReq({ isStatic: true, path: "/_next/static/chunk.js" });
    const labeled = labelRequest(req);
    expect(labeled.category).toBe("static");
  });
});

describe("extractSourcePage", () => {
  it("extracts page path from referer header", () => {
    const req = makeReq({ headers: { referer: "http://localhost:3002/history" } });
    expect(extractSourcePage(req)).toBe("/history");
  });

  it("extracts nested path", () => {
    const req = makeReq({ headers: { referer: "http://localhost:3002/dashboard/settings" } });
    expect(extractSourcePage(req)).toBe("/dashboard/settings");
  });

  it("returns undefined when no referer", () => {
    const req = makeReq({ headers: {} });
    expect(extractSourcePage(req)).toBeUndefined();
  });

  it("returns root for root referer", () => {
    const req = makeReq({ headers: { referer: "http://localhost:3002/" } });
    expect(extractSourcePage(req)).toBe("/");
  });
});
