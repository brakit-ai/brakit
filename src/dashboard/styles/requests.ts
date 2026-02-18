export function getRequestStyles(): string {
  return `
/* Request rows */
.req-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
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
.tel-level{width:60px;font-weight:500;flex-shrink:0}
.tel-error-name{width:120px;color:var(--red);font-weight:500;flex-shrink:0}
.tel-message{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tel-mono{font-family:monospace;font-size:11px}
.tel-clickable{cursor:pointer}
.error-stack{padding:8px 16px;font-size:10px;color:var(--text-dim);white-space:pre-wrap;font-family:var(--mono);background:var(--bg-muted);border-bottom:1px solid var(--border)}

/* Query rows */
.query-row{display:flex;align-items:center;gap:16px;font-family:var(--mono);font-size:12px}
.query-op{width:70px;flex-shrink:0;font-weight:600;border-right:1px solid var(--border-subtle);padding-right:16px}
.query-table{width:120px;flex-shrink:0;font-weight:500;color:var(--text);border-right:1px solid var(--border-subtle);padding-right:16px}
.query-preview{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:10px;border-right:1px solid var(--border-subtle);padding-right:16px}
.query-dur{width:60px;flex-shrink:0;text-align:right}
.query-slow{color:var(--red);font-weight:500}
`;
}
