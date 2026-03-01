import { describe, it, expect, beforeEach } from "vitest";
import { RequestStore } from "../../src/store/request-store.js";
import { makeCaptureInput } from "../helpers/index.js";

let store: RequestStore;

describe("dashboard API data layer", () => {
  beforeEach(() => {
    store = new RequestStore();
  });

  it("getRequests returns captured requests", () => {
    store.capture(makeCaptureInput({ url: "/api/a" }));
    store.capture(makeCaptureInput({ url: "/api/b" }));
    store.capture(makeCaptureInput({ url: "/api/c" }));

    const requests = store.getAll();
    expect(requests).toHaveLength(3);
    expect(requests[0].url).toBe("/api/a");
    expect(requests[2].url).toBe("/api/c");
  });

  it("captured requests preserve the method field", () => {
    store.capture(makeCaptureInput({ method: "GET", url: "/api/a" }));
    store.capture(makeCaptureInput({ method: "POST", url: "/api/b" }));
    store.capture(makeCaptureInput({ method: "GET", url: "/api/c" }));

    const all = [...store.getAll()].reverse();
    const getOnly = all.filter((r) => r.method === "GET");
    expect(getOnly).toHaveLength(2);
  });

  it("captured requests preserve the statusCode field", () => {
    store.capture(makeCaptureInput({ statusCode: 200 }));
    store.capture(makeCaptureInput({ statusCode: 404 }));
    store.capture(makeCaptureInput({ statusCode: 500 }));

    const all = [...store.getAll()];
    const errors = all.filter((r) => r.statusCode >= 400);
    expect(errors).toHaveLength(2);
  });

  it("captured requests preserve the url field", () => {
    store.capture(makeCaptureInput({ url: "/api/users" }));
    store.capture(makeCaptureInput({ url: "/api/videos" }));
    store.capture(makeCaptureInput({ url: "/api/users/123" }));

    const all = [...store.getAll()];
    const matched = all.filter((r) =>
      r.url.toLowerCase().includes("users"),
    );
    expect(matched).toHaveLength(2);
  });

  it("captured requests preserve the responseBody field", () => {
    store.capture(
      makeCaptureInput({
        url: "/api/a",
        responseBody: Buffer.from('{"error":"not found"}'),
        responseContentType: "application/json",
      }),
    );
    store.capture(
      makeCaptureInput({
        url: "/api/b",
        responseBody: Buffer.from('{"data":"ok"}'),
        responseContentType: "application/json",
      }),
    );

    const all = [...store.getAll()];
    const matched = all.filter(
      (r) => r.responseBody?.toLowerCase().includes("not found"),
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].url).toBe("/api/a");
  });

  it("clearRequests empties the store", () => {
    store.capture(makeCaptureInput());
    store.capture(makeCaptureInput());
    expect(store.getAll()).toHaveLength(2);

    store.clear();
    expect(store.getAll()).toHaveLength(0);
  });

  it("each request has a unique id", () => {
    store.capture(makeCaptureInput());
    store.capture(makeCaptureInput());

    const requests = store.getAll();
    expect(requests[0].id).not.toBe(requests[1].id);
  });
});
