export function getStyles(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#09090b;--bg-sidebar:#0f0f11;--bg-card:#18181b;--bg-hover:#1e1e23;--bg-detail:#141416;
  --bg-active:#27272a;--bg-muted:#1c1c20;
  --border:#27272a;--border-light:#3f3f46;--border-subtle:#1f1f23;
  --text:#fafafa;--text-dim:#a1a1aa;--text-muted:#71717a;
  --accent:#a855f7;--accent-dim:rgba(168,85,247,.12);
  --green:#4ade80;--green-dim:rgba(74,222,128,.08);--green-border:rgba(74,222,128,.25);
  --blue:#60a5fa;
  --amber:#fbbf24;--amber-dim:rgba(251,191,36,.07);--amber-border:rgba(251,191,36,.3);
  --red:#f87171;--red-dim:rgba(248,113,113,.07);--red-border:rgba(248,113,113,.25);
  --cyan:#22d3ee;
  --sidebar-width:232px;--header-height:56px;
  --radius:8px;--radius-sm:6px;--radius-lg:12px;
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
.sidebar-logo .logo-text{font-weight:800;font-size:20px;color:var(--accent);letter-spacing:-.5px}
.sidebar-logo .logo-version{font-weight:400;font-size:11px;color:var(--text-muted);margin-left:8px;letter-spacing:0}
.sidebar-nav{padding:12px;flex:1}
.sidebar-section{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);padding:16px 12px 8px}
.sidebar-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius);color:var(--text-muted);font-size:14.5px;font-weight:500;cursor:pointer;transition:all .15s;border:none;background:transparent;width:100%;text-align:left;font-family:var(--sans)}
.sidebar-item:hover{background:var(--bg-hover);color:var(--text)}
.sidebar-item.active{background:var(--bg-active);color:var(--text)}
.sidebar-item .item-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.5}
.sidebar-item.active .item-icon{opacity:1}
.sidebar-item:hover .item-icon{opacity:.8}
.sidebar-item .item-label{flex:1}
.sidebar-item .item-count{font-size:12px;font-family:var(--mono);color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:10px;min-width:24px;text-align:center}
.sidebar-item.disabled{opacity:.35;cursor:default;pointer-events:none}
.sidebar-item .coming-soon{font-size:10px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:10px;font-weight:600;letter-spacing:.3px}
.sidebar-footer{padding:16px 24px;border-top:1px solid var(--border-subtle);font-size:12px;color:var(--text-muted);font-family:var(--mono)}

/* ===== HEADER ===== */
.header{display:flex;align-items:center;gap:16px;padding:0 28px;height:var(--header-height);border-bottom:1px solid var(--border);background:var(--bg);flex-shrink:0}
.header-title{font-weight:600;font-size:18px;color:var(--text);letter-spacing:-.2px}
.header-right{margin-left:auto;display:flex;gap:10px;align-items:center}

/* Segmented control */
.segmented-control{display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:3px;gap:2px}
.segmented-btn{background:transparent;border:none;color:var(--text-muted);padding:6px 14px;font-size:13px;cursor:pointer;transition:all .15s;font-family:var(--sans);font-weight:500;border-radius:var(--radius-sm)}
.segmented-btn:hover{color:var(--text)}
.segmented-btn.active{background:var(--bg-hover);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.2)}

.btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-dim);padding:7px 14px;border-radius:var(--radius);font-size:13px;cursor:pointer;transition:all .15s;font-family:var(--sans);font-weight:500}
.btn:hover{background:var(--bg-hover);color:var(--text);border-color:var(--border-light)}
.btn-danger:hover{border-color:rgba(248,113,113,.3);color:var(--red);background:var(--red-dim)}

/* ===== CONTENT ===== */
.main-content{flex:1;overflow-y:auto}
.content{max-width:880px;margin:0 auto;padding:20px 28px}

/* ===== FLOW CARDS ===== */
.flow-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:12px;overflow:hidden;transition:border-color .2s,background .2s}
.flow-card:hover{border-color:var(--border-light)}
.flow-card.is-clean{border-color:var(--green-border);background:linear-gradient(135deg,rgba(74,222,128,.02) 0%,transparent 50%)}
.flow-card.is-clean:hover{border-color:rgba(74,222,128,.4)}
.flow-card.has-redundancy{border-color:var(--amber-border);background:linear-gradient(135deg,rgba(251,191,36,.02) 0%,transparent 50%)}
.flow-card.has-redundancy:hover{border-color:rgba(251,191,36,.45)}
.flow-card.has-errors{border-color:var(--red-border);background:linear-gradient(135deg,rgba(248,113,113,.02) 0%,transparent 50%)}
.flow-card.has-errors:hover{border-color:rgba(248,113,113,.4)}

/* Flow header */
.flow-header{display:flex;align-items:center;gap:14px;padding:16px 20px}
.flow-icon{font-size:20px;flex-shrink:0}
.flow-label{font-weight:600;font-size:18px;flex:1;letter-spacing:-.2px}
.flow-duration{font-family:var(--mono);font-size:13px;color:var(--text-muted)}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;border:1px solid transparent}
.badge-clean{color:var(--green);background:var(--green-dim);border-color:rgba(74,222,128,.15)}
.badge-warn{color:var(--amber);background:var(--amber-dim);border-color:rgba(251,191,36,.15)}
.badge-error{color:var(--red);background:var(--red-dim);border-color:rgba(248,113,113,.15)}

/* ===== SIMPLE VIEW ===== */
.simple-body{padding:0 20px 20px;line-height:1.8;font-size:14px}
.simple-success{color:var(--green);margin-bottom:6px;font-size:14px}
.simple-success span{color:var(--text)}
.simple-problems{margin:10px 0}
.simple-problem{color:var(--amber);padding:6px 0 6px 4px;font-size:14px}
.simple-problem-label{color:var(--text);margin-left:4px;font-weight:500}
.simple-problem-waste{font-family:var(--mono);font-size:13px;color:var(--amber)}
.simple-errors{margin:10px 0}
.simple-error-item{color:var(--red);padding:6px 0 6px 4px;font-size:14px}
.simple-tip{margin-top:14px;padding:14px 18px;background:var(--accent-dim);border:1px solid rgba(168,85,247,.2);border-radius:var(--radius);font-size:13px;color:var(--text-dim);line-height:1.7}
.simple-tip strong{color:var(--accent);font-weight:600}
.simple-ok{color:var(--green);padding:8px 0;font-size:14px}

/* ===== DETAILED VIEW ===== */
.flow-requests{padding:0 20px}
.flow-req{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:all .15s}
.flow-req:last-child{border-bottom:none}
.flow-req:hover{background:var(--bg-hover);margin:0 -20px;padding-left:20px;padding-right:20px;border-radius:6px}
.flow-req.expanded{background:var(--bg-hover);margin:0 -20px;padding-left:20px;padding-right:20px}
.flow-req-label{font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.flow-req-label.is-dup{color:var(--text-muted);font-weight:400}
.flow-req-dots{flex:1;border-bottom:2px dotted var(--border);min-width:24px;margin:0 6px;align-self:flex-end;margin-bottom:5px}
.flow-req-dur{font-family:var(--mono);font-size:13px;color:var(--text-muted);flex-shrink:0;min-width:56px;text-align:right}
.flow-req-status{flex-shrink:0;font-size:15px;width:20px;text-align:center;cursor:help}
.status-ok{color:var(--green)}
.status-fail{color:var(--amber)}
.status-error{color:var(--red)}
.dup-badge{font-size:11px;color:var(--amber);background:var(--amber-dim);border:1px solid rgba(251,191,36,.2);padding:2px 10px;border-radius:20px;flex-shrink:0;font-weight:600}

/* Flow detail expand */
.flow-req-detail{display:none;padding:16px 0 16px 0;border-bottom:1px solid var(--border)}
.flow-req-detail.open{display:block}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.detail-section h4{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:8px;font-weight:600}
.detail-section pre{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:var(--mono);font-size:13px;overflow-x:auto;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.detail-meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px;font-family:var(--mono);font-size:13px;color:var(--text-dim);padding:12px 16px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)}
.detail-meta span{display:flex;align-items:center;gap:6px}
.detail-actions{margin-top:14px;display:flex;gap:8px}

/* Flow summary */
.flow-summary{padding:14px 20px 16px;font-size:13px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border)}
.summary-ok{color:var(--green)}
.summary-warn{color:var(--amber)}

/* ===== ALL REQUESTS VIEW ===== */
.req-row{padding:12px 28px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}
.req-row:hover{background:var(--bg-hover)}
.req-row.expanded{background:var(--bg-card)}
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

/* Footer */
.footer{padding:10px 28px;border-top:1px solid var(--border);font-size:13px;color:var(--text-muted);display:flex;gap:24px;font-family:var(--mono);flex-shrink:0;background:var(--bg)}
.footer .error-count{color:var(--red)}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:var(--text-muted);gap:12px}
.empty-icon{font-size:48px;opacity:.3;margin-bottom:8px}
.empty-title{font-size:18px;font-weight:600;color:var(--text-dim)}
.empty-sub{font-size:14px}

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

/* View toggle */
.view-flows{display:block}.view-requests{display:none}
.show-requests .view-flows{display:none}
.show-requests .view-requests{display:block}
`;
}
