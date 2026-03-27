/** Visual constants for the graph view. */

import type { OverlayLayer } from "./types.js";

// ── Layout geometry ──

export const GRAPH_PAD = 50;
export const GRAPH_COL_GAP = 160;
export const GRAPH_ROW_GAP = 10;
export const NODE_MIN_HEIGHT = 36;
export const NODE_MAX_HEIGHT = 64;
export const NODE_MIN_WIDTH = 140;
export const GRAPH_REFRESH_MS = 4_000;

/** Approximate character width (px) used for node label sizing. */
export const CHAR_WIDTH_PX = 7.2;
/** Extra horizontal padding added to node width beyond label text. */
export const NODE_LABEL_PAD_PX = 36;

// ── Overlay layer config ──

export interface LayerInfo {
  label: string;
  color: string;
  icon: string;
  tooltip: string;
}

export const LAYER_CONFIG: Record<OverlayLayer, LayerInfo> = {
  auth:        { label: "Auth",     color: "#059669", icon: "🛡", tooltip: "Highlight which endpoints require authentication and which are unprotected" },
  security:    { label: "Security", color: "#dc2626", icon: "⚠",  tooltip: "Show security findings like exposed secrets, token leaks, and PII exposure" },
  performance: { label: "Perf",     color: "#2563eb", icon: "⚡", tooltip: "Color endpoints by P95 latency — green (fast) to red (slow)" },
  issues:      { label: "Issues",   color: "#d97706", icon: "●",  tooltip: "Badge endpoints with open issues like N+1 queries or redundant calls" },
  heat:        { label: "Heat",     color: "#ef4444", icon: "🔥", tooltip: "Color nodes and edges by traffic volume — blue (low) to red (hot)" },
};

// ── Node type styling ──

export interface NodeTypeStyle {
  fill: string;
  stroke: string;
  icon: string;
  columnHeader: string;
}

export const NODE_TYPE_STYLE: Record<string, NodeTypeStyle> = {
  action:   { fill: "#faf5ff", stroke: "#a855f7", icon: "▶", columnHeader: "ACTIONS" },
  endpoint: { fill: "#f8fafc", stroke: "#6366f1", icon: "⚡", columnHeader: "ENDPOINTS" },
  table:    { fill: "#f0fdf4", stroke: "#16a34a", icon: "⊞", columnHeader: "TABLES" },
  external: { fill: "#fffbeb", stroke: "#d97706", icon: "◆", columnHeader: "EXTERNAL" },
};

// ── Edge colors by relationship type ──

export const EDGE_COLORS: Record<string, string> = {
  triggers: "#a855f7",
  reads:    "#6366f1",
  writes:   "#ef4444",
  fetches:  "#f59e0b",
  calls:    "#22c55e",
};

// ── Latency health thresholds (ms → color) ──

const LATENCY_FAST_MS = 100;
const LATENCY_MODERATE_MS = 300;
const LATENCY_SLOW_MS = 800;

export function latencyColor(ms: number): string {
  if (ms < LATENCY_FAST_MS) return "#22c55e";
  if (ms < LATENCY_MODERATE_MS) return "#3b82f6";
  if (ms < LATENCY_SLOW_MS) return "#eab308";
  return "#ef4444";
}

// ── Traffic heat thresholds (ratio → color) ──

const HEAT_LOW = 0.25;
const HEAT_MEDIUM = 0.5;
const HEAT_HIGH = 0.75;

export function trafficHeatColor(ratio: number): string {
  if (ratio < HEAT_LOW) return "#3b82f6";
  if (ratio < HEAT_MEDIUM) return "#22c55e";
  if (ratio < HEAT_HIGH) return "#eab308";
  return "#ef4444";
}

// ── Highlight colors ──

export const LOCKED_STROKE = "#4338ca";
export const LOCKED_FILL = "#e0e7ff";
export const HOVER_STROKE = "#818cf8";
export const HOVER_FILL = "#eef2ff";
export const FLOW_TRACE_COLOR = "#7c3aed";
export const SEARCH_RING_COLOR = "#6366f1";
export const AUTH_WARNING_COLOR = "#f97316";
export const AUTH_SHIELD_BG = "#ecfdf5";
export const AUTH_SHIELD_STROKE = "#059669";
export const CRITICAL_FINDING_BG = "#fef2f2";
export const CRITICAL_FINDING_COLOR = "#dc2626";
export const WARNING_FINDING_BG = "#fffbeb";
export const WARNING_FINDING_COLOR = "#d97706";
export const ERROR_COLOR = "#ef4444";

// ── Zoom limits ──

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 1.2;
export const PAN_STEP_PX = 40;

// ── Minimap ──

export const MINIMAP_WIDTH = 150;
export const MINIMAP_HEIGHT = 100;
export const MINIMAP_THRESHOLD_W = 800;
export const MINIMAP_THRESHOLD_H = 600;

// ── SVG viewBox defaults ──

export const SVG_MIN_WIDTH = 800;
export const SVG_MIN_HEIGHT = 500;
