export function getExplorerStyles(): string {
  return `
/* Explorer sub-tabs */
.explorer-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);padding:0 28px;background:var(--bg);position:sticky;top:0;z-index:2}
.explorer-tab{padding:10px 16px;font-size:13px;font-weight:500;color:var(--text-muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;font-family:var(--sans);white-space:nowrap}
.explorer-tab:hover{color:var(--text)}
.explorer-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.explorer-tab-count{font-size:11px;font-family:var(--mono);color:var(--text-muted);background:var(--bg-muted);padding:1px 6px;border-radius:8px}
.explorer-tab.active .explorer-tab-count{color:var(--accent);background:var(--accent-bg)}
`;
}
