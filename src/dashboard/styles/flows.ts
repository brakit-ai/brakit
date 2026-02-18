export function getFlowStyles(): string {
  return `
/* Flow rows */
.flow-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
.flow-row:hover{background:var(--bg-hover)}
.flow-row.expanded{background:var(--bg-muted)}
.flow-summary-row{display:flex;align-items:center;gap:16px;font-size:14px}
.flow-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.flow-status-dot.dot-clean{background:var(--green)}
.flow-status-dot.dot-warn{background:var(--amber)}
.flow-status-dot.dot-error{background:var(--red)}
.flow-label{font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.flow-req-count{font-family:var(--mono);font-size:13px;color:var(--text-muted);flex-shrink:0;width:60px;text-align:right}
.flow-badge-text{font-size:13px;color:var(--text-muted);flex-shrink:0;font-family:var(--mono);width:120px;text-align:right}
.flow-badge-text.has-warn{color:var(--amber)}
.flow-badge-text.has-error{color:var(--red)}
.flow-duration{font-family:var(--mono);font-size:13px;color:var(--text-dim);flex-shrink:0;width:70px;text-align:right}

/* Flow expand panel */
.flow-expand{display:none;padding:0 28px 16px;border-bottom:1px solid var(--border);background:var(--bg-detail)}
.flow-expand.open{display:block}

/* Simple mode traffic + insights */
.flow-traffic{padding:8px 0;font-family:var(--mono);font-size:13px}
.traffic-row{display:flex;align-items:center;gap:12px;padding:6px 0}
.traffic-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);padding-bottom:8px;margin-bottom:4px}
.traffic-row .t-method{font-weight:700;width:52px;flex-shrink:0;font-size:12px}
.traffic-row .t-path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.traffic-row .t-path.is-dup{color:var(--text-muted)}
.traffic-row .t-status{flex-shrink:0;width:28px;text-align:right;font-weight:600}
.traffic-row .t-dur{color:var(--text-dim);width:60px;text-align:right;flex-shrink:0}
.traffic-row .t-size{color:var(--text-muted);width:50px;text-align:right;flex-shrink:0;font-size:12px}
.traffic-row .t-dup{font-size:11px;color:var(--amber);flex-shrink:0;width:50px;text-align:right}
.traffic-body{padding:2px 0 4px 0}
.traffic-body-toggle{font-size:12px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;border:none;background:none;font-family:var(--mono);letter-spacing:.3px;transition:color .15s}
.traffic-body-toggle:hover{color:var(--text-dim)}
.traffic-body-toggle .arrow-out{color:var(--blue)}
.traffic-body-toggle .arrow-in{color:var(--green)}
.traffic-body-toggle .chevron{font-size:10px;transition:transform .15s;display:inline-block}
.traffic-body-toggle.open .chevron{transform:rotate(90deg)}
.traffic-body pre{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-family:var(--mono);font-size:12px;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.5;margin:4px 0 0;display:none}
.traffic-body pre.open{display:block}
.traffic-separator{height:8px}
.flow-divider{border-top:1px solid var(--border-subtle);margin:12px 0 8px}
.flow-insights{padding:0;font-size:13px;line-height:1.8;color:var(--text-dim)}
.flow-insights .insight-line{padding:2px 0}
.flow-insights .insight-error{color:var(--red)}
.flow-insights .insight-warn{color:var(--amber)}
.flow-insights .insight-tip{margin-top:8px;color:var(--text-muted);font-size:12px}

/* Detailed mode sub-rows */
.flow-subreqs{padding:4px 0}
.flow-subreq{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:13px;cursor:pointer;transition:background .1s}
.flow-subreq:last-child{border-bottom:none}
.flow-subreq:hover{background:var(--bg-hover);margin:0 -28px;padding-left:28px;padding-right:28px}
.flow-subreq .subreq-method{font-weight:700;width:52px;flex-shrink:0;font-size:12px}
.flow-subreq .subreq-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.flow-subreq .subreq-label.is-dup{color:var(--text-muted)}
.flow-subreq .subreq-status{flex-shrink:0;width:28px;text-align:right}
.flow-subreq .subreq-dur{color:var(--text-dim);width:60px;text-align:right;flex-shrink:0}
.flow-subreq .subreq-dup-tag{font-size:11px;color:var(--amber);flex-shrink:0}
.flow-subreq-detail{display:none;padding:12px 0;border-bottom:1px solid var(--border-subtle)}
.flow-subreq-detail.open{display:block}

/* Shared detail expand */
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.detail-section h4{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:8px;font-weight:600}
.detail-section pre{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:var(--mono);font-size:13px;overflow-x:auto;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.detail-meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-family:var(--mono);font-size:13px;color:var(--text-dim);padding:12px 16px;background:var(--bg-muted);border-radius:var(--radius);border:1px solid var(--border)}
.detail-meta span{display:flex;align-items:center;gap:6px}
.detail-actions{margin-top:14px;display:flex;gap:8px}

/* Server activity */
.server-activity{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}
.server-activity-header{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600;margin-bottom:10px}
.sa-section{margin-bottom:12px}
.sa-label{font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:4px}
.sa-row{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12px;padding:4px 0;color:var(--text)}
.sa-method{width:40px;font-weight:600;flex-shrink:0}
.sa-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim)}
.sa-status{width:36px;text-align:right;font-weight:600}
.sa-dur{width:60px;text-align:right;color:var(--text-muted)}
.sa-level{width:50px;font-weight:600;flex-shrink:0;font-size:10px}
.sa-msg{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim);font-size:11px}
.sa-err-name{width:100px;color:var(--red);font-weight:600;flex-shrink:0}
`;
}
