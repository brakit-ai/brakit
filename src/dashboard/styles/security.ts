export function getSecurityStyles(): string {
  return `
/* Security tab */
.sec-container{padding:24px 28px}

/* All-clear */
.sec-clear{display:flex;align-items:center;gap:16px;padding:20px 24px;background:rgba(22,163,74,.05);border:1px solid rgba(22,163,74,.15);border-radius:var(--radius);margin-bottom:24px}
.sec-clear-icon{font-size:24px;color:var(--green);flex-shrink:0}
.sec-clear-title{font-size:15px;font-weight:600;color:var(--green);margin-bottom:2px}
.sec-clear-sub{font-size:12px;color:var(--text-dim)}

/* Summary bar */
.sec-summary{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px;box-shadow:var(--shadow-sm)}
.sec-summary-left{display:flex;align-items:baseline;gap:8px}
.sec-summary-count{font-size:23px;font-weight:700;font-family:var(--mono);color:var(--text)}
.sec-summary-label{font-size:12px;color:var(--text-dim)}
.sec-summary-right{display:flex;gap:8px}
.sec-badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px}
.sec-badge.critical{background:rgba(220,38,38,.08);color:var(--red)}
.sec-badge.warning{background:rgba(217,119,6,.08);color:var(--amber)}
.sec-badge.info{background:rgba(37,99,235,.08);color:var(--blue)}

/* Rule group */
.sec-group{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden;box-shadow:var(--shadow-sm)}
.sec-group-header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)}
.sec-group-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;border-radius:50%}
.sec-group-icon.critical{background:rgba(220,38,38,.08);color:var(--red)}
.sec-group-icon.warning{background:rgba(217,119,6,.08);color:var(--amber)}
.sec-group-icon.info{background:rgba(37,99,235,.08);color:var(--blue)}
.sec-group-title{font-size:13px;font-weight:600;color:var(--text);flex:1}
.sec-group-count{font-size:11px;font-family:var(--mono);color:var(--text-dim);background:var(--bg-muted);padding:1px 8px;border-radius:10px;border:1px solid var(--border)}

/* Hint */
.sec-hint{padding:8px 16px;font-size:11px;color:var(--text-muted);background:var(--bg-muted);border-bottom:1px solid var(--border)}

/* Items */
.sec-items{padding:4px 0}
.sec-item{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;font-size:12px;transition:background .1s}
.sec-item:hover{background:var(--bg-hover)}
.sec-item-desc{color:var(--text-dim);line-height:1.5;flex:1;min-width:0}
.sec-item-desc strong{color:var(--text);font-family:var(--mono);font-weight:600}
.sec-item-count{font-size:10px;font-family:var(--mono);color:var(--text-muted);flex-shrink:0;margin-left:12px}
`;
}
