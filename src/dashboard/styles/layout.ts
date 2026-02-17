export function getLayoutStyles(): string {
  return `
/* Layout */
.app{display:grid;grid-template-columns:var(--sidebar-width) 1fr;height:100vh;overflow:hidden}
.main-panel{display:flex;flex-direction:column;overflow:hidden}

/* Sidebar */
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

/* Header */
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

/* Content */
.main-content{flex:1;overflow-y:auto}

/* Column headers */
.col-header{display:flex;align-items:center;gap:16px;padding:8px 28px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:2;font-family:var(--mono)}

/* Footer */
.footer{padding:10px 28px;border-top:1px solid var(--border);font-size:14px;color:var(--text-muted);display:flex;gap:24px;font-family:var(--mono);flex-shrink:0;background:var(--bg)}
.footer .error-count{color:var(--red)}
`;
}
