export function getBaseStyles(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#09090b;--bg-sidebar:#0f0f11;--bg-card:#18181b;--bg-hover:#1e1e23;--bg-detail:#141416;
  --bg-active:#27272a;--bg-muted:#1c1c20;
  --border:#27272a;--border-light:#3f3f46;--border-subtle:#1f1f23;
  --text:#fafafa;--text-dim:#a1a1aa;--text-muted:#71717a;
  --accent:#a855f7;
  --green:#4ade80;
  --blue:#60a5fa;
  --amber:#fbbf24;
  --red:#f87171;
  --cyan:#22d3ee;
  --sidebar-width:232px;--header-height:56px;
  --radius:8px;--radius-sm:6px;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  --sans:Inter,system-ui,-apple-system,sans-serif;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:16px;overflow:hidden;-webkit-font-smoothing:antialiased}

/* Scrollbar */
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}

/* Tooltip */
.tooltip{position:relative}
.tooltip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 4px 8px rgba(0,0,0,.3)}
.tooltip:hover::after{opacity:1}

/* Toast */
.toast{position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(-8px);background:#0a2e1a;border:1px solid #22c55e;color:#4ade80;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:100;box-shadow:0 0 20px rgba(34,197,94,.25),0 4px 12px rgba(0,0,0,.3)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:var(--text-muted);gap:12px}
.empty-title{font-size:20px;font-weight:600;color:var(--text-dim)}
.empty-sub{font-size:15px}

/* View toggle */
.view-flows{display:block}.view-requests{display:none}
`;
}
