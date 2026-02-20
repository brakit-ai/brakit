// Display constants — color maps, fonts, chart config, and UI label maps.
// Values are JS source fragments (template strings) interpolated into browser code at build time.

import {
  HEALTH_FAST_MS,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  HEALTH_SLOW_MS,
} from "./thresholds.js";

// Color maps for telemetry displays
export const QUERY_OP_COLORS = `{ SELECT: 'var(--blue)', INSERT: 'var(--green)', UPDATE: 'var(--amber)', DELETE: 'var(--red)', COUNT: 'var(--text-muted)' }`;

export const LOG_LEVEL_COLORS = `{ error: 'var(--red)', warn: 'var(--amber)', info: 'var(--blue)', debug: 'var(--text-muted)', log: 'var(--text-dim)' }`;

export const GRAPH_COLORS = `['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2','#ea580c','#c026d3','#059669','#db2777']`;

// Canvas dot colors (CSS vars don't work on canvas — hex required)
export const DOT_COLORS = `{ green: '#4ade80', amber: '#fbbf24', red: '#f87171' }`;

// Health grade visual config (threshold-ordered for lookup)
export const HEALTH_GRADES = `[
  { max: ${HEALTH_FAST_MS}, label: 'Fast', color: 'var(--green)', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  { max: ${HEALTH_GOOD_MS}, label: 'Good', color: 'var(--green)', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.15)' },
  { max: ${HEALTH_OK_MS}, label: 'OK', color: 'var(--amber)', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)' },
  { max: ${HEALTH_SLOW_MS}, label: 'Slow', color: 'var(--red)', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.15)' },
  { max: Infinity, label: 'Critical', color: 'var(--red)', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' }
]`;

// Chart canvas rendering constants
export const CHART_GRID_COLOR = "'rgba(228,228,231,0.8)'";
export const CHART_LABEL_COLOR = "'rgba(113,113,122,0.7)'";
export const CHART_FONT = "'10px monospace'";
export const CHART_FONT_SM = "'9px monospace'";
export const CHART_FONT_XS = "'8px monospace'";
export const CHART_PAD = `{ top: 16, right: 16, bottom: 28, left: 52 }`;

// Timeline display config
export const TL_TYPE_COLORS = `{ fetch: 'var(--blue)', log: 'var(--text-muted)', error: 'var(--red)', query: 'var(--accent)' }`;
export const TL_TYPE_LABELS = `{ fetch: 'FETCH', log: 'LOG', error: 'ERROR', query: 'QUERY' }`;

// Sensitive header names for client-side masking
export const SENSITIVE_HEADERS = `['cookie','set-cookie','authorization','proxy-authorization','x-api-key','x-auth-token']`;

// HTTP status code display map
export const HTTP_STATUS_MAP = `{400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',408:'Timeout',409:'Conflict',422:'Unprocessable',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'}`;

// Navigation and header labels
export const NAV_LABELS = `{ queries: 'Queries', requests: 'Requests', actions: 'Actions', errors: 'Errors', security: 'Security', fetches: 'Fetches', logs: 'Logs', performance: 'Performance' }`;

export const CURL_SKIP_HEADERS = `['host', 'connection', 'accept-encoding']`;
