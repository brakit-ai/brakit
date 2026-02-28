export function getBaseStyles(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#ffffff;--bg-sidebar:#f8f8fa;--bg-card:#ffffff;--bg-hover:#f4f4f5;--bg-detail:#fafafa;
  --bg-active:#ede9fe;--bg-muted:#f4f4f5;
  --border:#e4e4e7;--border-light:#d4d4d8;--border-subtle:#f4f4f5;
  --text:#18181b;--text-dim:#52525b;--text-muted:#a1a1aa;
  --accent:#7c3aed;
  --green:#16a34a;
  --blue:#2563eb;
  --amber:#d97706;
  --red:#dc2626;
  --cyan:#0891b2;
  --green-bg:rgba(22,163,74,0.08);--green-bg-subtle:rgba(22,163,74,0.05);--green-border:rgba(22,163,74,0.2);--green-border-subtle:rgba(22,163,74,0.15);
  --sidebar-width:232px;--header-height:52px;
  --radius:8px;--radius-sm:6px;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);
  --shadow-lg:0 4px 12px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04);
  --breakdown-db:#6366f1;--breakdown-fetch:#f59e0b;--breakdown-app:#94a3b8;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  --sans:Inter,system-ui,-apple-system,sans-serif;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;overflow:hidden;-webkit-font-smoothing:antialiased}

/* Scrollbar */
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#a1a1aa}

/* Tooltip */
.tooltip{position:relative}
.tooltip::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#ffffff;border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:11px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:var(--shadow-lg)}
.tooltip:hover::after{opacity:1}

/* Toast */
.toast{position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(-8px);background:#f0fdf4;border:1px solid #86efac;color:#15803d;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:500;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:100;box-shadow:var(--shadow-lg)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* Empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;color:var(--text-muted);gap:12px}
.empty-title{font-size:19px;font-weight:600;color:var(--text-dim)}
.empty-sub{font-size:14px}

/* View toggle */
.view-flows{display:block}.view-requests{display:none}
`;
}
