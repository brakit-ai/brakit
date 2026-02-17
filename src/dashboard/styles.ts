export function getStyles(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#09090b;--bg-sidebar:#0f0f11;--bg-card:#18181b;--bg-hover:#1e1e23;--bg-detail:#141416;
  --bg-active:#27272a;--bg-muted:#1c1c20;
  --border:#27272a;--border-light:#3f3f46;--border-subtle:#1f1f23;
  --text:#fafafa;--text-dim:#a1a1aa;--text-muted:#71717a;
  --accent:#a855f7;
  --green:#4ade80;
  --blue:#60a5fa;
  --amber:#fbbf24;
  --red:#f87171;
  --cyan:#22d3ee;
  --sidebar-width:232px;--header-height:56px;
  --radius:8px;--radius-sm:6px;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  --sans:Inter,system-ui,-apple-system,sans-serif;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;overflow:hidden;-webkit-font-smoothing:antialiased}

/* ===== LAYOUT ===== */
.app{display:grid;grid-template-columns:var(--sidebar-width) 1fr;height:100vh;overflow:hidden}
.main-panel{display:flex;flex-direction:column;overflow:hidden}

/* ===== SIDEBAR ===== */
.sidebar{background:var(--bg-sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
.sidebar-logo{padding:20px 24px 24px;border-bottom:1px solid var(--border-subtle)}
.sidebar-logo .logo-text{font-weight:800;font-size:22px;color:var(--accent);letter-spacing:-.5px}
.sidebar-logo .logo-version{font-weight:400;font-size:12px;color:var(--text-muted);margin-left:8px;letter-spacing:0}
.sidebar-nav{padding:12px;flex:1}
.sidebar-section{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);padding:16px 12px 8px}
.sidebar-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius);color:var(--text-muted);font-size:15px;font-weight:500;cursor:pointer;transition:all .15s;border:none;background:transparent;width:100%;text-align:left;font-family:var(--sans)}
.sidebar-item:hover{background:var(--bg-hover);color:var(--text)}
.sidebar-item.active{background:var(--bg-active);color:var(--text)}
.sidebar-item .item-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.5}
.sidebar-item.active .item-icon{opacity:1}
.sidebar-item:hover .item-icon{opacity:.8}
.sidebar-item .item-label{flex:1}
.sidebar-item .item-count{font-size:13px;font-family:var(--mono);color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:10px;min-width:24px;text-align:center}
.sidebar-item.disabled{opacity:.35;cursor:default;pointer-events:none}
.sidebar-item .coming-soon{font-size:11px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:10px;font-weight:600;letter-spacing:.3px}
.sidebar-footer{padding:16px 24px;border-top:1px solid var(--border-subtle);font-size:13px;color:var(--text-muted);font-family:var(--mono)}

/* ===== HEADER ===== */
.header{display:flex;align-items:center;gap:16px;padding:0 28px;height:var(--header-height);border-bottom:1px solid var(--border);background:var(--bg);flex-shrink:0}
.header-title{font-weight:600;font-size:20px;color:var(--text);letter-spacing:-.2px}
.header-right{margin-left:auto;display:flex;gap:10px;align-items:center}

/* Segmented control */
.segmented-control{display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:3px;gap:2px}
.segmented-btn{background:transparent;border:none;color:var(--text-muted);padding:6px 14px;font-size:14px;cursor:pointer;transition:all .15s;font-family:var(--sans);font-weight:500;border-radius:var(--radius-sm)}
.segmented-btn:hover{color:var(--text)}
.segmented-btn.active{background:var(--bg-hover);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.2)}

.btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-dim);padding:7px 14px;border-radius:var(--radius);font-size:14px;cursor:pointer;transition:all .15s;font-family:var(--sans);font-weight:500}
.btn:hover{background:var(--bg-hover);color:var(--text);border-color:var(--border-light)}
.btn-danger:hover{border-color:rgba(248,113,113,.3);color:var(--red);background:rgba(248,113,113,.07)}

/* ===== CONTENT ===== */
.main-content{flex:1;overflow-y:auto}

/* ===== COLUMN HEADERS ===== */
.col-header{display:flex;align-items:center;gap:16px;padding:8px 28px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:2;font-family:var(--mono)}

/* ===== FLOW ROWS ===== */
.flow-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
.flow-row:hover{background:var(--bg-hover)}
.flow-row.expanded{background:var(--bg-card)}
.flow-summary-row{display:flex;align-items:center;gap:16px;font-size:15px}
.flow-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.flow-status-dot.dot-clean{background:var(--green)}
.flow-status-dot.dot-warn{background:var(--amber)}
.flow-status-dot.dot-error{background:var(--red)}
.flow-label{font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.flow-req-count{font-family:var(--mono);font-size:14px;color:var(--text-muted);flex-shrink:0;width:60px;text-align:right}
.flow-badge-text{font-size:14px;color:var(--text-muted);flex-shrink:0;font-family:var(--mono);width:120px;text-align:right}
.flow-badge-text.has-warn{color:var(--amber)}
.flow-badge-text.has-error{color:var(--red)}
.flow-duration{font-family:var(--mono);font-size:14px;color:var(--text-dim);flex-shrink:0;width:70px;text-align:right}

/* Flow expand panel */
.flow-expand{display:none;padding:0 28px 16px;border-bottom:1px solid var(--border);background:var(--bg-detail)}
.flow-expand.open{display:block}

/* Simple mode traffic + insights */
.flow-traffic{padding:8px 0;font-family:var(--mono);font-size:14px}
.traffic-row{display:flex;align-items:center;gap:12px;padding:6px 0}
.traffic-header{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);padding-bottom:8px;margin-bottom:4px}
.traffic-row .t-method{font-weight:700;width:52px;flex-shrink:0;font-size:13px}
.traffic-row .t-path{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.traffic-row .t-path.is-dup{color:var(--text-muted)}
.traffic-row .t-status{flex-shrink:0;width:28px;text-align:right;font-weight:600}
.traffic-row .t-dur{color:var(--text-dim);width:60px;text-align:right;flex-shrink:0}
.traffic-row .t-size{color:var(--text-muted);width:50px;text-align:right;flex-shrink:0;font-size:13px}
.traffic-row .t-dup{font-size:12px;color:var(--amber);flex-shrink:0;width:50px;text-align:right}
.traffic-body{padding:2px 0 4px 0}
.traffic-body-toggle{font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;border:none;background:none;font-family:var(--mono);letter-spacing:.3px;transition:color .15s}
.traffic-body-toggle:hover{color:var(--text-dim)}
.traffic-body-toggle .arrow-out{color:var(--blue)}
.traffic-body-toggle .arrow-in{color:var(--green)}
.traffic-body-toggle .chevron{font-size:11px;transition:transform .15s;display:inline-block}
.traffic-body-toggle.open .chevron{transform:rotate(90deg)}
.traffic-body pre{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-family:var(--mono);font-size:13px;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.5;margin:4px 0 0;display:none}
.traffic-body pre.open{display:block}
.traffic-separator{height:8px}
.flow-divider{border-top:1px solid var(--border-subtle);margin:12px 0 8px}
.flow-insights{padding:0;font-size:14px;line-height:1.8;color:var(--text-dim)}
.flow-insights .insight-line{padding:2px 0}
.flow-insights .insight-error{color:var(--red)}
.flow-insights .insight-warn{color:var(--amber)}
.flow-insights .insight-tip{margin-top:8px;color:var(--text-muted);font-size:13px}

/* Detailed mode sub-rows */
.flow-subreqs{padding:4px 0}
.flow-subreq{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-subtle);font-family:var(--mono);font-size:14px;cursor:pointer;transition:background .1s}
.flow-subreq:last-child{border-bottom:none}
.flow-subreq:hover{background:var(--bg-hover);margin:0 -28px;padding-left:28px;padding-right:28px}
.flow-subreq .subreq-method{font-weight:700;width:52px;flex-shrink:0;font-size:13px}
.flow-subreq .subreq-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.flow-subreq .subreq-label.is-dup{color:var(--text-muted)}
.flow-subreq .subreq-status{flex-shrink:0;width:28px;text-align:right}
.flow-subreq .subreq-dur{color:var(--text-dim);width:60px;text-align:right;flex-shrink:0}
.flow-subreq .subreq-dup-tag{font-size:12px;color:var(--amber);flex-shrink:0}
.flow-subreq-detail{display:none;padding:12px 0;border-bottom:1px solid var(--border-subtle)}
.flow-subreq-detail.open{display:block}

/* Shared detail expand */
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.detail-section h4{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:8px;font-weight:600}
.detail-section pre{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:var(--mono);font-size:14px;overflow-x:auto;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.detail-meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-family:var(--mono);font-size:14px;color:var(--text-dim);padding:12px 16px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)}
.detail-meta span{display:flex;align-items:center;gap:6px}
.detail-actions{margin-top:14px;display:flex;gap:8px}

/* ===== ALL REQUESTS VIEW ===== */
.req-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
.req-row:hover{background:var(--bg-hover)}
.req-row.expanded{background:var(--bg-card)}
.req-summary{display:flex;align-items:center;gap:16px;font-family:var(--mono);font-size:15px}
.req-method{font-weight:700;width:60px;flex-shrink:0}
.method-GET{color:var(--green)}.method-POST{color:var(--blue)}.method-PUT,.method-PATCH{color:var(--amber)}.method-DELETE{color:var(--red)}
.req-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.req-status{font-weight:600;width:36px;text-align:right}
.status-2xx{color:var(--green)}.status-3xx{color:var(--cyan)}.status-4xx{color:var(--amber)}.status-5xx{color:var(--red)}
.req-duration{color:var(--text-dim);width:70px;text-align:right}
.req-size{color:var(--text-muted);width:60px;text-align:right;font-size:14px}
.req-detail{padding:16px 28px 20px;border-bottom:1px solid var(--border);background:var(--bg-detail);display:none}
.req-detail.open{display:block}

/* JSON */
.json-key{color:var(--cyan)}.json-str{color:var(--green)}.json-num{color:var(--amber)}.json-bool{color:var(--accent)}.json-null{color:var(--red)}

/* Footer */
.footer{padding:10px 28px;border-top:1px solid var(--border);font-size:14px;color:var(--text-muted);display:flex;gap:24px;font-family:var(--mono);flex-shrink:0;background:var(--bg)}
.footer .error-count{color:var(--red)}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:var(--text-muted);gap:12px}
.empty-title{font-size:20px;font-weight:600;color:var(--text-dim)}
.empty-sub{font-size:15px}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:var(--bg-card);border:1px solid var(--border);color:var(--text);padding:12px 20px;border-radius:10px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.4)}
.toast.show{opacity:1}

/* Scrollbar */
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}

/* Tooltip */
.tooltip{position:relative}
.tooltip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 4px 8px rgba(0,0,0,.3)}
.tooltip:hover::after{opacity:1}

/* View toggle — switchView() controls visibility via inline display */
.view-flows{display:block}.view-requests{display:none}
`;
}
