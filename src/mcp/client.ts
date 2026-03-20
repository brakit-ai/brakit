import {
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_INSIGHTS,
  DASHBOARD_API_QUERIES,
  DASHBOARD_API_FETCHES,
  DASHBOARD_API_ERRORS,
  DASHBOARD_API_ACTIVITY,
  DASHBOARD_API_METRICS_LIVE,
  DASHBOARD_API_FINDINGS,
  DASHBOARD_API_FINDINGS_REPORT,
  DASHBOARD_API_CLEAR,
} from "../constants/labels.js";
import { CLIENT_FETCH_TIMEOUT_MS, HEALTH_CHECK_TIMEOUT_MS } from "../constants/features.js";
import type { TracedQuery, TracedFetch } from "../types/index.js";
import type {
  RequestsResponse,
  IssuesResponse,
  TelemetryEntriesResponse,
  ActivityResponse,
  LiveMetricsResponse,
  FindingsResponse,
} from "./types.js";

export class BrakitClient {
  constructor(private baseUrl: string) {}

  async getRequests(params?: {
    method?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<RequestsResponse> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_REQUESTS}`);
    if (params?.method) url.searchParams.set("method", params.method);
    if (params?.status) url.searchParams.set("status", params.status);
    if (params?.search) url.searchParams.set("search", params.search);
    if (params?.limit) url.searchParams.set("limit", String(params.limit));
    if (params?.offset) url.searchParams.set("offset", String(params.offset));
    return this.fetchJson(url);
  }

  async getIssues(params?: {
    state?: string;
    category?: string;
  }): Promise<IssuesResponse> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_INSIGHTS}`);
    if (params?.state) url.searchParams.set("state", params.state);
    if (params?.category) url.searchParams.set("category", params.category);
    return this.fetchJson(url);
  }

  async getQueries(requestId?: string): Promise<TelemetryEntriesResponse<TracedQuery>> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_QUERIES}`);
    if (requestId) url.searchParams.set("requestId", requestId);
    return this.fetchJson(url);
  }

  async getFetches(requestId?: string): Promise<TelemetryEntriesResponse<TracedFetch>> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_FETCHES}`);
    if (requestId) url.searchParams.set("requestId", requestId);
    return this.fetchJson(url);
  }

  async getErrors(): Promise<TelemetryEntriesResponse> {
    return this.fetchJson(`${this.baseUrl}${DASHBOARD_API_ERRORS}`);
  }

  async getActivity(requestId: string): Promise<ActivityResponse> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_ACTIVITY}`);
    url.searchParams.set("requestId", requestId);
    return this.fetchJson(url);
  }

  async getLiveMetrics(): Promise<LiveMetricsResponse> {
    return this.fetchJson(`${this.baseUrl}${DASHBOARD_API_METRICS_LIVE}`);
  }

  async getFindings(state?: string): Promise<FindingsResponse> {
    const url = new URL(`${this.baseUrl}${DASHBOARD_API_FINDINGS}`);
    if (state) url.searchParams.set("state", state);
    return this.fetchJson(url);
  }

  async reportFix(findingId: string, status: string, notes: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${DASHBOARD_API_FINDINGS_REPORT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingId, status, notes }),
      signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return false;
    const body = await res.json() as Record<string, unknown>;
    return body.ok === true;
  }

  async clearAll(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${DASHBOARD_API_CLEAR}`, {
      method: "POST",
      signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS),
    });
    return res.ok;
  }

  async isAlive(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}${DASHBOARD_API_REQUESTS}?limit=1`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchJson<T>(url: string | URL): Promise<T> {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Brakit API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }
}
