import { describe, it, expect } from "vitest";
import { isDashboardRequest } from "../../src/dashboard/router.js";

describe("isDashboardRequest", () => {
  it("matches /__brakit exactly", () => {
    expect(isDashboardRequest("/__brakit")).toBe(true);
  });

  it("matches /__brakit/ with trailing slash", () => {
    expect(isDashboardRequest("/__brakit/")).toBe(true);
  });

  it("matches /__brakit/api/requests", () => {
    expect(isDashboardRequest("/__brakit/api/requests")).toBe(true);
  });

  it("matches /__brakit/api/events", () => {
    expect(isDashboardRequest("/__brakit/api/events")).toBe(true);
  });

  it("does not match /", () => {
    expect(isDashboardRequest("/")).toBe(false);
  });

  it("does not match /api/users", () => {
    expect(isDashboardRequest("/api/users")).toBe(false);
  });

  it("does not match /api/__brakit", () => {
    expect(isDashboardRequest("/api/__brakit")).toBe(false);
  });

  it("does not match /__brakitfoo (no slash after prefix)", () => {
    expect(isDashboardRequest("/__brakitfoo")).toBe(false);
  });
});
