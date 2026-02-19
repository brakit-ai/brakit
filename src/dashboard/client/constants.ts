// Client-side display constants — embedded into browser JS via template strings.
// Values here are JS source fragments (strings/numbers) interpolated at build time.

// Color maps for telemetry displays
export const QUERY_OP_COLORS = `{ SELECT: 'var(--blue)', INSERT: 'var(--green)', UPDATE: 'var(--amber)', DELETE: 'var(--red)', COUNT: 'var(--text-muted)' }`;

export const LOG_LEVEL_COLORS = `{ error: 'var(--red)', warn: 'var(--amber)', info: 'var(--blue)', debug: 'var(--text-muted)', log: 'var(--text-dim)' }`;

export const GRAPH_COLORS = `['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2','#ea580c','#c026d3','#059669','#db2777']`;

// Health grade thresholds (ms)
export const HEALTH_FAST_MS = 100;
export const HEALTH_GOOD_MS = 300;
export const HEALTH_OK_MS = 800;
export const HEALTH_SLOW_MS = 2000;

// Query display thresholds
export const SLOW_QUERY_THRESHOLD_MS = 100;
export const HIGH_QUERY_COUNT_PER_REQ = 5;

// Overview insight thresholds
export const N1_QUERY_THRESHOLD = 5;
export const ERROR_RATE_THRESHOLD_PCT = 20;
export const SLOW_ENDPOINT_THRESHOLD_MS = 1000;
export const MIN_REQUESTS_FOR_INSIGHT = 2;

// Auth overhead detection
export const AUTH_OVERHEAD_PCT = 30;
export const AUTH_SLOW_MS = 500;

// Over-fetching detection
export const LARGE_RESPONSE_BYTES = 51_200; // 50KB
export const HIGH_ROW_COUNT = 100;
export const OVERFETCH_MIN_REQUESTS = 2;

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
export const CHART_PAD = `{ top: 16, right: 16, bottom: 28, left: 52 }`;
