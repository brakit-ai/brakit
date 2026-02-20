import type { BrakitConfig } from "../types/index.js";
import { VERSION } from "../index.js";

export function getLayoutHtml(config: BrakitConfig): string {
  return `
<div class="app" id="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="logo-text">brakit</span>
      <span class="logo-version">v${VERSION}</span>
    </div>
    <nav class="sidebar-nav">
      <button class="sidebar-item active" data-view="overview">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
        <span class="item-label">Overview</span>
      </button>
      <div class="sidebar-section">Monitor</div>
      <button class="sidebar-item" data-view="actions">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
        <span class="item-label">Actions</span>
        <span class="item-count" id="sidebar-count-actions">0</span>
      </button>
      <button class="sidebar-item" data-view="requests">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
        <span class="item-label">Requests</span>
        <span class="item-count" id="sidebar-count-requests">0</span>
      </button>
      <button class="sidebar-item" data-view="fetches">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>
        <span class="item-label">Fetches</span>
        <span class="item-count" id="sidebar-count-fetches">0</span>
      </button>
      <div class="sidebar-section">Insights</div>
      <button class="sidebar-item" data-view="queries">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>
        <span class="item-label">Queries</span>
        <span class="item-count" id="sidebar-count-queries">0</span>
      </button>
      <button class="sidebar-item" data-view="errors">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span>
        <span class="item-label">Errors</span>
        <span class="item-count" id="sidebar-count-errors">0</span>
      </button>
      <button class="sidebar-item" data-view="logs">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
        <span class="item-label">Logs</span>
        <span class="item-count" id="sidebar-count-logs">0</span>
      </button>
      <button class="sidebar-item" data-view="security">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
        <span class="item-label">Security</span>
        <span class="item-count" id="sidebar-count-security" style="display:none">0</span>
      </button>
      <button class="sidebar-item" data-view="performance">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
        <span class="item-label">Performance</span>
      </button>
    </nav>
    <div class="sidebar-footer">:${config.proxyPort}</div>
  </aside>
  <div class="main-panel">
    <div class="header">
      <div class="header-left">
        <span class="header-title" id="header-title">Overview</span>
        <span class="header-sub" id="header-sub">Live summary of your application</span>
      </div>
      <div class="header-right">
        <div class="segmented-control" id="mode-toggle" style="display:none">
          <button class="segmented-btn active" id="mode-simple">Quick</button>
          <button class="segmented-btn" id="mode-detailed">Detailed</button>
        </div>
        <button class="btn btn-danger" id="clear-btn">Clear</button>
      </div>
    </div>
    <div class="main-content">
      <div id="overview-container">
        <div class="ov-container" id="overview-content"></div>
      </div>
      <div class="view-flows" id="flow-container" style="display:none">
        <div class="col-header" id="flow-col-header">
          <span style="width:8px"></span>
          <span style="flex:1">Action</span>
          <span style="width:60px;text-align:right">Reqs</span>
          <span style="width:120px;text-align:right">Status</span>
          <span style="width:70px;text-align:right">Time</span>
        </div>
        <div id="flow-list">
          <div class="empty" id="empty-flows">
            <span class="empty-title">Waiting for requests...</span>
            <span class="empty-sub">Use your app and actions will appear here</span>
          </div>
        </div>
      </div>
      <div class="view-requests" id="request-container">
        <div class="col-header">
          <span style="width:60px">Method</span>
          <span style="flex:1">URL</span>
          <span style="width:36px;text-align:right">Status</span>
          <span style="width:70px;text-align:right">Time</span>
          <span style="width:60px;text-align:right">Size</span>
        </div>
        <div id="request-list"></div>
      </div>
      <div class="view-telemetry" id="fetch-container" style="display:none">
        <div class="fetch-analysis" id="fetch-analysis"></div>
      </div>
      <div class="view-telemetry" id="query-container" style="display:none">
        <div class="col-header">
          <span style="width:70px;border-right:1px solid var(--border);padding-right:16px">Operation</span>
          <span style="width:170px;border-right:1px solid var(--border);padding-right:16px">Table</span>
          <span style="flex:1;border-right:1px solid var(--border);padding-right:16px">Query</span>
          <span style="width:60px;text-align:right">Time</span>
        </div>
        <div id="query-list"></div>
      </div>
      <div class="view-telemetry" id="error-container" style="display:none">
        <div class="col-header">
          <span style="width:180px">Type</span>
          <span style="flex:1">Message</span>
          <span style="width:130px;text-align:right">Time</span>
        </div>
        <div id="error-list"></div>
      </div>
      <div class="view-telemetry" id="log-container" style="display:none">
        <div id="log-analysis"></div>
        <div class="col-header">
          <span style="width:52px">Level</span>
          <span style="flex:1">Message</span>
          <span style="width:130px;text-align:right">Time</span>
        </div>
        <div id="log-list"></div>
      </div>
      <div class="view-telemetry" id="security-container" style="display:none">
        <div class="sec-container" id="security-content"></div>
      </div>
      <div class="view-telemetry" id="performance-container" style="display:none">
        <div id="graph-content"></div>
      </div>
    </div>
    <div class="footer">
      <span id="stat-total">0 requests</span>
      <span id="stat-flows">0 actions</span>
      <span id="stat-errors" class="error-count">0 errors</span>
      <span id="stat-avg">Avg: 0ms</span>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
`;
}
