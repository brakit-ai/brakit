export function getOverviewStyles(): string {
  return `
/* Overview */
.ov-container{padding:24px 28px}

/* Summary banner */
.ov-summary{display:flex;gap:24px;padding:16px 20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px;flex-wrap:wrap;box-shadow:var(--shadow-sm)}
.ov-stat{display:flex;flex-direction:column;gap:2px}
.ov-stat-value{font-size:19px;font-weight:700;font-family:var(--mono);color:var(--text)}
.ov-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600}

/* Section header */
.ov-section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.ov-issue-count{font-size:11px;font-family:var(--mono);color:var(--text-dim);background:var(--bg-muted);border:1px solid var(--border);padding:1px 8px;border-radius:10px}

/* Insight cards */
.ov-cards{display:flex;flex-direction:column;gap:8px}
.ov-card{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:all .15s;box-shadow:var(--shadow-sm)}
.ov-card:hover{background:var(--bg-hover);border-color:var(--border-light);box-shadow:var(--shadow-md)}
.ov-card-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;border-radius:50%;margin-top:2px}
.ov-card-icon.critical{background:rgba(220,38,38,.08);color:var(--red)}
.ov-card-icon.warning{background:rgba(217,119,6,.08);color:var(--amber)}
.ov-card-icon.info{background:rgba(37,99,235,.08);color:var(--blue)}
.ov-card-body{flex:1;min-width:0}
.ov-card-title{font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px}
.ov-card-desc{font-size:12px;color:var(--text-dim);line-height:1.5}
.ov-card-desc strong{color:var(--text);font-family:var(--mono);font-weight:600}
.ov-card-arrow{color:var(--text-muted);font-size:12px;flex-shrink:0;margin-top:2px;font-family:var(--mono);transition:transform .15s}

/* Expanded card */
.ov-card.expanded{border-color:var(--border-light);box-shadow:var(--shadow-md)}
.ov-card-expand{display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.ov-card-hint{font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:10px}
.ov-card-link{font-size:12px;font-weight:600;color:var(--blue);cursor:pointer;display:inline-block;padding:4px 0}
.ov-card-link:hover{text-decoration:underline}
.ov-detail-label{font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.ov-detail-item{font-size:12px;color:var(--text);font-family:var(--mono);padding:2px 0}

/* All-clear banner */
.ov-clear{display:flex;align-items:center;gap:12px;padding:16px 20px;background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);border-radius:var(--radius);color:var(--green);font-size:13px;font-weight:500}
.ov-clear-icon{font-size:16px}
`;
}
