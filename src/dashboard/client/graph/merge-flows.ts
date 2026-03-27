/** Merges flow (action) data with graph API data into a unified node/edge set. */

import type { GraphNode, GraphEdge, FlowData, ConsolidatedFlow } from "./types.js";
import { DASHBOARD_PREFIX } from "../constants/api.js";
import { endpointKey } from "./endpoint-key.js";

interface MergedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function mergeFlowsAndGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
  flows: FlowData[],
): MergedGraph {
  const nodes: GraphNode[] = [...graphNodes];
  const edges: GraphEdge[] = [...graphEdges];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const actionMap = new Map<string, { endpointKeys: Set<string>; count: number; totalMs: number }>();
  for (const flow of flows) {
    const name = flow.label || "Unknown";
    let entry = actionMap.get(name);
    if (!entry) {
      entry = { endpointKeys: new Set(), count: 0, totalMs: 0 };
      actionMap.set(name, entry);
    }
    entry.count++;
    entry.totalMs += flow.totalDurationMs;
    for (const req of flow.requests) {
      if (req.path?.startsWith(DASHBOARD_PREFIX)) continue;
      entry.endpointKeys.add(endpointKey(req.method, req.path));
    }
  }

  for (const [name, info] of actionMap) {
    const actionId = `action:${name}`;
    if (!nodeIds.has(actionId)) {
      nodes.push({
        id: actionId,
        type: "action",
        label: name,
        stats: {
          requestCount: info.count,
          avgLatencyMs: info.count > 0 ? Math.round(info.totalMs / info.count) : 0,
          errorRate: 0,
          avgQueryCount: 0,
        },
      });
      nodeIds.add(actionId);
    }

    for (const epKey of info.endpointKeys) {
      const epId = `endpoint:${epKey}`;
      if (nodeIds.has(epId)) {
        const edgeId = `${actionId} -> ${epId}`;
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: actionId,
            target: epId,
            type: "triggers",
            stats: { frequency: info.count, avgLatencyMs: 0 },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/** Consolidate flows by action label — one entry per unique action name. */
export function consolidateFlows(flows: FlowData[]): ConsolidatedFlow[] {
  const map = new Map<string, { keys: Set<string>; count: number; totalMs: number }>();
  for (const flow of flows) {
    const name = flow.label || "Unknown";
    let entry = map.get(name);
    if (!entry) {
      entry = { keys: new Set(), count: 0, totalMs: 0 };
      map.set(name, entry);
    }
    entry.count++;
    entry.totalMs += flow.totalDurationMs;
    for (const req of flow.requests) {
      if (req.path?.startsWith(DASHBOARD_PREFIX)) continue;
      entry.keys.add(endpointKey(req.method, req.path));
    }
  }

  return [...map.entries()].map(([label, info]) => ({
    label,
    occurrences: info.count,
    endpointKeys: info.keys,
    avgDurationMs: info.count > 0 ? Math.round(info.totalMs / info.count) : 0,
  }));
}
