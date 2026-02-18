export function getOverviewStyles(): string {
  return `
/* Overview */
.ov-container{padding:24px 28px}

/* Summary banner */
.ov-summary{display:flex;gap:24px;padding:16px 20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px;flex-wrap:wrap}
.ov-stat{display:flex;flex-direction:column;gap:2px}
.ov-stat-value{font-size:20px;font-weight:700;font-family:var(--mono);color:var(--text)}
.ov-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600}

/* Section header */
.ov-section-title{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.ov-issue-count{font-size:12px;font-family:var(--mono);color:var(--text-dim);background:var(--bg-card);border:1px solid var(--border);padding:1px 8px;border-radius:10px}

/* Insight cards */
.ov-cards{display:flex;flex-direction:column;gap:8px}
.ov-card{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:all .15s}
.ov-card:hover{background:var(--bg-hover);border-color:var(--border-light)}
.ov-card-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;border-radius:50%;margin-top:2px}
.ov-card-icon.critical{background:rgba(248,113,113,.12);color:var(--red)}
.ov-card-icon.warning{background:rgba(251,191,36,.12);color:var(--amber)}
.ov-card-icon.info{background:rgba(96,165,250,.12);color:var(--blue, #60a5fa)}
.ov-card-body{flex:1;min-width:0}
.ov-card-title{font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px}
.ov-card-desc{font-size:13px;color:var(--text-dim);line-height:1.5}
.ov-card-desc strong{color:var(--text);font-family:var(--mono);font-weight:600}
.ov-card-arrow{color:var(--text-muted);font-size:13px;flex-shrink:0;margin-top:2px;font-family:var(--mono)}

/* All-clear banner */
.ov-clear{display:flex;align-items:center;gap:12px;padding:16px 20px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:var(--radius);color:var(--green);font-size:14px;font-weight:500}
.ov-clear-icon{font-size:16px}
`;
}
