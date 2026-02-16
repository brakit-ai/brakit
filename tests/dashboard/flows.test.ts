import { describe, it, expect } from "vitest";
import { labelRequest, groupRequestsIntoFlows, extractSourcePage } from "../../src/dashboard/flows.js";
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

// --- Human-Readable Labels ---

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

// --- Source Page Extraction ---

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

// --- Flow Grouping ---

describe("groupRequestsIntoFlows", () => {
  it("groups requests within time gap into one flow", () => {
    const requests = [
      makeReq({ startedAt: 1000, durationMs: 50, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1020, durationMs: 100, path: "/api/videos", url: "/api/videos" }),
      makeReq({ startedAt: 1080, durationMs: 200, path: "/api/user", url: "/api/user" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(1);
    expect(flows[0].requests).toHaveLength(3);
  });

  it("splits flows when gap > 5 seconds", () => {
    const requests = [
      makeReq({ startedAt: 1000, durationMs: 50, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1020, durationMs: 100, path: "/api/videos", url: "/api/videos" }),
      // Big gap (>5s after last request ends at 1120ms)
      makeReq({ startedAt: 7000, durationMs: 50, path: "/api/user", url: "/api/user" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(2);
    expect(flows[0].requests).toHaveLength(2);
    expect(flows[1].requests).toHaveLength(1);
  });

  it("splits flows when referer page changes", () => {
    const requests = [
      makeReq({
        startedAt: 1000, durationMs: 50, path: "/api/user", url: "/api/user",
        headers: { referer: "http://localhost:3000/history" },
      }),
      makeReq({
        startedAt: 1020, durationMs: 100, path: "/api/videos", url: "/api/videos",
        headers: { referer: "http://localhost:3000/history" },
      }),
      // Different referer page - should start new flow (even within time gap)
      makeReq({
        startedAt: 1200, durationMs: 50, path: "/api/user", url: "/api/user",
        headers: { referer: "http://localhost:3000/prompt" },
      }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(2);
    expect(flows[0].sourcePage).toBe("/history");
    expect(flows[1].sourcePage).toBe("/prompt");
  });

  it("splits flows on page-load even from same referer", () => {
    const requests = [
      makeReq({
        startedAt: 1000, durationMs: 50, path: "/api/user", url: "/api/user",
        headers: { referer: "http://localhost:3000/history" },
      }),
      // Page load starts a new flow
      makeReq({
        startedAt: 1200, durationMs: 100, path: "/prompt", url: "/prompt",
        responseHeaders: { "content-type": "text/html" },
        headers: { referer: "http://localhost:3000/history" },
      }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(2);
  });

  it("skips brakit internal requests", () => {
    const requests = [
      makeReq({ startedAt: 1000, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1010, path: "/__brakit/api/requests", url: "/__brakit/api/requests" }),
      makeReq({ startedAt: 1020, path: "/api/videos", url: "/api/videos" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(1);
    expect(flows[0].requests).toHaveLength(2);
  });

  it("skips static assets", () => {
    const requests = [
      makeReq({ startedAt: 1000, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1010, path: "/_next/static/chunk.js", isStatic: true }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(1);
    expect(flows[0].requests).toHaveLength(1);
  });

  it("labels flow from trigger request with human name", () => {
    const requests = [
      makeReq({ startedAt: 1000, method: "GET", path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1020, method: "POST", path: "/api/videos", url: "/api/videos" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    // POST (api-call) should take priority as the flow label
    expect(flows[0].label).toContain("Created");
    expect(flows[0].label.toLowerCase()).toContain("video");
  });

  it("names flow after page when source page is known", () => {
    const requests = [
      makeReq({
        startedAt: 1000, method: "GET", path: "/api/user", url: "/api/user",
        headers: { referer: "http://localhost:3000/history" },
      }),
      makeReq({
        startedAt: 1020, method: "GET", path: "/api/videos", url: "/api/videos",
        headers: { referer: "http://localhost:3000/history" },
      }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows[0].label).toContain("History");
    expect(flows[0].label).toContain("Page");
  });

  it("detects errors in flow", () => {
    const requests = [
      makeReq({ startedAt: 1000, statusCode: 200, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1020, statusCode: 500, path: "/api/videos", url: "/api/videos" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows[0].hasErrors).toBe(true);
  });

  it("marks duplicate requests and computes redundancy %", () => {
    const requests = [
      makeReq({ startedAt: 1000, path: "/api/user", url: "/api/user", responseBody: '{"id":1}' }),
      makeReq({ startedAt: 1050, path: "/api/user", url: "/api/user", responseBody: '{"id":1}' }),
      makeReq({ startedAt: 1100, path: "/api/videos", url: "/api/videos" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    // 2nd /api/user should be marked as duplicate
    const dupReqs = flows[0].requests.filter((r) => r.isDuplicate);
    expect(dupReqs).toHaveLength(1);
    expect(dupReqs[0].path).toBe("/api/user");

    // 1 out of 3 = 33% redundancy
    expect(flows[0].redundancyPct).toBe(33);
  });

  it("warns about duplicates with same data", () => {
    const requests = [
      makeReq({ startedAt: 1000, path: "/api/user", url: "/api/user", responseBody: '{"id":1}' }),
      makeReq({ startedAt: 1050, path: "/api/user", url: "/api/user", responseBody: '{"id":1}' }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows[0].warnings.length).toBeGreaterThan(0);
    expect(flows[0].warnings[0]).toContain("duplicated");
    expect(flows[0].warnings[0]).toContain("same data");
  });

  it("reports 0% redundancy for clean flows", () => {
    const requests = [
      makeReq({ startedAt: 1000, path: "/api/user", url: "/api/user" }),
      makeReq({ startedAt: 1020, path: "/api/videos", url: "/api/videos" }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows[0].redundancyPct).toBe(0);
  });

  it("collapses 3+ consecutive identical GETs into a polling entry", () => {
    const requests = [
      makeReq({ startedAt: 1000, method: "POST", path: "/api/videos/generate", url: "/api/videos/generate" }),
      makeReq({ startedAt: 1500, method: "GET", path: "/api/videos/status", url: "/api/videos/status", durationMs: 300 }),
      makeReq({ startedAt: 4000, method: "GET", path: "/api/videos/status", url: "/api/videos/status", durationMs: 300 }),
      makeReq({ startedAt: 6500, method: "GET", path: "/api/videos/status", url: "/api/videos/status", durationMs: 300 }),
      makeReq({ startedAt: 9000, method: "GET", path: "/api/videos/status", url: "/api/videos/status", durationMs: 300 }),
      makeReq({ startedAt: 11500, method: "GET", path: "/api/videos/status", url: "/api/videos/status", durationMs: 300 }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    expect(flows).toHaveLength(1);
    expect(flows[0].requests).toHaveLength(2);
    expect(flows[0].requests[0].category).toBe("api-call");
    expect(flows[0].requests[1].category).toBe("polling");
    expect(flows[0].requests[1].pollingCount).toBe(5);
    expect(flows[0].requests[1].label).toContain("Polling");
    expect(flows[0].requests[1].label).toContain("5x");
  });

  it("calculates total duration", () => {
    const requests = [
      makeReq({ startedAt: 1000, durationMs: 50 }),
      makeReq({ startedAt: 1020, durationMs: 200 }),
    ];

    const flows = groupRequestsIntoFlows(requests);
    // Total = from first start to last end = max(1050, 1220) - 1000 = 220
    expect(flows[0].totalDurationMs).toBe(220);
  });

  it("returns empty array for no requests", () => {
    expect(groupRequestsIntoFlows([])).toHaveLength(0);
  });
});
