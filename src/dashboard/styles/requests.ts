export function getRequestStyles(): string {
  return `
/* Request rows */
.req-row{display:flex;align-items:center;gap:16px;padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s;font-family:var(--mono);font-size:14px}
.req-row:hover{background:var(--bg-hover)}
.req-row.expanded{background:var(--bg-muted)}
.req-summary{display:flex;align-items:center;gap:16px;font-family:var(--mono);font-size:14px}
.req-method{font-weight:700;width:60px;flex-shrink:0}
.method-GET{color:var(--green)}.method-POST{color:var(--blue)}.method-PUT,.method-PATCH{color:var(--amber)}.method-DELETE{color:var(--red)}
.req-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.req-status{font-weight:600;width:36px;text-align:right}
.status-2xx{color:var(--green)}.status-3xx{color:var(--cyan)}.status-4xx{color:var(--amber)}.status-5xx{color:var(--red)}
.req-duration{color:var(--text-dim);width:70px;text-align:right}
.req-size{color:var(--text-muted);width:60px;text-align:right;font-size:13px}
.req-detail{padding:16px 28px 20px;border-bottom:1px solid var(--border);background:var(--bg-detail);display:none}
.req-detail.open{display:block}

/* JSON */
.json-key{color:var(--cyan)}.json-str{color:var(--green)}.json-num{color:var(--amber)}.json-bool{color:var(--accent)}.json-null{color:var(--red)}

/* Telemetry list views */
.tel-method{width:50px;font-weight:500;flex-shrink:0}
.tel-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tel-status{width:50px;text-align:right}
.tel-status-err{color:var(--red)}
.tel-duration{width:70px;text-align:right;color:var(--text-muted)}
.tel-timestamp{width:130px;text-align:right;color:var(--text-muted)}
.tel-level{width:52px;flex-shrink:0;font-size:10px;font-weight:600;text-align:center;padding:3px 0;border-radius:4px;letter-spacing:.5px}
.tel-level-error{color:var(--red);background:rgba(220,38,38,0.08)}
.tel-level-warn{color:var(--amber);background:rgba(217,119,6,0.08)}
.tel-level-info{color:var(--blue);background:rgba(37,99,235,0.08)}
.tel-level-debug{color:var(--text-muted);background:var(--bg-muted)}
.tel-level-log{color:var(--text-dim);background:var(--bg-muted)}
.tel-error-name{width:120px;color:var(--red);font-weight:500;flex-shrink:0}
.tel-message{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim)}
.tel-mono{font-family:var(--mono);font-size:12px}
.tel-clickable{cursor:pointer}
.error-stack{padding:8px 16px;font-size:10px;color:var(--text-dim);white-space:pre-wrap;font-family:var(--mono);background:var(--bg-muted);border-bottom:1px solid var(--border)}

/* Query rows */
.query-row{display:flex;align-items:center;gap:16px;font-family:var(--mono);font-size:12px}
.query-op{width:70px;flex-shrink:0;font-weight:600;border-right:1px solid var(--border-subtle);padding-right:16px}
.query-table{width:120px;flex-shrink:0;font-weight:500;color:var(--text);border-right:1px solid var(--border-subtle);padding-right:16px}
.query-preview{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:10px;border-right:1px solid var(--border-subtle);padding-right:16px}
.query-dur{width:60px;flex-shrink:0;text-align:right}
.query-slow{color:var(--red);font-weight:500}
.query-detail{display:none;padding:0 28px 12px;position:relative}
.query-detail.open{display:block}
.query-detail-sql{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;font-family:var(--mono);font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--text-dim);max-height:200px;overflow-y:auto;margin:0}
.query-detail-copy{position:absolute;top:8px;right:36px;padding:2px 8px;font-size:9px;font-family:var(--mono);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);cursor:pointer;transition:all .15s}
.query-detail-copy:hover{background:var(--bg-hover);color:var(--text);border-color:var(--border-light)}

/* Fetch analysis */
.fetch-analysis,#log-analysis{padding:16px 28px 0}
.fetch-summary{display:flex;gap:24px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;box-shadow:var(--shadow-sm);flex-wrap:wrap}
.fetch-stat{display:flex;flex-direction:column;gap:2px}
.fetch-stat-value{font-size:17px;font-weight:700;font-family:var(--mono);color:var(--text)}
.fetch-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600}
.fetch-groups-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:10px}
.fetch-groups{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}
.fetch-group{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;box-shadow:var(--shadow-sm);transition:all .15s}
.fetch-group:hover{border-color:var(--border-light);box-shadow:var(--shadow-md)}
.fetch-group-header{display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px}
.fetch-group-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--text)}
.fetch-group-count{font-size:12px;color:var(--text-muted);flex-shrink:0;background:var(--bg-muted);padding:2px 8px;border-radius:10px}
.fetch-group-meta{display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--text-dim);font-family:var(--mono)}
.fetch-group-meta span{display:flex;align-items:center;gap:4px}
.fetch-group-callers{margin-top:6px;font-size:11px;color:var(--text-muted)}
.fetch-group-callers strong{color:var(--text-dim);font-weight:500}
.fetch-group-err{color:var(--red)}
`;
}
