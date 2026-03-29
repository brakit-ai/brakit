export function getInsightsStyles(): string {
  return `
/* Insights filter chips */
.insights-filters{display:flex;gap:6px;padding:16px 28px;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:2}
.insights-chip{font-size:12px;font-weight:500;padding:5px 14px;border:1px solid var(--border);border-radius:20px;background:var(--bg);color:var(--text-muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px;font-family:var(--sans)}
.insights-chip:hover{border-color:var(--text-muted);color:var(--text)}
.insights-chip.active{background:var(--accent);color:white;border-color:var(--accent)}
.insights-chip-count{font-size:10px;font-family:var(--mono);background:rgba(0,0,0,.08);padding:1px 5px;border-radius:8px}
.insights-chip.active .insights-chip-count{background:rgba(255,255,255,.25)}

/* Insights card list */
.insights-list{padding:16px 28px}

.insights-empty{display:flex;align-items:center;gap:10px;padding:24px;color:var(--green);font-size:14px;font-weight:500}
.insights-empty-icon{font-size:18px}

.insights-card{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all .15s;margin-bottom:8px}
.insights-card:hover{border-color:var(--border-light);box-shadow:0 2px 8px rgba(0,0,0,.04)}
.insights-card.expanded{border-color:var(--border-light);box-shadow:0 2px 8px rgba(0,0,0,.04)}
.insights-card.resolved{opacity:.55}
.insights-card.resolved:hover{opacity:.8}

.insights-card-left{flex-shrink:0;padding-top:2px}
.insights-sev{width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;border-radius:50%}
.insights-sev.critical{background:var(--red-bg);color:var(--red)}
.insights-sev.warning{background:var(--amber-bg);color:var(--amber)}
.insights-sev.info{background:var(--blue-bg);color:var(--blue)}

.insights-card-body{flex:1;min-width:0}
.insights-card-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px}
.insights-card-title{font-size:13px;font-weight:600;color:var(--text)}
.insights-card-title.resolved{text-decoration:line-through;color:var(--text-muted)}
.insights-card-cat{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);background:var(--bg-muted);padding:1px 6px;border-radius:4px}
.insights-card-count{font-size:11px;font-family:var(--mono);color:var(--text-muted)}
.insights-card-desc{font-size:12px;color:var(--text-dim);line-height:1.5}
.insights-card-detail{font-size:11px;font-family:var(--mono);color:var(--text-muted);margin-top:6px;padding:6px 10px;background:var(--bg-muted);border:1px solid var(--border-subtle);border-radius:6px;line-height:1.5}
.insights-card-progress{font-size:11px;color:var(--text-muted);margin-top:4px;font-family:var(--mono)}
.insights-card-hint{font-size:12px;color:var(--text-dim);line-height:1.6;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)}

.insights-badge-regressed{font-size:9px;font-weight:700;color:var(--red);background:var(--red-bg);padding:1px 6px;border-radius:4px}
.insights-badge-verifying{font-size:9px;font-weight:700;color:var(--amber);background:var(--amber-bg);padding:1px 6px;border-radius:4px}
.insights-badge-resolved{font-size:9px;font-weight:700;color:var(--green);background:var(--green-bg);padding:1px 6px;border-radius:4px}

.insights-card-arrow{color:var(--text-muted);font-size:12px;flex-shrink:0;padding-top:2px;font-family:var(--mono);transition:transform .15s}

.insights-section{display:flex;align-items:center;gap:8px;padding:14px 0 8px;margin-top:4px;font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--border);user-select:none}
.insights-section:first-child{border-top:none;margin-top:0}
.insights-section-icon{font-size:11px;width:16px;text-align:center}
.insights-section-count{font-size:11px;font-family:var(--mono);color:var(--text-muted);background:var(--bg-muted);padding:1px 7px;border-radius:8px;font-weight:500}
.insights-section-regressed{color:var(--red)}
.insights-section-regressed .insights-section-count{color:var(--red);background:var(--red-bg)}
.insights-section-verifying{color:var(--amber)}
.insights-section-verifying .insights-section-count{color:var(--amber);background:var(--amber-bg)}
.insights-section-resolved{color:var(--green)}
.insights-section-resolved .insights-section-count{color:var(--green);background:var(--green-bg)}
.insights-section-dismissed{color:var(--text-muted);cursor:pointer}
.insights-section-dismissed:hover{color:var(--text)}
`;
}
