export function getGraphViewStyles(): string {
  return `
.graph-wrapper{display:flex;flex-direction:column;height:calc(100vh - 120px);outline:none}

/* Toolbar — centered search, layers left, flow picker right */
.graph-toolbar{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border)}

/* Layer toggles */
.graph-layer-toggles{display:flex;gap:4px;flex-shrink:0}
.graph-layer-btn{display:flex;align-items:center;gap:3px;font-size:10px;font-weight:500;padding:3px 8px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text-muted);cursor:pointer;transition:all .15s;white-space:nowrap}
.graph-layer-btn:hover{border-color:var(--text-muted);color:var(--text)}
.graph-layer-btn.active{background:var(--bg-card);font-weight:600}

/* Search — takes remaining space, centered */
.graph-search{flex:1;position:relative;display:flex;align-items:center;max-width:360px;margin:0 auto}
.graph-search-icon{position:absolute;left:10px;color:var(--text-muted);font-size:13px;pointer-events:none;opacity:0.5}
.graph-search-input{width:100%;font-size:11px;padding:6px 28px 6px 28px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-family:var(--mono);outline:none;transition:border-color .15s,box-shadow .15s}
.graph-search-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
.graph-search-input::placeholder{color:var(--text-muted);opacity:0.5}
.graph-search-clear{position:absolute;right:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:0 4px;line-height:1;border-radius:3px}
.graph-search-clear:hover{color:var(--text);background:var(--bg-card)}

/* Flow picker */
.graph-flow-picker{font-size:10px;padding:4px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);cursor:pointer;font-family:var(--mono);max-width:200px;flex-shrink:0}

/* Auth legend — inline in toolbar */
.graph-auth-legend{display:flex;gap:8px;align-items:center;font-size:10px;color:var(--text-muted);flex-shrink:0}
.graph-auth-legend-item{display:flex;align-items:center;gap:3px;white-space:nowrap}

/* Canvas */
.graph-body{display:flex;flex:1;min-height:0}
.graph-canvas{flex:1;overflow:hidden;padding:0;position:relative;min-height:0}
.graph-svg{display:block}
.graph-col-header{fill:#c4c4cc;font-size:9px;font-weight:600;font-family:'Inter',system-ui,sans-serif;letter-spacing:1.5px}

/* Floating controls — bottom-center pill */
.graph-float{position:absolute;top:12px;right:12px;display:flex;align-items:center;gap:2px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:4px 6px;box-shadow:0 2px 12px rgba(0,0,0,.08);z-index:10}
.graph-float-btn{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:4px 8px;line-height:1;border-radius:6px;transition:all .12s;white-space:nowrap}
.graph-float-btn:hover{background:var(--bg);color:var(--text)}
.graph-float-btn-accent{font-size:11px;font-weight:600;color:#6366f1}
.graph-float-btn-accent:hover{background:rgba(99,102,241,.08);color:#4f46e5}
.graph-float-zoom{font-size:10px;color:var(--text-muted);font-family:var(--mono);min-width:36px;text-align:center;user-select:none}
.graph-float-sep{width:1px;height:16px;background:var(--border);margin:0 2px;flex-shrink:0}

/* Empty & loading states */
.graph-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;color:var(--text-muted);text-align:center;padding:40px}
.graph-empty-icon{font-size:40px;opacity:0.25;margin-bottom:12px}
.graph-empty-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px}
.graph-empty-desc{font-size:12px;max-width:320px;line-height:1.5}
.graph-loading{display:flex;align-items:center;justify-content:center;min-height:400px;color:var(--text-muted);font-size:13px}

/* Detail panel */
.graph-detail{width:320px;border-left:1px solid var(--border);overflow-y:auto;padding:16px;background:var(--bg-card);flex-shrink:0;max-height:calc(100vh - 160px)}
.graph-detail-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.graph-detail-badge{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.graph-detail-name{font-size:14px;font-weight:700;color:var(--text);word-break:break-all;font-family:var(--mono)}
.graph-detail-close{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 4px;line-height:1}
.graph-detail-close:hover{color:var(--text)}

.graph-detail-auth-badge{display:inline-block;font-size:10px;font-weight:500;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:4px;padding:1px 6px;margin-top:4px}
.graph-detail-mw-badge{display:inline-block;font-size:10px;font-weight:500;color:#6b7280;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;padding:1px 6px;margin-top:4px;margin-left:4px}

/* Detail tabs */
.graph-detail-tabs{display:flex;gap:2px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:0}
.graph-detail-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:500;padding:6px 10px;transition:all .12s}
.graph-detail-tab:hover{color:var(--text)}
.graph-detail-tab.active{color:#6366f1;border-bottom-color:#6366f1}

/* Detail stats */
.graph-detail-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.graph-detail-stat{background:var(--bg);border-radius:var(--radius-sm);padding:10px 12px}
.graph-detail-val{font-size:20px;font-weight:700;font-family:var(--mono);color:var(--text);line-height:1.2}
.graph-detail-lbl{font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;margin-top:2px}

/* Detail sections */
.graph-detail-sec{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin:12px 0 8px;padding-top:10px;border-top:1px solid var(--border)}
.graph-detail-conn{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);padding:6px 8px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:4px;font-family:var(--mono)}
.graph-detail-edge-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.graph-detail-edge-type{font-size:10px;font-weight:600;text-transform:uppercase;min-width:42px}
.graph-detail-dim{color:var(--text-muted);font-size:10px;margin-left:auto;white-space:nowrap}
.graph-detail-sql{font-size:10px;color:var(--text-muted);padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm);font-family:var(--mono);word-break:break-all;line-height:1.5;margin:0 0 4px;white-space:pre-wrap;border:1px solid var(--border)}

/* Security findings in detail */
.graph-detail-finding{padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:6px;border:1px solid var(--border)}
.graph-detail-finding-title{font-size:12px;font-weight:600;color:var(--text);margin-top:4px}
.graph-detail-finding-meta{font-size:10px;color:var(--text-muted);margin-top:2px;font-family:var(--mono)}
.graph-detail-severity{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:1px 6px;border-radius:3px}
.graph-detail-severity-critical{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.graph-detail-severity-warning{background:#fffbeb;color:#d97706;border:1px solid #fde68a}
.graph-detail-severity-info{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe}

/* Issues in detail */
.graph-detail-issue-summary{margin-bottom:12px}
.graph-detail-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin:0}
.graph-detail-empty{font-size:12px;color:var(--text-muted);padding:16px;text-align:center}

/* Pulse animation for critical security badges */
@keyframes graph-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.graph-pulse{animation:graph-pulse 2s ease-in-out infinite}

/* Flow edge animation */
@keyframes graph-flow-dash{to{stroke-dashoffset:-24}}
.graph-flow-edge{animation:graph-flow-dash 1s linear infinite}
`;
}
