export function getFlowStyles(): string {
  return `
/* Flow rows */
.flow-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
.flow-row:hover{background:var(--bg-hover)}
.flow-row.expanded{background:var(--bg-muted)}
.flow-summary-row{display:flex;align-items:center;gap:14px;font-size:14px}
.flow-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.flow-status-dot.dot-clean{background:var(--green)}
.flow-status-dot.dot-warn{background:var(--amber)}
.flow-status-dot.dot-error{background:var(--red)}
.flow-label{font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.flow-req-count{font-family:var(--mono);font-size:12px;color:var(--text-muted);flex-shrink:0;text-align:right}
.flow-badge-pill{font-size:11px;flex-shrink:0;font-family:var(--mono);font-weight:600;padding:2px 10px;border-radius:10px;text-align:center}
.flow-badge-pill.badge-clean{background:rgba(22,163,74,0.07);color:var(--green)}
.flow-badge-pill.badge-warn{background:rgba(217,119,6,0.07);color:var(--amber)}
.flow-badge-pill.badge-error{background:rgba(220,38,38,0.07);color:var(--red)}
.flow-duration{font-family:var(--mono);font-size:12px;color:var(--text-muted);flex-shrink:0;width:60px;text-align:right}

/* Flow expand panel */
.flow-expand{display:none;padding:12px 28px 16px;border-bottom:1px solid var(--border);background:var(--bg-detail)}
.flow-expand.open{display:block}

/* Request cards in expanded flow */
.traffic-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:10px;box-shadow:var(--shadow-sm)}
.traffic-card:last-child{margin-bottom:0}

/* Simple mode traffic */
.flow-traffic{padding:0;font-family:var(--mono);font-size:13px}
.traffic-card-header{display:flex;align-items:center;gap:10px;margin-bottom:0}
.traffic-card-header.has-details{margin-bottom:10px}

/* Method badges */
.method-badge{display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;font-family:var(--mono);letter-spacing:.3px;flex-shrink:0}
.method-badge-GET{background:rgba(22,163,74,0.08);color:var(--green)}
.method-badge-POST{background:rgba(37,99,235,0.08);color:var(--blue)}
.method-badge-PUT,.method-badge-PATCH{background:rgba(217,119,6,0.08);color:var(--amber)}
.method-badge-DELETE{background:rgba(220,38,38,0.08);color:var(--red)}
.method-badge-HEAD,.method-badge-OPTIONS{background:var(--bg-muted);color:var(--text-muted)}

/* Status pills */
.status-pill{display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:600;font-family:var(--mono);flex-shrink:0}
.status-pill-2xx{background:rgba(22,163,74,0.07);color:var(--green)}
.status-pill-3xx{background:rgba(8,145,178,0.07);color:var(--cyan)}
.status-pill-4xx{background:rgba(217,119,6,0.07);color:var(--amber)}
.status-pill-5xx{background:rgba(220,38,38,0.07);color:var(--red)}

.traffic-card-path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-weight:500;font-size:13px}
.traffic-card-path.is-dup{color:var(--text-muted);font-weight:400}
.traffic-card-dur{color:var(--text-muted);font-size:12px;flex-shrink:0}
.traffic-card-size{color:var(--text-muted);font-size:11px;flex-shrink:0}
.traffic-card-dup{font-size:10px;color:var(--amber);flex-shrink:0;font-weight:600;background:rgba(217,119,6,0.07);padding:1px 7px;border-radius:4px}

/* Body toggles */
.traffic-body{padding:0;margin-top:8px}
.traffic-body-toggle{font-size:11px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-muted);font-family:var(--mono);letter-spacing:.3px;transition:all .15s;margin-right:6px;margin-bottom:4px}
.traffic-body-toggle:hover{border-color:var(--border-light);color:var(--text);background:var(--bg-hover)}
.traffic-body-toggle .arrow-out{color:var(--blue)}
.traffic-body-toggle .arrow-in{color:var(--green)}
.traffic-body-toggle .chevron{font-size:9px;transition:transform .15s;display:inline-block}
.traffic-body-toggle.open .chevron{transform:rotate(90deg)}
.traffic-body pre{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-family:var(--mono);font-size:12px;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.5;margin:6px 0 0;display:none}
.traffic-body pre.open{display:block}
.traffic-separator{height:0}
.flow-divider{border-top:1px solid var(--border);margin:14px 0 10px}
.flow-insights{padding:0;font-size:12px;line-height:1.8;color:var(--text-dim)}
.flow-insights .insight-line{padding:3px 0}
.flow-insights .insight-error{color:var(--red)}
.flow-insights .insight-warn{color:var(--amber)}
.flow-insights .insight-tip{margin-top:8px;color:var(--text-muted);font-size:11px;line-height:1.5}

/* Detailed mode sub-rows */
.flow-subreqs{padding:4px 0;display:flex;flex-direction:column;gap:6px}
.flow-subreq{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--mono);font-size:13px;cursor:pointer;transition:all .15s;background:var(--bg-card);box-shadow:var(--shadow-sm)}
.flow-subreq:hover{border-color:var(--border-light);box-shadow:var(--shadow-md)}
.flow-subreq .subreq-method{font-weight:700;flex-shrink:0;font-size:12px}
.flow-subreq .subreq-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-weight:500}
.flow-subreq .subreq-label.is-dup{color:var(--text-muted);font-weight:400}
.flow-subreq .subreq-status{flex-shrink:0}
.flow-subreq .subreq-dur{color:var(--text-muted);font-size:12px;text-align:right;flex-shrink:0}
.flow-subreq .subreq-dup-tag{font-size:10px;color:var(--amber);flex-shrink:0;font-weight:600;background:rgba(217,119,6,0.07);padding:1px 7px;border-radius:4px}
.flow-subreq-detail{display:none;padding:12px 0;border-bottom:1px solid var(--border-subtle)}
.flow-subreq-detail.open{display:block}

/* Shared detail expand */
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
.detail-section h4{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:8px;font-weight:600}
.detail-section pre{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:var(--mono);font-size:12px;overflow-x:auto;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.detail-meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-family:var(--mono);font-size:12px;color:var(--text-dim);padding:12px 16px;background:var(--bg-muted);border-radius:var(--radius);border:1px solid var(--border)}
.detail-meta span{display:flex;align-items:center;gap:6px}
.detail-actions{margin-top:14px;display:flex;gap:8px}

/* Server activity */
.server-activity{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}
.server-activity-header{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600;margin-bottom:10px}
.sa-section{margin-bottom:12px}
.sa-label{font-size:10px;font-weight:600;color:var(--text-dim);margin-bottom:4px}
.sa-row{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:11px;padding:4px 0;color:var(--text)}
.sa-method{width:40px;font-weight:600;flex-shrink:0}
.sa-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim)}
.sa-status{width:36px;text-align:right;font-weight:600}
.sa-dur{width:60px;text-align:right;color:var(--text-muted)}
.sa-level{width:50px;font-weight:600;flex-shrink:0;font-size:10px}
.sa-msg{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim);font-size:11px}
.sa-err-name{width:100px;color:var(--red);font-weight:600;flex-shrink:0}

/* Strict Mode duplicate banner */
.strict-mode-dupe{opacity:0.55}
.strict-mode-banner{font-size:11px;color:var(--text-muted);padding:6px 0 0;font-family:var(--mono)}
`;
}
