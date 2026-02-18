export function getPerformanceStyles(): string {
  return `
/* Performance tab */
.perf-selector{display:flex;gap:6px;flex-wrap:wrap;padding:16px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-selector-btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);padding:6px 12px;border-radius:var(--radius);font-size:12px;cursor:pointer;font-family:var(--mono);font-weight:500;transition:all .15s;display:flex;align-items:center;gap:8px;box-shadow:var(--shadow-sm)}
.perf-selector-btn:hover{background:var(--bg-hover);color:var(--text)}
.perf-selector-btn.active{background:var(--bg-active);color:var(--accent);border-color:var(--border-light)}
.perf-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Insights panel */
.perf-insights{display:flex;align-items:center;gap:24px;padding:20px 28px;border-bottom:1px solid var(--border-subtle)}
.perf-health-card{display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:var(--radius);border:1px solid}
.perf-health-label{font-size:17px;font-weight:700;font-family:var(--sans)}
.perf-health-value{font-size:13px;font-family:var(--mono);color:var(--text-dim)}
.perf-obs-list{display:flex;flex-direction:column;gap:6px}
.perf-obs{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-dim);font-family:var(--sans)}
.perf-obs strong{color:var(--text);font-family:var(--mono);font-weight:600}
.perf-obs-icon{font-size:10px;flex-shrink:0}

/* Endpoint cards */
.perf-cards{padding:16px 28px;display:flex;flex-direction:column;gap:8px}
.perf-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow-sm)}
.perf-card:hover{background:var(--bg-hover);border-color:var(--border-light);box-shadow:var(--shadow-md)}
.perf-card-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.perf-card-name{flex:1;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Health badges */
.perf-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;border:1px solid;letter-spacing:.3px;font-family:var(--sans);flex-shrink:0}
.perf-badge-lg{padding:4px 12px;font-size:13px;border-radius:var(--radius-sm)}
.perf-badge-sm{padding:1px 6px;font-size:9px}

/* Response time bars */
.perf-card-bars{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.perf-bar-row{display:flex;align-items:center;gap:10px}
.perf-bar-label{font-size:10px;font-family:var(--mono);color:var(--text-muted);width:24px;text-align:right;flex-shrink:0}
.perf-bar-track{flex:1;height:6px;background:var(--bg-muted);border-radius:3px;overflow:hidden}
.perf-bar-fill{height:100%;border-radius:3px;transition:width .3s}
.perf-bar-value{font-size:11px;font-family:var(--mono);color:var(--text-dim);width:56px;text-align:right;flex-shrink:0}

/* Card footer with sparkline + trend */
.perf-card-footer{display:flex;align-items:center;gap:12px}
.perf-spark{width:80px;height:24px;flex-shrink:0}
.perf-trend{font-size:11px;font-family:var(--sans);font-weight:600}
.perf-trend-lg{font-size:13px}
.perf-card-stat{font-size:11px;font-family:var(--mono);color:var(--text-muted)}

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

/* Session history table */
.perf-history-wrap{padding:0 28px 20px}
.perf-history-wrap .col-header{padding:8px 0;margin:0;position:static;background:var(--bg);gap:0}
.perf-hist-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:12px}
.perf-hist-row:hover{background:var(--bg-hover);margin:0 -28px;padding-left:28px;padding-right:28px}
.perf-col{flex-shrink:0;border-right:1px solid var(--border-subtle);padding-right:16px;margin-right:16px}
.perf-col:last-child{border-right:none;padding-right:0;margin-right:0}
.perf-col-date{width:130px;color:var(--text-dim)}
.perf-col-health{width:60px;display:flex;align-items:center}
.perf-col-avg{width:70px;color:var(--text)}
.perf-col-p95{width:70px;color:var(--text-muted)}
.perf-col-trend{width:70px}
.perf-col-reqs{width:60px;text-align:right;color:var(--text-dim)}
.perf-col-err{width:50px;text-align:right}
.perf-col-qpr{width:60px;text-align:right;color:var(--text-dim)}
`;
}
