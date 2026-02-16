import type { BrakitConfig } from "../types.js";

export function getLayoutHtml(config: BrakitConfig): string {
  return `
<div class="app" id="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="logo-text">brakit</span>
      <span class="logo-version">v1.0</span>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Monitor</div>
      <button class="sidebar-item active" data-view="actions">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
        <span class="item-label">Actions</span>
        <span class="item-count" id="sidebar-count-actions">0</span>
      </button>
      <button class="sidebar-item" data-view="requests">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
        <span class="item-label">Requests</span>
        <span class="item-count" id="sidebar-count-requests">0</span>
      </button>
      <div class="sidebar-section">Insights</div>
      <button class="sidebar-item disabled">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>
        <span class="item-label">Queries</span>
        <span class="coming-soon">Soon</span>
      </button>
      <button class="sidebar-item disabled">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span>
        <span class="item-label">Errors</span>
        <span class="coming-soon">Soon</span>
      </button>
      <button class="sidebar-item disabled">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
        <span class="item-label">Performance</span>
        <span class="coming-soon">Soon</span>
      </button>
      <button class="sidebar-item disabled">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
        <span class="item-label">Logs</span>
        <span class="coming-soon">Soon</span>
      </button>
    </nav>
    <div class="sidebar-footer">:${config.proxyPort}</div>
  </aside>
  <div class="main-panel">
    <div class="header">
      <span class="header-title" id="header-title">Actions</span>
      <div class="header-right">
        <div class="segmented-control" id="mode-toggle">
          <button class="segmented-btn active" id="mode-simple">Simple</button>
          <button class="segmented-btn" id="mode-detailed">Detailed</button>
        </div>
        <button class="btn btn-danger" id="clear-btn">Clear</button>
      </div>
    </div>
    <div class="main-content">
      <div class="view-flows" id="flow-container">
        <div class="content" id="flow-list">
          <div class="empty" id="empty-flows">
            <span class="empty-icon">&#9889;</span>
            <span class="empty-title">Waiting for requests...</span>
            <span class="empty-sub">Use your app and actions will appear here</span>
          </div>
        </div>
      </div>
      <div class="view-requests" id="request-container">
        <div id="request-list"></div>
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
