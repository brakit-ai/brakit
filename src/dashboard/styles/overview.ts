export function getOverviewStyles(): string {
  return `
.ov-container{padding:28px}

.ov-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}

.ov-card-nav{display:flex;align-items:center;gap:16px;padding:20px 24px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.ov-card-nav:hover{border-color:var(--border-light);box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.ov-card-nav:active{transform:translateY(0)}

.ov-card-empty{opacity:.55}
.ov-card-empty:hover{opacity:.8}

.ov-card-icon-lg{font-size:22px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--bg-muted);border-radius:10px;color:var(--text-muted)}

.ov-card-content{flex:1;min-width:0}
.ov-card-headline{font-size:16px;font-weight:700;color:var(--text);font-family:var(--mono);line-height:1.3}
.ov-card-context{font-size:12px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.ov-card-arrow{font-size:16px;color:var(--text-muted);opacity:0;transition:opacity .15s,transform .15s;flex-shrink:0}
.ov-card-nav:hover .ov-card-arrow{opacity:1;transform:translateX(2px)}
`;
}
