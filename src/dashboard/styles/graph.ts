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

/* Overview: endpoint list with inline scatter charts */
.perf-endpoint-list{padding:16px 28px;display:flex;flex-direction:column;gap:8px}
.perf-endpoint-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 20px 8px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow-sm)}
.perf-endpoint-card:hover{background:var(--bg-hover);border-color:var(--border-light);box-shadow:var(--shadow-md)}
.perf-ep-header{display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.perf-ep-name{flex:1;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:120px}
.perf-ep-stats{display:flex;align-items:center;gap:14px;flex-shrink:0}
.perf-ep-stat{font-size:11px;font-family:var(--mono);color:var(--text-muted)}
.perf-ep-stat-err{color:var(--red)}
.perf-ep-stat-warn{color:var(--amber)}
.perf-ep-stat-muted{color:var(--text-dim)}
.perf-inline-canvas{width:100%;height:88px;border-radius:var(--radius-sm);background:var(--bg-muted);border:1px solid var(--border);display:block}

/* Detail view */
.perf-detail-header{padding:20px 28px 16px;border-bottom:1px solid var(--border-subtle)}
.perf-detail-title{display:flex;align-items:center;gap:12px;font-size:17px;font-weight:600;color:var(--text);font-family:var(--mono)}
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

/* Request history table */
.perf-history-wrap{padding:0 28px 20px}
.perf-history-wrap .col-header{padding:8px 0;margin:0;position:static;background:var(--bg);gap:0}
.perf-hist-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:12px}
.perf-hist-row:hover{background:var(--bg-hover);margin:0 -28px;padding-left:28px;padding-right:28px}
.perf-hist-row-err{background:rgba(220,38,38,0.04)}
.perf-hist-row-err:hover{background:rgba(220,38,38,0.08)}
.perf-hist-row-hl{background:rgba(37,99,235,0.1);margin:0 -28px;padding-left:28px;padding-right:28px;border-left:3px solid #4ade80}
.perf-hist-row-hl.perf-hist-row-err{background:rgba(220,38,38,0.12);border-left-color:#f87171}
.perf-col{flex-shrink:0;border-right:1px solid var(--border-subtle);padding-right:16px;margin-right:16px}
.perf-col:last-child{border-right:none;padding-right:0;margin-right:0}
.perf-col-date{width:100px;color:var(--text-dim)}
.perf-col-health{width:60px;display:flex;align-items:center}
.perf-col-avg{width:70px;color:var(--text)}
.perf-col-status{width:50px;text-align:center}
.perf-col-qpr{width:60px;text-align:right;color:var(--text-dim)}
`;
}
