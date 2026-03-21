export function getPerformanceStyles(): string {
  return `
/* Performance tab */
.perf-selector{display:flex;gap:6px;flex-wrap:wrap;padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-selector-btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:var(--radius);font-size:12px;cursor:pointer;font-family:var(--mono);font-weight:500;transition:all .15s;display:flex;align-items:center;gap:8px;box-shadow:var(--shadow-sm)}
.perf-selector-btn:hover{background:var(--bg-hover);color:var(--text)}
.perf-selector-btn.active{background:var(--bg-active);color:var(--accent);border-color:var(--border-light)}
.perf-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Health badges */
.perf-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;border:1px solid;letter-spacing:.3px;font-family:var(--sans);flex-shrink:0}
.perf-badge-lg{padding:4px 12px;font-size:13px;border-radius:var(--radius-sm)}
.perf-badge-sm{padding:1px 6px;font-size:9px}

/* Overview: summary cards */
.perf-overview{padding:16px 28px}
.perf-summary-row{display:flex;gap:8px;margin-bottom:16px}
.perf-summary-card{flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:var(--shadow-sm)}
.perf-summary-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-family:var(--sans);font-weight:600}
.perf-summary-value{font-size:20px;font-weight:700;font-family:var(--mono);color:var(--text)}
.perf-summary-value-sm{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Shared table styles */
.perf-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px}
.perf-table thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600;font-family:var(--sans);padding:10px 14px;border-bottom:2px solid var(--border);white-space:nowrap}
.perf-table tbody td{padding:11px 14px;border-bottom:1px solid var(--border-subtle);color:var(--text)}
.perf-table-row{cursor:pointer;transition:background var(--transition, .15s ease)}
.perf-table-row:hover{background:var(--bg-hover)}
.perf-table tbody tr:last-child td{border-bottom:none}
.perf-th-right{text-align:right !important}
.perf-th-center{text-align:center !important}
.perf-td-right{text-align:right}
.perf-td-center{text-align:center}
.perf-td-name{font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.perf-td-muted{color:var(--text-dim)}
.perf-row-err{background:var(--red-bg)}
.perf-row-err:hover{background:rgba(220,38,38,0.1)}

/* Heat map table wrapper */
.perf-heatmap{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm)}
.perf-hm-p95{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;border:1px solid}
.perf-hm-split-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--bg-muted);width:100%;min-width:80px}

/* Detail view */
.perf-detail-header{padding:20px 28px 16px;border-bottom:1px solid var(--border-subtle)}
.perf-detail-title{display:flex;align-items:center;gap:12px;font-size:17px;font-weight:600;color:var(--text);font-family:var(--mono)}
.perf-baseline-hint{font-size:11px;font-weight:400;color:var(--text-muted);padding:2px 8px;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius-sm)}
.perf-metric-row{display:flex;gap:4px;padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-metric-card{flex:1;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;display:flex;flex-direction:column;gap:4px}
.perf-metric-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-family:var(--sans);font-weight:600}
.perf-metric-value{font-size:21px;font-weight:700;font-family:var(--mono)}

/* Time breakdown */
.perf-breakdown{padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-breakdown-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--bg-muted);border:1px solid var(--border)}
.perf-breakdown-bar-sm{height:6px;border-radius:3px;flex:1}
.perf-breakdown-seg{min-width:2px;transition:width .3s}
.perf-breakdown-db{background:var(--breakdown-db)}
.perf-breakdown-fetch{background:var(--breakdown-fetch)}
.perf-breakdown-app{background:var(--breakdown-app)}
.perf-breakdown-legend{display:flex;gap:16px;margin-top:8px;font-size:11px;font-family:var(--mono);color:var(--text-muted)}
.perf-breakdown-item{display:flex;align-items:center;gap:5px}
.perf-breakdown-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
span.perf-breakdown-dot.perf-breakdown-db{background:var(--breakdown-db)}
span.perf-breakdown-dot.perf-breakdown-fetch{background:var(--breakdown-fetch)}
span.perf-breakdown-dot.perf-breakdown-app{background:var(--breakdown-app)}
.perf-breakdown-inline{margin:0 0 8px;display:flex;align-items:center;gap:10px}
.perf-breakdown-labels{display:flex;gap:8px;font-size:10px;font-family:var(--mono);color:var(--text-muted);flex-shrink:0}
.perf-breakdown-lbl{display:flex;align-items:center;gap:3px}
.perf-col-breakdown{flex:1;min-width:140px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.perf-bd-tag{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;font-size:10px;font-family:var(--mono);font-weight:500;white-space:nowrap}
.perf-bd-tag-db{color:#818cf8;background:rgba(99,102,241,0.1)}
.perf-bd-tag-fetch{color:#fbbf24;background:rgba(245,158,11,0.1)}
.perf-bd-tag-app{color:var(--breakdown-app);background:rgba(148,163,184,0.1)}
.perf-col-muted{color:var(--text-dim)}

/* Chart */
.perf-chart-wrap{padding:16px 28px}
.perf-canvas{border-radius:var(--radius);background:var(--bg-muted);border:1px solid var(--border)}
.perf-section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:10px}

/* Request history */
.perf-history-wrap{padding:0 28px 20px}
.perf-hist-row-hl{background:rgba(37,99,235,0.1) !important;border-left:3px solid #4ade80}

/* Callers section */
.perf-callers{padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-callers-list{display:flex;flex-direction:column;gap:0}
.perf-caller-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:12px}
.perf-caller-row:last-child{border-bottom:none}
.perf-caller-name{flex:1;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.perf-caller-count{color:var(--text-muted);font-size:11px;flex-shrink:0}
.perf-caller-avg{color:var(--text-dim);font-size:11px;flex-shrink:0}

/* Query breakdown section */
.perf-queries{padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-queries-loading{font-size:11px;color:var(--text-muted);font-family:var(--mono)}
.perf-queries-list{display:flex;flex-direction:column;gap:0}
.perf-query-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:12px}
.perf-query-row:last-child{border-bottom:none}
.perf-query-label{flex:1;font-weight:500;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.perf-query-avg{color:var(--text-muted);font-size:11px;flex-shrink:0}
.perf-query-count{color:var(--text-dim);font-size:11px;flex-shrink:0}

/* Session trends */
.perf-trends{padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-trends-list{display:flex;flex-direction:column;gap:0}
.perf-trend-row{display:flex;align-items:center;gap:14px;padding:8px 12px;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:12px}
.perf-trend-row:last-child{border-bottom:none}
.perf-trend-current{background:var(--bg-muted);border-radius:var(--radius-sm);font-weight:600}
.perf-trend-time{width:80px;color:var(--text-dim);font-size:11px;flex-shrink:0}
.perf-trend-p95{flex-shrink:0}
.perf-trend-reqs{color:var(--text-muted);font-size:11px;flex-shrink:0}
.perf-trend-errs{font-size:11px;flex-shrink:0}
.perf-trend-arrow{font-size:10px;font-weight:600;flex-shrink:0}
.perf-trend-slower{color:var(--red)}
.perf-trend-faster{color:var(--green)}
`;
}
