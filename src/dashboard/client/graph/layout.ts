/**
 * Graph layout engine — positions nodes in columns (actions → endpoints → tables → external)
 * and computes edge paths between them.
 */

import type { GraphNode, GraphEdge, PositionedNode, PositionedEdge } from "./types.js";
import {
  GRAPH_PAD,
  GRAPH_COL_GAP,
  GRAPH_ROW_GAP,
  NODE_MIN_HEIGHT,
  NODE_MAX_HEIGHT,
  NODE_MIN_WIDTH,
  CHAR_WIDTH_PX,
  NODE_LABEL_PAD_PX,
  EDGE_COLORS,
} from "./constants.js";

export interface GraphLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

interface Column {
  type: string;
  items: GraphNode[];
  width: number;
  x: number;
}

function textWidth(label: string): number {
  return Math.max(NODE_MIN_WIDTH, label.length * CHAR_WIDTH_PX + NODE_LABEL_PAD_PX);
}

function nodeHeight(node: GraphNode, maxRequestCount: number): number {
  return Math.round(
    NODE_MIN_HEIGHT + (node.stats.requestCount / maxRequestCount) * (NODE_MAX_HEIGHT - NODE_MIN_HEIGHT),
  );
}

function columnWidth(items: GraphNode[]): number {
  return items.length > 0 ? Math.max(NODE_MIN_WIDTH, ...items.map((n) => textWidth(n.label))) : 0;
}

/** Average Y-center of already-positioned nodes connected to this node. */
function averageConnectedY(nodeId: string, edges: GraphEdge[], posMap: Map<string, PositionedNode>): number {
  const yValues: number[] = [];
  for (const e of edges) {
    const otherId = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
    if (otherId) {
      const positioned = posMap.get(otherId);
      if (positioned) yValues.push(positioned.y + positioned.h / 2);
    }
  }
  return yValues.length > 0 ? yValues.reduce((a, b) => a + b, 0) / yValues.length : Infinity;
}

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphLayout {
  const byType = (t: string) =>
    nodes.filter((n) => n.type === t).sort((a, b) => b.stats.requestCount - a.stats.requestCount);

  const actions = byType("action");
  const endpoints = byType("endpoint");
  const tables = byType("table");
  const externals = byType("external");

  const maxRequestCount = Math.max(1, ...nodes.map((n) => n.stats.requestCount));

  const posMap = new Map<string, PositionedNode>();
  const result: PositionedNode[] = [];

  const columns: Column[] = [];
  let cursorX = GRAPH_PAD;

  const columnDefs: { type: string; items: GraphNode[] }[] = [
    { type: "action", items: actions },
    { type: "endpoint", items: endpoints },
    { type: "table", items: tables },
    { type: "external", items: externals },
  ];

  for (const def of columnDefs) {
    if (def.items.length > 0) {
      const w = columnWidth(def.items);
      columns.push({ type: def.type, items: def.items, width: w, x: cursorX });
      cursorX += w + GRAPH_COL_GAP;
    }
  }

  // Place first column top-to-bottom
  const primaryCol = columns[0];
  if (primaryCol) {
    let y = GRAPH_PAD + 24; // offset for column header
    for (const node of primaryCol.items) {
      const h = nodeHeight(node, maxRequestCount);
      const positioned: PositionedNode = {
        id: node.id, x: primaryCol.x, y, w: primaryCol.width, h,
        label: node.label, type: node.type, stats: node.stats, annotations: node.annotations,
      };
      result.push(positioned);
      posMap.set(node.id, positioned);
      y += h + GRAPH_ROW_GAP;
    }
  }

  // Place subsequent columns, ordered by barycenter of connected nodes
  for (let ci = 1; ci < columns.length; ci++) {
    const col = columns[ci];
    const sorted = [...col.items].sort((a, b) => {
      return averageConnectedY(a.id, edges, posMap) - averageConnectedY(b.id, edges, posMap);
    });

    const prevNodes = result.filter((n) => n.x === columns[ci - 1].x);
    const prevTop = Math.min(...prevNodes.map((n) => n.y));
    const prevBottom = Math.max(...prevNodes.map((n) => n.y + n.h));
    const prevHeight = prevBottom - prevTop;
    const totalHeight = sorted.reduce((sum, n) => sum + nodeHeight(n, maxRequestCount) + GRAPH_ROW_GAP, -GRAPH_ROW_GAP);
    let y = prevTop + Math.max(0, (prevHeight - totalHeight) / 2);

    for (const node of sorted) {
      const h = nodeHeight(node, maxRequestCount);
      const positioned: PositionedNode = {
        id: node.id, x: col.x, y, w: col.width, h,
        label: node.label, type: node.type, stats: node.stats, annotations: node.annotations,
      };
      result.push(positioned);
      posMap.set(node.id, positioned);
      y += h + GRAPH_ROW_GAP;
    }
  }

  // Compute edges
  const layoutEdges: PositionedEdge[] = [];
  for (const edge of edges) {
    const src = posMap.get(edge.source);
    const tgt = posMap.get(edge.target);
    if (!src || !tgt) continue;

    const goRight = src.x < tgt.x;
    const sx = goRight ? src.x + src.w : src.x;
    const sy = src.y + src.h / 2;
    const tx = goRight ? tgt.x : tgt.x + tgt.w;
    const ty = tgt.y + tgt.h / 2;

    const labelParts: string[] = [];
    if (edge.stats.frequency > 1) labelParts.push(`${edge.stats.frequency}×`);
    labelParts.push(edge.type);
    if (edge.stats.avgLatencyMs > 0) labelParts.push(`${edge.stats.avgLatencyMs}ms`);

    layoutEdges.push({
      key: edge.id,
      sx, sy, tx, ty,
      label: labelParts.join(" · "),
      color: EDGE_COLORS[edge.type] || "#94a3b8",
      thickness: Math.min(0.75 + Math.log2(edge.stats.frequency + 1) * 0.35, 2.5),
      dashed: edge.type === "reads" || edge.type === "writes",
      data: edge,
    });
  }

  const maxX = result.reduce((m, n) => Math.max(m, n.x + n.w), 0);
  const maxY = result.reduce((m, n) => Math.max(m, n.y + n.h), 0);

  return {
    nodes: result,
    edges: layoutEdges,
    width: maxX + GRAPH_PAD * 2,
    height: Math.max(maxY + GRAPH_PAD, 250),
  };
}
