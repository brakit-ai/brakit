export function getTimelineStyles(): string {
  return `
/* Timeline */
.request-timeline{margin-top:8px;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;overflow:hidden}
.request-timeline:empty{display:none;margin:0;padding:0;border:none}
.tl-header{display:flex;align-items:center;justify-content:space-between;padding:0 0 8px}
.tl-title{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:600}
.tl-counts{display:flex;gap:10px;font-family:var(--mono);font-size:10px}
.tl-count{color:var(--text-dim)}
.tl-count-query{color:var(--accent)}
.tl-count-fetch{color:var(--blue)}
.tl-count-error{color:var(--red)}
.tl-count-log{color:var(--text-muted)}
.tl-loading{color:var(--text-muted);padding:4px 0;font-size:10px;font-family:var(--mono)}
.tl-events{position:relative;padding-left:4px}
.tl-event{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:11px;padding:4px 0 4px 12px;border-left:2px solid var(--border);position:relative}
.tl-event-time{width:48px;color:var(--text-muted);font-size:10px;flex-shrink:0;text-align:right}
.tl-event-type{width:44px;font-weight:700;font-size:9px;letter-spacing:.5px;flex-shrink:0}
.tl-event-summary{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.tl-event-status{width:32px;text-align:right;font-weight:600;flex-shrink:0}
.tl-event-dur{width:48px;text-align:right;color:var(--text-muted);flex-shrink:0;font-size:10px}
`;
}
