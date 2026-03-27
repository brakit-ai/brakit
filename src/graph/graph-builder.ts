/**
 * GraphBuilder — listens to EventBus events and incrementally builds
 * a runtime dependency graph of the application.
 *
 * Timing: queries and fetches fire DURING request processing, but
 * request:completed fires AFTER the response is sent. We buffer
 * telemetry events by parentRequestId and process them when the
 * request completes (so we know the endpoint key).
 */

import type { EventBus, AnalysisUpdate } from "../core/event-bus.js";
import type { RequestStore } from "../store/request-store.js";
import type {
  TracedRequest,
  TracedQuery,
  TracedFetch,
} from "../types/index.js";
import { getEndpointKey } from "../utils/endpoint.js";
import { normalizeQueryParams } from "../instrument/adapters/normalize.js";
import { isDashboardRequest } from "../dashboard/router.js";
import { detectCategory, hasAuthCredentials } from "../analysis/categorize.js";
import type {
  GraphNode,
  GraphEdge,
  LiveGraph,
  ClusterInfo,
  GraphApiResponse,
  NodeAnnotations,
} from "./graph-model.js";
import {
  MAX_PATTERNS_PER_EDGE,
  CLUSTER_SPLIT_THRESHOLD,
  COMMON_PATH_PREFIXES,
  PENDING_BUFFER_MAX,
  PENDING_EVICTION_TARGET,
  PENDING_TTL_MS,
  type GroupingStrategy,
} from "./constants.js";

function shouldSkipRequest(req: TracedRequest): boolean {
  if (req.isStatic || req.isHealthCheck) return true;
  if (isDashboardRequest(req.path)) return true;
  return false;
}

function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1")
      return null;
    return host;
  } catch {
    return null;
  }
}

function makeEdgeId(source: string, target: string): string {
  return `${source} -> ${target}`;
}

function upsertNode(
  graph: LiveGraph,
  id: string,
  type: GraphNode["type"],
  label: string,
  now: number,
): GraphNode {
  let node = graph.nodes.get(id);
  if (!node) {
    node = {
      id,
      type,
      label,
      stats: {
        requestCount: 0,
        avgLatencyMs: 0,
        errorRate: 0,
        avgQueryCount: 0,
        lastSeenAt: now,
        firstSeenAt: now,
      },
    };
    graph.nodes.set(id, node);
  }
  node.stats.lastSeenAt = now;
  return node;
}

function upsertEdge(
  graph: LiveGraph,
  source: string,
  target: string,
  type: GraphEdge["type"],
  now: number,
): GraphEdge {
  const id = makeEdgeId(source, target);
  let edge = graph.edges.get(id);
  if (!edge) {
    edge = {
      id,
      source,
      target,
      type,
      stats: {
        frequency: 0,
        avgLatencyMs: 0,
        lastSeenAt: now,
        firstSeenAt: now,
      },
    };
    graph.edges.set(id, edge);
  }
  edge.stats.lastSeenAt = now;
  return edge;
}

function updateRollingAvg(
  current: number,
  newValue: number,
  count: number,
): number {
  return Math.round(current + (newValue - current) / count);
}

interface PendingTelemetry {
  queries: TracedQuery[];
  fetches: TracedFetch[];
  createdAt: number;
}

export class GraphBuilder {
  private graph: LiveGraph = {
    nodes: new Map(),
    edges: new Map(),
    metadata: { totalObservations: 0, lastUpdatedAt: Date.now() },
  };

  /**
   * Buffered telemetry events waiting for their parent request to complete.
   * Key = parentRequestId, value = pending queries/fetches.
   */
  private pending = new Map<string, PendingTelemetry>();

  /** Accumulated request categories per endpoint node. */
  private nodeCategories = new Map<string, Set<string>>();

  /** Latest analysis snapshot — refreshed on every analysis:updated event. */
  private latestAnalysis: AnalysisUpdate | null = null;

  private cleanupUnsubs: (() => void)[] = [];

  constructor(
    private bus: EventBus,
    private requestStore: RequestStore,
  ) {}

  start(): void {
    this.cleanupUnsubs.push(
      this.bus.on("request:completed", (req) => this.handleRequest(req)),
      this.bus.on("telemetry:query", (q) => this.handleQuery(q as TracedQuery)),
      this.bus.on("telemetry:fetch", (f) => this.handleFetch(f as TracedFetch)),
      this.bus.on("analysis:updated", (update) =>
        this.handleAnalysisUpdate(update),
      ),
    );
  }

  stop(): void {
    for (const unsub of this.cleanupUnsubs) unsub();
    this.cleanupUnsubs.length = 0;
  }

  getGraph(): LiveGraph {
    return this.graph;
  }

  /**
   * Enrich endpoint nodes with p95 from an external metrics source.
   * Called by the API handler which has access to MetricsStore.
   */
  enrichWithMetrics(getP95: (endpointKey: string) => number | undefined): void {
    for (const node of this.graph.nodes.values()) {
      if (node.type !== "endpoint") continue;
      const key = node.label; // label is the endpointKey: "GET /api/users"
      const p95 = getP95(key);
      if (p95 !== undefined) {
        if (!node.annotations) node.annotations = {};
        node.annotations.p95Ms = Math.round(p95);
      }
    }
  }

  getApiResponse(options?: {
    cluster?: string;
    node?: string;
    level?: string;
    grouping?: string;
  }): GraphApiResponse {
    const grouping = (options?.grouping ?? "path") as GroupingStrategy;
    const clusters = this.computeClusters(grouping);

    if (options?.level === "endpoints") {
      return this.getEndpointView();
    }
    if (options?.node) {
      return this.getNodeNeighborhood(options.node, clusters);
    }
    if (options?.cluster) {
      return this.getClusterExpanded(options.cluster, clusters);
    }

    return this.getClusterView(clusters);
  }

  clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
    this.graph.metadata.totalObservations = 0;
    this.pending.clear();
    this.nodeCategories.clear();
    this.latestAnalysis = null;
  }

  private handleAnalysisUpdate(update: AnalysisUpdate): void {
    this.latestAnalysis = update;
    this.enrichNodesFromAnalysis();
  }

  private enrichNodesFromAnalysis(): void {
    if (!this.latestAnalysis) return;
    const { findings, insights, issues } = this.latestAnalysis;

    for (const node of this.graph.nodes.values()) {
      if (node.type !== "endpoint") continue;
      if (node.annotations) {
        node.annotations.securityFindings = undefined;
        node.annotations.insights = undefined;
        node.annotations.openIssueCount = undefined;
      }
    }

    for (const f of findings) {
      if (!f.endpoint) continue;
      const nodeId = `endpoint:${f.endpoint}`;
      const node = this.graph.nodes.get(nodeId);
      if (!node) continue;
      if (!node.annotations) node.annotations = {};
      if (!node.annotations.securityFindings)
        node.annotations.securityFindings = [];
      const existing = node.annotations.securityFindings.find(
        (s) => s.rule === f.rule,
      );
      if (existing) {
        existing.count = f.count;
      } else {
        node.annotations.securityFindings.push({
          rule: f.rule,
          severity: f.severity,
          title: f.title,
          count: f.count,
        });
      }
    }

    const endpointNodesByLabel = new Map<string, GraphNode>();
    for (const node of this.graph.nodes.values()) {
      if (node.type === "endpoint") endpointNodesByLabel.set(node.label, node);
    }

    for (const insight of insights) {
      if (!insight.nav) continue;
      for (const [label, node] of endpointNodesByLabel) {
        if (insight.title.includes(label) || insight.desc.includes(label)) {
          if (!node.annotations) node.annotations = {};
          if (!node.annotations.insights) node.annotations.insights = [];
          if (
            !node.annotations.insights.some(
              (i) => i.type === insight.type && i.title === insight.title,
            )
          ) {
            node.annotations.insights.push({
              type: insight.type,
              severity: insight.severity,
              title: insight.title,
            });
          }
        }
      }
    }

    for (const si of issues) {
      if (!si.issue.endpoint) continue;
      const nodeId = `endpoint:${si.issue.endpoint}`;
      const node = this.graph.nodes.get(nodeId);
      if (!node) continue;
      if (si.state === "open" || si.state === "regressed") {
        if (!node.annotations) node.annotations = {};
        node.annotations.openIssueCount =
          (node.annotations.openIssueCount ?? 0) + 1;
      }
    }

    for (const insight of insights) {
      if (insight.type !== "n1" && insight.type !== "redundant-query") continue;
      for (const edge of this.graph.edges.values()) {
        if (edge.type !== "reads" && edge.type !== "writes") continue;
        const sourceNode = this.graph.nodes.get(edge.source);
        if (
          sourceNode?.annotations?.insights?.some(
            (i) => i.type === insight.type,
          )
        ) {
          if (!edge.annotations) edge.annotations = {};
          edge.annotations.hasIssue = true;
        }
      }
    }
  }

  private handleRequest(req: TracedRequest): void {
    if (shouldSkipRequest(req)) return;

    const now = Date.now();
    const endpointKey = getEndpointKey(req.method, req.path);
    const nodeId = `endpoint:${endpointKey}`;

    const node = upsertNode(this.graph, nodeId, "endpoint", endpointKey, now);
    node.stats.requestCount++;

    const category = detectCategory(req);
    let cats = this.nodeCategories.get(nodeId);
    if (!cats) {
      cats = new Set();
      this.nodeCategories.set(nodeId, cats);
    }
    cats.add(category);

    if (!node.annotations) node.annotations = {};
    node.annotations.categories = [...cats];
    node.annotations.isMiddleware = cats.has("middleware");

    if (!node.annotations.hasAuth) {
      node.annotations.hasAuth =
        cats.has("auth-check") ||
        cats.has("auth-handshake") ||
        hasAuthCredentials(req);
    }
    node.stats.avgLatencyMs = updateRollingAvg(
      node.stats.avgLatencyMs,
      req.durationMs,
      node.stats.requestCount,
    );

    const isError = req.statusCode >= 400 ? 1 : 0;
    node.stats.errorRate =
      node.stats.errorRate +
      (isError - node.stats.errorRate) / node.stats.requestCount;

    this.graph.metadata.totalObservations++;
    this.graph.metadata.lastUpdatedAt = now;

    const buffered = this.pending.get(req.id);
    if (buffered) {
      let queryCount = 0;
      for (const query of buffered.queries) {
        this.processQuery(query, nodeId, now);
        queryCount++;
      }
      for (const fetch of buffered.fetches) {
        this.processFetch(fetch, nodeId, now);
      }
      this.pending.delete(req.id);

      if (queryCount > 0) {
        node.stats.avgQueryCount = updateRollingAvg(
          node.stats.avgQueryCount,
          queryCount,
          node.stats.requestCount,
        );
      }
    }

    const now2 = Date.now();
    for (const [key, entry] of this.pending) {
      if (now2 - entry.createdAt > PENDING_TTL_MS) this.pending.delete(key);
    }
    if (this.pending.size > PENDING_BUFFER_MAX) {
      const keys = [...this.pending.keys()];
      for (let i = 0; i < keys.length - PENDING_EVICTION_TARGET; i++) {
        this.pending.delete(keys[i]);
      }
    }
  }

  private handleQuery(query: TracedQuery): void {
    if (!query.parentRequestId || !query.table) return;

    let pending = this.pending.get(query.parentRequestId);
    if (!pending) {
      pending = { queries: [], fetches: [], createdAt: Date.now() };
      this.pending.set(query.parentRequestId, pending);
    }
    pending.queries.push(query);
  }

  private handleFetch(fetch: TracedFetch): void {
    if (!fetch.parentRequestId) return;

    const hostname = extractHostname(fetch.url);
    if (!hostname) return;

    let pending = this.pending.get(fetch.parentRequestId);
    if (!pending) {
      pending = { queries: [], fetches: [], createdAt: Date.now() };
      this.pending.set(fetch.parentRequestId, pending);
    }
    pending.fetches.push(fetch);
  }

  // ── Process buffered events (called after request completes) ──

  private processQuery(
    query: TracedQuery,
    endpointNodeId: string,
    now: number,
  ): void {
    if (!query.table) return;

    const tableNodeId = `table:${query.table}`;
    upsertNode(this.graph, tableNodeId, "table", query.table, now);

    const edgeType =
      query.normalizedOp === "SELECT"
        ? ("reads" as const)
        : ("writes" as const);
    const edge = upsertEdge(
      this.graph,
      endpointNodeId,
      tableNodeId,
      edgeType,
      now,
    );
    edge.stats.frequency++;
    edge.stats.avgLatencyMs = updateRollingAvg(
      edge.stats.avgLatencyMs,
      query.durationMs,
      edge.stats.frequency,
    );

    if (query.sql) {
      const normalized = normalizeQueryParams(query.sql);
      if (normalized) {
        if (!edge.patterns) edge.patterns = [];
        if (
          !edge.patterns.includes(normalized) &&
          edge.patterns.length < MAX_PATTERNS_PER_EDGE
        ) {
          edge.patterns.push(normalized);
        }
      }
    }
  }

  private processFetch(
    fetch: TracedFetch,
    endpointNodeId: string,
    now: number,
  ): void {
    const hostname = extractHostname(fetch.url);
    if (!hostname) return;

    const externalNodeId = `external:${hostname}`;
    upsertNode(this.graph, externalNodeId, "external", hostname, now);

    const edge = upsertEdge(
      this.graph,
      endpointNodeId,
      externalNodeId,
      "fetches",
      now,
    );
    edge.stats.frequency++;
    edge.stats.avgLatencyMs = updateRollingAvg(
      edge.stats.avgLatencyMs,
      fetch.durationMs,
      edge.stats.frequency,
    );
  }

  // ── Clustering ──

  computeClusters(
    strategy: GroupingStrategy = "path",
  ): Map<string, ClusterInfo> {
    const endpointNodes = [...this.graph.nodes.values()].filter(
      (n) => n.type === "endpoint",
    );

    if (strategy === "auth-boundary") {
      return this.clusterByAuthBoundary(endpointNodes);
    }
    if (strategy === "data-domain") {
      return this.clusterByDataDomain(endpointNodes);
    }

    return this.clusterByPath(endpointNodes);
  }

  private clusterByPath(endpointNodes: GraphNode[]): Map<string, ClusterInfo> {
    const groups = new Map<string, string[]>();
    for (const node of endpointNodes) {
      const parts = node.label.split(" ");
      const path = parts[1] || parts[0];
      const segments = path.split("/").filter(Boolean);

      let i = 0;
      while (i < segments.length && COMMON_PATH_PREFIXES.has(segments[i])) {
        i++;
      }
      const groupKey = segments[i] || segments[0] || "root";

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(node.id);
    }

    const clusters = new Map<string, ClusterInfo>();
    for (const [key, children] of groups) {
      if (children.length > CLUSTER_SPLIT_THRESHOLD) {
        const subGroups = new Map<string, string[]>();
        for (const childId of children) {
          const node = this.graph.nodes.get(childId)!;
          const parts = node.label.split(" ");
          const path = parts[1] || parts[0];
          const segments = path.split("/").filter(Boolean);
          let idx = segments.indexOf(key);
          if (idx === -1) idx = 0;
          const subKey = `${key}/${segments[idx + 1] || "root"}`;
          if (!subGroups.has(subKey)) subGroups.set(subKey, []);
          subGroups.get(subKey)!.push(childId);
        }
        for (const [subKey, subChildren] of subGroups) {
          clusters.set(subKey, this.buildCluster(subKey, subChildren));
        }
      } else {
        clusters.set(key, this.buildCluster(key, children));
      }
    }

    return clusters;
  }

  private clusterByAuthBoundary(
    endpointNodes: GraphNode[],
  ): Map<string, ClusterInfo> {
    const authed: string[] = [];
    const unauthed: string[] = [];

    for (const node of endpointNodes) {
      if (node.annotations?.hasAuth) {
        authed.push(node.id);
      } else {
        unauthed.push(node.id);
      }
    }

    const clusters = new Map<string, ClusterInfo>();
    if (authed.length > 0)
      clusters.set("authenticated", this.buildCluster("authenticated", authed));
    if (unauthed.length > 0)
      clusters.set(
        "unauthenticated",
        this.buildCluster("unauthenticated", unauthed),
      );
    return clusters;
  }

  private clusterByDataDomain(
    endpointNodes: GraphNode[],
  ): Map<string, ClusterInfo> {
    const endpointTables = new Map<string, Set<string>>();
    for (const edge of this.graph.edges.values()) {
      if (edge.type !== "reads" && edge.type !== "writes") continue;
      const tableLabel = this.graph.nodes.get(edge.target)?.label;
      if (!tableLabel) continue;
      let tables = endpointTables.get(edge.source);
      if (!tables) {
        tables = new Set();
        endpointTables.set(edge.source, tables);
      }
      tables.add(tableLabel);
    }

    const groups = new Map<string, string[]>();
    for (const node of endpointNodes) {
      const tables = endpointTables.get(node.id);
      const groupKey =
        tables && tables.size > 0 ? [...tables].sort().join("+") : "no-db";
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(node.id);
    }

    const clusters = new Map<string, ClusterInfo>();
    for (const [key, children] of groups) {
      clusters.set(key, this.buildCluster(key, children));
    }
    return clusters;
  }

  private buildCluster(key: string, children: string[]): ClusterInfo {
    let totalLatency = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    let totalQueries = 0;
    let firstSeen = Infinity;
    let lastSeen = 0;

    for (const childId of children) {
      const node = this.graph.nodes.get(childId);
      if (!node) continue;
      totalRequests += node.stats.requestCount;
      totalLatency += node.stats.avgLatencyMs * node.stats.requestCount;
      totalErrors += node.stats.errorRate * node.stats.requestCount;
      totalQueries += node.stats.avgQueryCount * node.stats.requestCount;
      firstSeen = Math.min(firstSeen, node.stats.firstSeenAt);
      lastSeen = Math.max(lastSeen, node.stats.lastSeenAt);
    }

    return {
      id: `cluster:${key}`,
      label: key,
      children,
      stats: {
        requestCount: totalRequests,
        avgLatencyMs:
          totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
        avgQueryCount:
          totalRequests > 0
            ? Math.round((totalQueries / totalRequests) * 10) / 10
            : 0,
        lastSeenAt: lastSeen || Date.now(),
        firstSeenAt: firstSeen === Infinity ? Date.now() : firstSeen,
      },
    };
  }

  // ── API response builders ──

  private getEndpointView(): GraphApiResponse {
    // Return all nodes and all edges — no clustering
    const allNodes = [...this.graph.nodes.values()];
    const allEdges = [...this.graph.edges.values()];
    return {
      nodes: allNodes,
      edges: allEdges,
      clusters: [],
      metadata: this.graph.metadata,
    };
  }

  private getClusterView(clusters: Map<string, ClusterInfo>): GraphApiResponse {
    const clusterArr = [...clusters.values()];

    const otherNodes = [...this.graph.nodes.values()].filter(
      (n) => n.type !== "endpoint",
    );

    const endpointToCluster = new Map<string, string>();
    for (const c of clusterArr) {
      for (const childId of c.children) {
        endpointToCluster.set(childId, c.id);
      }
    }

    const edgeAgg = new Map<string, GraphEdge>();
    for (const edge of this.graph.edges.values()) {
      const sourceCluster = endpointToCluster.get(edge.source) ?? edge.source;
      const target = edge.target;
      const aggId = makeEdgeId(sourceCluster, target);

      let agg = edgeAgg.get(aggId);
      if (!agg) {
        agg = {
          id: aggId,
          source: sourceCluster,
          target,
          type: edge.type,
          stats: { ...edge.stats },
          patterns: edge.patterns ? [...edge.patterns] : undefined,
        };
        edgeAgg.set(aggId, agg);
      } else {
        agg.stats.frequency += edge.stats.frequency;
        agg.stats.avgLatencyMs = Math.round(
          (agg.stats.avgLatencyMs + edge.stats.avgLatencyMs) / 2,
        );
        agg.stats.lastSeenAt = Math.max(
          agg.stats.lastSeenAt,
          edge.stats.lastSeenAt,
        );
        agg.stats.firstSeenAt = Math.min(
          agg.stats.firstSeenAt,
          edge.stats.firstSeenAt,
        );
      }
    }

    return {
      nodes: otherNodes,
      edges: [...edgeAgg.values()],
      clusters: clusterArr,
      metadata: this.graph.metadata,
    };
  }

  private getClusterExpanded(
    clusterId: string,
    clusters: Map<string, ClusterInfo>,
  ): GraphApiResponse {
    const clusterKey = clusterId.startsWith("cluster:")
      ? clusterId.slice(8)
      : clusterId;
    const cluster = clusters.get(clusterKey);
    if (!cluster) return this.getClusterView(clusters);

    const childNodes: GraphNode[] = [];
    const connectedNodeIds = new Set<string>();
    const relevantEdges: GraphEdge[] = [];

    for (const childId of cluster.children) {
      const node = this.graph.nodes.get(childId);
      if (node) childNodes.push(node);

      for (const edge of this.graph.edges.values()) {
        if (edge.source === childId || edge.target === childId) {
          relevantEdges.push(edge);
          if (edge.source !== childId) connectedNodeIds.add(edge.source);
          if (edge.target !== childId) connectedNodeIds.add(edge.target);
        }
      }
    }

    for (const nodeId of connectedNodeIds) {
      if (!cluster.children.includes(nodeId)) {
        const node = this.graph.nodes.get(nodeId);
        if (node) childNodes.push(node);
      }
    }

    return {
      nodes: childNodes,
      edges: relevantEdges,
      clusters: [cluster],
      metadata: this.graph.metadata,
    };
  }

  private getNodeNeighborhood(
    nodeId: string,
    clusters: Map<string, ClusterInfo>,
  ): GraphApiResponse {
    const centerNode = this.graph.nodes.get(nodeId);
    if (!centerNode) return this.getClusterView(clusters);

    const nodes: GraphNode[] = [centerNode];
    const edges: GraphEdge[] = [];

    for (const edge of this.graph.edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        edges.push(edge);
        const otherId = edge.source === nodeId ? edge.target : edge.source;
        const otherNode = this.graph.nodes.get(otherId);
        if (otherNode) nodes.push(otherNode);
      }
    }

    return {
      nodes,
      edges,
      clusters: [],
      metadata: this.graph.metadata,
    };
  }
}
