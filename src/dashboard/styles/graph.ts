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
