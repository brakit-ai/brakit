/**
 * <bk-graph-view> — Runtime dependency graph visualization.
 *
 * Displays: Actions → Endpoints → Tables → External services.
 * Supports overlay layers (auth, security, performance, issues, heat),
 * draggable nodes, search/filter, flow tracing, minimap, and keyboard nav.
 */

import { LitElement, html, svg, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { API } from "../constants.js";

import type {
  GraphNode,
  GraphEdge,
  PositionedNode,
  PositionedEdge,
  NodeAnnotations,
  ConsolidatedFlow,
  OverlayLayer,
  DetailTab,
} from "../graph/types.js";

import {
  GRAPH_PAD,
  GRAPH_REFRESH_MS,
  LAYER_CONFIG,
  NODE_TYPE_STYLE,
  EDGE_COLORS,
  latencyColor,
  trafficHeatColor,
  LOCKED_STROKE,
  LOCKED_FILL,
  HOVER_STROKE,
  HOVER_FILL,
  FLOW_TRACE_COLOR,
  SEARCH_RING_COLOR,
  AUTH_WARNING_COLOR,
  AUTH_SHIELD_BG,
  AUTH_SHIELD_STROKE,
  CRITICAL_FINDING_BG,
  CRITICAL_FINDING_COLOR,
  WARNING_FINDING_BG,
  WARNING_FINDING_COLOR,
  ERROR_COLOR,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  PAN_STEP_PX,
  SVG_MIN_WIDTH,
  SVG_MIN_HEIGHT,
} from "../graph/constants.js";

import { computeLayout, type GraphLayout } from "../graph/layout.js";
import { mergeFlowsAndGraph, consolidateFlows } from "../graph/merge-flows.js";

// ── Component ──

@customElement("bk-graph-view")
export class GraphView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private graphNodes: GraphNode[] = [];
  @state() private graphEdges: GraphEdge[] = [];
  @state() private locked: string | null = null;
  @state() private hovered: string | null = null;
  @state() private loading = true;

  @state() private activeLayers = new Set<OverlayLayer>();
  @state() private searchQuery = "";

  // Pan & zoom (zoom only via toolbar buttons / keyboard)
  @state() private viewTransform = { x: 0, y: 0, scale: 1 };
  private isPanning = false;
  private panStart = { x: 0, y: 0, vtx: 0, vty: 0 };

  // Drag
  @state() private dragging: { nodeId: string; offsetX: number; offsetY: number } | null = null;
  private wasDragging = false;
  private nodePositionOverrides = new Map<string, { x: number; y: number }>();

  @state() private detailTab: DetailTab = "overview";

  // Flow tracing
  @state() private consolidatedFlows: ConsolidatedFlow[] = [];
  @state() private activeFlowIdx: number = -1;

  // Keyboard focus
  @state() private focusIdx = -1;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
    this.refreshTimer = setInterval(() => this.loadData(), GRAPH_REFRESH_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private async loadData() {
    try {
      const [graphRes, flowsRes] = await Promise.all([
        fetch(`${API.graph}?level=endpoints`),
        fetch(API.flows),
      ]);
      const graphData = await graphRes.json();
      const flowsData = await flowsRes.json();

      const merged = mergeFlowsAndGraph(
        graphData.nodes || [],
        graphData.edges || [],
        flowsData.flows || [],
      );

      this.graphNodes = merged.nodes;
      this.graphEdges = merged.edges;
      this.consolidatedFlows = consolidateFlows(flowsData.flows || []);

      // Load persisted drag positions on first data fetch
      if (this.nodePositionOverrides.size === 0 && this.graphNodes.length > 0) {
        this.tryLoadPersistedPositions();
      }

      this.loading = false;
    } catch {
      this.loading = false;
    }
  }

  // ── Position persistence ──

  private getPositionStorageKey(): string {
    const ids = this.graphNodes.map((n) => n.id).sort().join(",");
    let hash = 0;
    for (let i = 0; i < ids.length; i++) {
      hash = ((hash << 5) - hash + ids.charCodeAt(i)) | 0;
    }
    return `bk-graph-pos-${hash}`;
  }

  private persistPositions(): void {
    if (this.nodePositionOverrides.size === 0) return;
    try {
      const data = Object.fromEntries(this.nodePositionOverrides);
      localStorage.setItem(this.getPositionStorageKey(), JSON.stringify(data));
    } catch { /* localStorage quota */ }
  }

  private tryLoadPersistedPositions(): void {
    try {
      const raw = localStorage.getItem(this.getPositionStorageKey());
      if (raw) {
        const data = JSON.parse(raw);
        this.nodePositionOverrides = new Map(Object.entries(data));
      }
    } catch { /* corrupt data */ }
  }

  // ── Selection & highlight logic ──

  private get activeNodeId(): string | null {
    return this.locked ?? this.hovered;
  }

  private getHighlightedNodeIds(): Set<string> | null {
    const active = this.activeNodeId;
    if (!active) return null;
    const set = new Set<string>([active]);
    let added = true;
    while (added) {
      added = false;
      for (const edge of this.graphEdges) {
        if (set.has(edge.source) && !set.has(edge.target)) {
          set.add(edge.target);
          added = true;
        }
      }
    }
    return set;
  }

  private getFlowTraceNodeIds(): Set<string> | null {
    if (this.activeFlowIdx < 0 || this.activeFlowIdx >= this.consolidatedFlows.length) return null;
    const flow = this.consolidatedFlows[this.activeFlowIdx];
    const set = new Set<string>();
    set.add(`action:${flow.label}`);
    for (const key of flow.endpointKeys) {
      set.add(`endpoint:${key}`);
    }
    for (const edge of this.graphEdges) {
      if (set.has(edge.source)) set.add(edge.target);
    }
    return set;
  }

  private getFlowTraceEdgeIds(): Set<string> | null {
    const traceNodes = this.getFlowTraceNodeIds();
    if (!traceNodes) return null;
    const set = new Set<string>();
    for (const edge of this.graphEdges) {
      if (traceNodes.has(edge.source) && traceNodes.has(edge.target)) {
        set.add(edge.id);
      }
    }
    return set;
  }

  // ── Search ──

  private matchesSearch(label: string): boolean {
    if (!this.searchQuery) return true;
    return label.toLowerCase().includes(this.searchQuery.toLowerCase());
  }

  // ── Pan & Zoom ──

  private handlePanStart(ev: MouseEvent): void {
    if (ev.button !== 0) return;
    if ((ev.target as Element).closest(".graph-g")) return;
    this.isPanning = true;
    this.panStart = { x: ev.clientX, y: ev.clientY, vtx: this.viewTransform.x, vty: this.viewTransform.y };
  }

  private handlePanMove(ev: MouseEvent): void {
    if (this.dragging) {
      const rect = (ev.currentTarget as Element).getBoundingClientRect();
      const mx = (ev.clientX - rect.left - this.viewTransform.x) / this.viewTransform.scale;
      const my = (ev.clientY - rect.top - this.viewTransform.y) / this.viewTransform.scale;
      this.nodePositionOverrides.set(this.dragging.nodeId, {
        x: mx - this.dragging.offsetX,
        y: my - this.dragging.offsetY,
      });
      this.requestUpdate();
      return;
    }
    if (!this.isPanning) return;
    this.viewTransform = {
      ...this.viewTransform,
      x: this.panStart.vtx + (ev.clientX - this.panStart.x),
      y: this.panStart.vty + (ev.clientY - this.panStart.y),
    };
  }

  private handlePanEnd(): void {
    if (this.dragging) {
      this.persistPositions();
      this.dragging = null;
      this.wasDragging = true;
      requestAnimationFrame(() => { this.wasDragging = false; });
    }
    this.isPanning = false;
  }

  private resetView(): void {
    this.viewTransform = { x: 0, y: 0, scale: 1 };
  }

  private zoomIn(): void {
    this.viewTransform = { ...this.viewTransform, scale: Math.min(ZOOM_MAX, this.viewTransform.scale * ZOOM_STEP) };
  }

  private zoomOut(): void {
    this.viewTransform = { ...this.viewTransform, scale: Math.max(ZOOM_MIN, this.viewTransform.scale / ZOOM_STEP) };
  }

  private resetLayout(): void {
    this.nodePositionOverrides.clear();
    try { localStorage.removeItem(this.getPositionStorageKey()); } catch { /* ignore */ }
    this.viewTransform = { x: 0, y: 0, scale: 1 };
    this.requestUpdate();
  }

  // ── Node drag ──

  private startNodeDrag(ev: MouseEvent, nodeId: string, node: PositionedNode): void {
    ev.stopPropagation();
    const svgRect = (ev.currentTarget as Element).closest("svg")!.getBoundingClientRect();
    const mx = (ev.clientX - svgRect.left - this.viewTransform.x) / this.viewTransform.scale;
    const my = (ev.clientY - svgRect.top - this.viewTransform.y) / this.viewTransform.scale;
    this.dragging = { nodeId, offsetX: mx - node.x, offsetY: my - node.y };
  }

  // ── Keyboard ──

  private handleKeyDown(ev: KeyboardEvent): void {
    const nodes = this.graphNodes;
    if (ev.key === "/") {
      ev.preventDefault();
      (this.querySelector(".graph-search-input") as HTMLInputElement)?.focus();
      return;
    }
    if (ev.key === "Escape") {
      this.locked = null;
      this.searchQuery = "";
      this.focusIdx = -1;
      this.activeFlowIdx = -1;
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      this.focusIdx = ev.shiftKey
        ? (this.focusIdx <= 0 ? nodes.length - 1 : this.focusIdx - 1)
        : (this.focusIdx + 1) % nodes.length;
      this.hovered = nodes[this.focusIdx]?.id ?? null;
      return;
    }
    if (ev.key === "Enter" && this.focusIdx >= 0) {
      const node = nodes[this.focusIdx];
      if (node) this.locked = this.locked === node.id ? null : node.id;
      return;
    }
    if (ev.key === "+" || ev.key === "=") { this.zoomIn(); return; }
    if (ev.key === "-") { this.zoomOut(); return; }
    if (ev.key === "ArrowUp") { this.viewTransform = { ...this.viewTransform, y: this.viewTransform.y + PAN_STEP_PX }; return; }
    if (ev.key === "ArrowDown") { this.viewTransform = { ...this.viewTransform, y: this.viewTransform.y - PAN_STEP_PX }; return; }
    if (ev.key === "ArrowLeft") { this.viewTransform = { ...this.viewTransform, x: this.viewTransform.x + PAN_STEP_PX }; return; }
    if (ev.key === "ArrowRight") { this.viewTransform = { ...this.viewTransform, x: this.viewTransform.x - PAN_STEP_PX }; return; }
  }

  // ── Render ──

  render() {
    if (this.loading && this.graphNodes.length === 0) {
      return html`<div class="graph-loading">Loading graph…</div>`;
    }
    if (this.graphNodes.length === 0) {
      return html`
        <div class="graph-empty">
          <div class="graph-empty-icon">◎</div>
          <div class="graph-empty-title">No data yet</div>
          <div class="graph-empty-desc">Navigate your app to build the dependency graph.</div>
        </div>
      `;
    }

    const layout = computeLayout(this.graphNodes, this.graphEdges);
    this.applyPositionOverrides(layout);

    const detail = this.getSelectedNodeDetail();
    const highlightedNodes = this.getHighlightedNodeIds();
    const flowTraceNodes = this.getFlowTraceNodeIds();
    const flowTraceEdges = this.getFlowTraceEdgeIds();

    const columnHeaders = this.deduplicateColumnHeaders(layout.nodes);
    const maxRequestCount = Math.max(1, ...this.graphNodes.map((n) => n.stats.requestCount));

    const vt = this.viewTransform;

    return html`
      <div class="graph-wrapper" tabindex="0" @keydown=${this.handleKeyDown}
        @click=${(ev: Event) => {
          const el = ev.target as Element;
          if (el.closest(".graph-detail") || el.closest(".graph-toolbar") || el.closest(".graph-float") || el.closest(".graph-g")) return;
          this.locked = null;
        }}>
        ${this.renderToolbar()}
        <div class="graph-body">
          <div class="graph-canvas" style="position:relative">
            <svg width="100%" height="100%"
              viewBox="0 0 ${Math.max(layout.width, SVG_MIN_WIDTH)} ${Math.max(layout.height, SVG_MIN_HEIGHT)}"
              class="graph-svg"
              style="cursor:${this.isPanning ? "grabbing" : "grab"}"
              @mousedown=${this.handlePanStart}
              @mousemove=${this.handlePanMove}
              @mouseup=${this.handlePanEnd}
              @mouseleave=${this.handlePanEnd}>

              <g transform="translate(${vt.x},${vt.y}) scale(${vt.scale})">
                ${svg`${columnHeaders.map((h) => svg`
                  <text x="${h.x}" y="${GRAPH_PAD + 8}" class="graph-col-header">${h.label}</text>
                `)}`}

                ${layout.edges.map((e) => this.renderEdge(e, highlightedNodes, flowTraceEdges, maxRequestCount))}
                ${layout.nodes.map((n) => this.renderNode(n, highlightedNodes, flowTraceNodes, maxRequestCount))}
              </g>
            </svg>
            ${this.renderFloatingControls()}
          </div>
          ${detail ? this.renderDetailPanel(detail) : nothing}
        </div>
      </div>
    `;
  }

  private applyPositionOverrides(layout: GraphLayout): void {
    for (const node of layout.nodes) {
      const override = this.nodePositionOverrides.get(node.id);
      if (override) {
        node.x = override.x;
        node.y = override.y;
      }
    }

    const posMap = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const edge of layout.edges) {
      const src = posMap.get(edge.data.source);
      const tgt = posMap.get(edge.data.target);
      if (src && tgt) {
        const goRight = src.x < tgt.x;
        edge.sx = goRight ? src.x + src.w : src.x;
        edge.sy = src.y + src.h / 2;
        edge.tx = goRight ? tgt.x : tgt.x + tgt.w;
        edge.ty = tgt.y + tgt.h / 2;
      }
    }
  }

  private deduplicateColumnHeaders(nodes: PositionedNode[]): { x: number; label: string }[] {
    const headers: { x: number; label: string }[] = [];
    const seenTypes = new Set<string>();
    for (const node of nodes) {
      if (!seenTypes.has(node.type)) {
        seenTypes.add(node.type);
        headers.push({ x: node.x, label: NODE_TYPE_STYLE[node.type]?.columnHeader || node.type.toUpperCase() });
      }
    }
    return headers;
  }

  // ── Toolbar ──

  private renderToolbar() {
    return html`
      <div class="graph-toolbar">
        <div class="graph-layer-toggles">
          ${(Object.keys(LAYER_CONFIG) as OverlayLayer[]).map((layer) => {
            const cfg = LAYER_CONFIG[layer];
            const isActive = this.activeLayers.has(layer);
            return html`
              <button class="graph-layer-btn ${isActive ? "active" : ""}"
                style="${isActive ? `border-color:${cfg.color};color:${cfg.color}` : ""}"
                @click=${() => this.toggleLayer(layer)}
                title="${cfg.tooltip}">
                ${cfg.icon} ${cfg.label}
              </button>
            `;
          })}
        </div>

        <div class="graph-search">
          <span class="graph-search-icon">⌕</span>
          <input class="graph-search-input" type="text" placeholder="Search nodes… ( / )"
            .value=${this.searchQuery}
            @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}>
          ${this.searchQuery ? html`
            <button class="graph-search-clear" @click=${() => { this.searchQuery = ""; }}>✕</button>
          ` : nothing}
        </div>

        ${this.consolidatedFlows.length > 0 ? html`
          <select class="graph-flow-picker" @change=${(e: Event) => {
            this.activeFlowIdx = parseInt((e.target as HTMLSelectElement).value, 10);
          }}>
            <option value="-1">Trace flow…</option>
            ${this.consolidatedFlows.map((f, i) => html`
              <option value="${i}" ?selected=${this.activeFlowIdx === i}>${f.label} → ${f.endpointKeys.size} ep · ${f.occurrences}×</option>
            `)}
          </select>
        ` : nothing}

        ${this.activeLayers.has("auth") ? html`
          <div class="graph-auth-legend">
            <span class="graph-auth-legend-item"><span style="color:${AUTH_SHIELD_STROKE}">🛡</span> protected</span>
            <span class="graph-auth-legend-item"><span style="color:${AUTH_WARNING_COLOR};font-weight:700">!</span> no auth</span>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderFloatingControls() {
    const hasOverrides = this.nodePositionOverrides.size > 0;
    const zoomPct = Math.round(this.viewTransform.scale * 100);

    return html`
      <div class="graph-float">
        <button class="graph-float-btn" @click=${this.zoomOut} title="Zoom out (-)">−</button>
        <span class="graph-float-zoom">${zoomPct}%</span>
        <button class="graph-float-btn" @click=${this.zoomIn} title="Zoom in (+)">+</button>
        <span class="graph-float-sep"></span>
        <button class="graph-float-btn" @click=${this.resetView} title="Reset pan & zoom">⊙</button>
        ${hasOverrides ? html`
          <span class="graph-float-sep"></span>
          <button class="graph-float-btn graph-float-btn-accent" @click=${() => this.resetLayout()} title="Reset layout to auto-arrange">
            ⟲ Reformat
          </button>
        ` : nothing}
        <span class="graph-float-sep"></span>
        <button class="graph-float-btn" @click=${() => this.captureScreenshot()} title="Save graph as PNG">
          📷
        </button>
      </div>
    `;
  }

  private async captureScreenshot(): Promise<void> {
    const svgEl = this.querySelector(".graph-svg") as SVGSVGElement | null;
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.style.cssText = "";
    clone.removeAttribute("class");

    const styles = document.createElement("style");
    styles.textContent = `
      text { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      .graph-col-header { fill: #c4c4cc; font-size: 9px; font-weight: 600; letter-spacing: 1.5px; }
      .graph-flow-edge { stroke-dasharray: 6,4; }
      .graph-pulse { }
    `;
    clone.insertBefore(styles, clone.firstChild);

    const ns = "http://www.w3.org/2000/svg";
    const bgRect = document.createElementNS(ns, "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#ffffff");
    clone.insertBefore(bgRect, clone.firstChild);

    const viewBox = clone.getAttribute("viewBox") || "0 0 800 500";
    const [, , vbW, vbH] = viewBox.split(" ").map(Number);
    const scale = 2;
    const canvasW = vbW * scale;
    const canvasH = vbH * scale;

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `brakit-graph-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  }

  private toggleLayer(layer: OverlayLayer): void {
    const next = new Set(this.activeLayers);
    if (next.has(layer)) next.delete(layer);
    else next.add(layer);
    this.activeLayers = next;
  }

  // ── Node rendering ──

  private renderNode(node: PositionedNode, highlighted: Set<string> | null, flowTrace: Set<string> | null, maxRequestCount: number) {
    const active = this.activeNodeId;
    const isHighlighted = highlighted === null || highlighted.has(node.id);
    const isSelf = active === node.id;
    const isLocked = this.locked === node.id;
    const isFlowTraced = flowTrace?.has(node.id) ?? false;
    const isSearchMatch = this.matchesSearch(node.label);

    const style = NODE_TYPE_STYLE[node.type] || NODE_TYPE_STYLE.endpoint;
    let stroke = isLocked ? LOCKED_STROKE : isSelf ? HOVER_STROKE : style.stroke;
    let fill = isLocked ? LOCKED_FILL : isSelf ? HOVER_FILL : style.fill;
    const strokeWidth = isLocked ? 2 : isSelf ? 1.5 : 0.75;
    let opacity = isHighlighted ? 1 : 0.08;

    if (this.searchQuery && !isSearchMatch) opacity = 0.05;
    if (flowTrace && !isFlowTraced) opacity = Math.min(opacity, 0.08);
    if (isFlowTraced) { opacity = 1; stroke = FLOW_TRACE_COLOR; }

    const showSearchRing = this.searchQuery && isSearchMatch;
    const annotations = node.annotations;
    const layers = this.activeLayers;

    if (layers.has("performance") && annotations?.p95Ms !== undefined && node.type === "endpoint") {
      fill = latencyColor(annotations.p95Ms) + "18";
    }
    if (layers.has("heat")) {
      fill = trafficHeatColor(node.stats.requestCount / maxRequestCount) + "20";
    }

    const showAuthWarning = layers.has("auth") && node.type === "endpoint" && !annotations?.hasAuth;
    const showAuthShield = layers.has("auth") && annotations?.hasAuth;
    const securityFindingCount = layers.has("security") ? (annotations?.securityFindings?.length ?? 0) : 0;
    const hasCriticalFinding = annotations?.securityFindings?.some((f) => f.severity === "critical");
    const openIssueCount = layers.has("issues") ? (annotations?.openIssueCount ?? 0) : 0;

    const subtitle = this.nodeSubtitle(node);
    const showP95 = layers.has("performance") && annotations?.p95Ms !== undefined && node.type === "endpoint";

    return svg`
      <g class="graph-g" transform="translate(${node.x},${node.y})" style="opacity:${opacity};cursor:pointer;transition:opacity .15s,transform .1s"
        @click=${(ev: Event) => { ev.stopPropagation(); if (this.wasDragging) return; this.locked = this.locked === node.id ? null : node.id; this.detailTab = "overview"; }}
        @mouseenter=${() => { this.hovered = node.id; }}
        @mouseleave=${() => { this.hovered = null; }}
        @mousedown=${(ev: MouseEvent) => { if (ev.detail >= 2) return; this.startNodeDrag(ev, node.id, node); }}>

        ${showSearchRing ? svg`
          <rect x="-3" y="-3" width="${node.w + 6}" height="${node.h + 6}" rx="9" fill="none"
            stroke="${SEARCH_RING_COLOR}" stroke-width="2" stroke-dasharray="4,2"/>
        ` : nothing}

        ${showAuthWarning ? svg`
          <rect width="${node.w}" height="${node.h}" rx="8" fill="${fill}" stroke="${AUTH_WARNING_COLOR}"
            stroke-width="1.2" stroke-dasharray="5,3"/>
        ` : svg`
          <rect width="${node.w}" height="${node.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        `}

        <text x="12" y="${node.h / 2 - 4}" fill="#1e293b" font-size="11.5" font-weight="600"
          font-family="'Inter',system-ui,sans-serif">${style.icon}  ${node.label}</text>
        <text x="12" y="${node.h / 2 + 10}" fill="#a1a1aa" font-size="9"
          font-family="ui-monospace,monospace">${subtitle}</text>

        ${showP95 ? svg`
          <text x="${node.w - 8}" y="${node.h - 6}" fill="${latencyColor(annotations!.p95Ms!)}" font-size="9"
            font-family="ui-monospace,monospace" text-anchor="end">p95: ${annotations!.p95Ms}ms</text>
        ` : nothing}

        ${showAuthShield ? svg`
          <g transform="translate(${node.w - 24},3)">
            <title>Auth protected</title>
            <rect width="18" height="18" rx="3" fill="${AUTH_SHIELD_BG}" stroke="${AUTH_SHIELD_STROKE}" stroke-width="0.5"/>
            <text x="9" y="13" text-anchor="middle" font-size="10">🛡</text>
          </g>
        ` : nothing}

        ${showAuthWarning ? svg`
          <g transform="translate(${node.w - 24},3)">
            <title>No auth detected — this endpoint may be unprotected</title>
            <rect width="18" height="18" rx="3" fill="#fff7ed" stroke="${AUTH_WARNING_COLOR}" stroke-width="0.5"/>
            <text x="9" y="13" text-anchor="middle" font-size="10" fill="#ea580c">!</text>
          </g>
        ` : nothing}

        ${securityFindingCount > 0 ? svg`
          <g transform="translate(${node.w - (showAuthShield || showAuthWarning ? 46 : 24)},3)">
            <rect width="18" height="18" rx="3" fill="${hasCriticalFinding ? CRITICAL_FINDING_BG : WARNING_FINDING_BG}"
              stroke="${hasCriticalFinding ? CRITICAL_FINDING_COLOR : WARNING_FINDING_COLOR}" stroke-width="0.5"
              class="${hasCriticalFinding ? "graph-pulse" : ""}"/>
            <text x="9" y="13" text-anchor="middle" font-size="9" font-weight="600"
              fill="${hasCriticalFinding ? CRITICAL_FINDING_COLOR : WARNING_FINDING_COLOR}">${securityFindingCount}</text>
          </g>
        ` : nothing}

        ${openIssueCount > 0 ? svg`
          <circle cx="${node.w - 8}" cy="8" r="5" fill="${ERROR_COLOR}" stroke="white" stroke-width="1"/>
          <text x="${node.w - 8}" y="11" text-anchor="middle" font-size="7" fill="white" font-weight="700">${openIssueCount}</text>
        ` : (node.stats.errorRate > 0.05 ? svg`<circle cx="${node.w - 12}" cy="12" r="4" fill="${ERROR_COLOR}"/>` : nothing)}

        ${annotations?.isMiddleware && layers.has("auth") ? svg`
          <text x="${node.w}" y="${node.h + 12}" text-anchor="end" font-size="8" fill="#6b7280"
            font-family="ui-monospace,monospace">middleware</text>
        ` : nothing}
      </g>
    `;
  }

  private nodeSubtitle(node: PositionedNode): string {
    switch (node.type) {
      case "endpoint":
        return `${node.stats.requestCount} req · ${node.stats.avgLatencyMs}ms${node.stats.avgQueryCount > 0 ? ` · ${node.stats.avgQueryCount}q` : ""}`;
      case "action":
        return `${node.stats.requestCount}× · ${node.stats.avgLatencyMs}ms`;
      case "table":
        return "table";
      default:
        return "service";
    }
  }

  // ── Edge rendering ──

  private renderEdge(edge: PositionedEdge, highlighted: Set<string> | null, flowEdges: Set<string> | null, maxRequestCount: number) {
    const active = this.activeNodeId;
    const isHighlighted = highlighted === null || (highlighted.has(edge.data.source) && highlighted.has(edge.data.target));
    const isFlowEdge = flowEdges?.has(edge.key) ?? false;
    let opacity = isHighlighted ? (active === null ? 0.25 : 0.6) : 0.04;
    const showLabel = isHighlighted && active !== null;

    let color = edge.color;
    let thickness = edge.thickness;

    if (flowEdges && !isFlowEdge) opacity = 0.04;
    if (isFlowEdge) {
      opacity = 0.85;
      color = FLOW_TRACE_COLOR;
      thickness = Math.max(thickness, 1.8);
    }

    if (this.activeLayers.has("heat") && !isFlowEdge) {
      const maxFreq = Math.max(1, ...this.graphEdges.map((e) => e.stats.frequency));
      const ratio = edge.data.stats.frequency / maxFreq;
      color = trafficHeatColor(ratio);
      if (isHighlighted) opacity = Math.max(opacity, 0.4);
    }

    const hasIssue = this.activeLayers.has("issues") && edge.data.annotations?.hasIssue;

    const dx = Math.abs(edge.tx - edge.sx);
    const controlPointOffset = Math.min(dx * 0.45, 120);
    const goRight = edge.sx < edge.tx;
    const c1x = goRight ? edge.sx + controlPointOffset : edge.sx - controlPointOffset;
    const c2x = goRight ? edge.tx - controlPointOffset : edge.tx + controlPointOffset;

    const labelX = (edge.sx + edge.tx) / 2;
    const labelY = (edge.sy + edge.ty) / 2;

    const arrowSize = 4;
    const strokeColor = hasIssue ? ERROR_COLOR : color;
    const strokeW = hasIssue ? Math.max(thickness, 1.5) : thickness;

    return svg`
      <g style="transition:opacity .15s">
        <path d="M${edge.sx},${edge.sy} C${c1x},${edge.sy} ${c2x},${edge.ty} ${edge.tx},${edge.ty}"
          fill="none" stroke="${strokeColor}" stroke-width="${strokeW}"
          stroke-opacity="${opacity}" stroke-linecap="round"
          stroke-dasharray="${isFlowEdge ? "6,4" : edge.dashed ? "3,3" : "none"}"
          class="${isFlowEdge ? "graph-flow-edge" : ""}"/>
        <polygon points="${edge.tx},${edge.ty} ${edge.tx + (goRight ? -arrowSize * 1.5 : arrowSize * 1.5)},${edge.ty - arrowSize} ${edge.tx + (goRight ? -arrowSize * 1.5 : arrowSize * 1.5)},${edge.ty + arrowSize}"
          fill="${strokeColor}" fill-opacity="${opacity}"/>
        ${showLabel ? svg`
          <rect x="${labelX - edge.label.length * 2.8 - 2}" y="${labelY - 7}" width="${edge.label.length * 5.6 + 8}" height="14"
            rx="4" fill="white" fill-opacity="0.92" stroke="${color}" stroke-width="0.4" stroke-opacity="0.15"/>
          <text x="${labelX}" y="${labelY + 3.5}" fill="${color}" font-size="8" font-weight="500"
            font-family="ui-monospace,monospace" text-anchor="middle" opacity="0.85">${edge.label}</text>
        ` : nothing}
        ${hasIssue ? svg`
          <text x="${labelX}" y="${labelY - 10}" fill="${ERROR_COLOR}" font-size="8" font-weight="600"
            text-anchor="middle">⚠ N+1</text>
        ` : nothing}
      </g>
    `;
  }

  // ── Detail panel ──

  private renderDetailPanel(info: { node: GraphNode; edges: GraphEdge[] }) {
    const { node, edges } = info;
    const style = NODE_TYPE_STYLE[node.type] || NODE_TYPE_STYLE.endpoint;
    const annotations = node.annotations;

    const hasSecurity = (annotations?.securityFindings?.length ?? 0) > 0;
    const hasIssues = (annotations?.openIssueCount ?? 0) > 0;
    const hasPerf = annotations?.p95Ms !== undefined;

    const tabs: { key: DetailTab; label: string; show: boolean }[] = [
      { key: "overview", label: "Overview", show: true },
      { key: "security", label: `Security${hasSecurity ? ` (${annotations!.securityFindings!.length})` : ""}`, show: hasSecurity },
      { key: "performance", label: "Perf", show: hasPerf },
      { key: "issues", label: `Issues${hasIssues ? ` (${annotations!.openIssueCount})` : ""}`, show: hasIssues },
    ];

    const visibleTabs = tabs.filter((t) => t.show);

    return html`
      <div class="graph-detail">
        <div class="graph-detail-head">
          <div>
            <div class="graph-detail-badge" style="color:${style.stroke}">${style.icon} ${node.type}</div>
            <div class="graph-detail-name">${node.label}</div>
            ${annotations?.hasAuth ? html`<span class="graph-detail-auth-badge">🛡 Authenticated</span>` : nothing}
            ${annotations?.isMiddleware ? html`<span class="graph-detail-mw-badge">middleware</span>` : nothing}
          </div>
          <button class="graph-detail-close" @click=${() => { this.locked = null; }}>✕</button>
        </div>

        ${visibleTabs.length > 1 ? html`
          <div class="graph-detail-tabs">
            ${visibleTabs.map((t) => html`
              <button class="graph-detail-tab ${this.detailTab === t.key ? "active" : ""}"
                @click=${() => { this.detailTab = t.key; }}>${t.label}</button>
            `)}
          </div>
        ` : nothing}

        ${this.detailTab === "overview" ? this.renderOverviewTab(node, edges) : nothing}
        ${this.detailTab === "security" ? this.renderSecurityTab(annotations) : nothing}
        ${this.detailTab === "performance" ? this.renderPerformanceTab(node, annotations) : nothing}
        ${this.detailTab === "issues" ? this.renderIssuesTab(annotations) : nothing}
      </div>
    `;
  }

  private renderOverviewTab(node: GraphNode, edges: GraphEdge[]) {
    return html`
      <div class="graph-detail-stats">
        <div class="graph-detail-stat">
          <div class="graph-detail-val">${node.stats.requestCount}</div>
          <div class="graph-detail-lbl">${node.type === "action" ? "OCCURRENCES" : "REQUESTS"}</div>
        </div>
        <div class="graph-detail-stat">
          <div class="graph-detail-val" style="color:${latencyColor(node.stats.avgLatencyMs)}">${node.stats.avgLatencyMs}ms</div>
          <div class="graph-detail-lbl">AVG LATENCY</div>
        </div>
        ${node.stats.avgQueryCount > 0 ? html`
          <div class="graph-detail-stat">
            <div class="graph-detail-val">${node.stats.avgQueryCount}</div>
            <div class="graph-detail-lbl">QUERIES/REQ</div>
          </div>
        ` : nothing}
        ${node.stats.errorRate > 0.01 ? html`
          <div class="graph-detail-stat">
            <div class="graph-detail-val" style="color:${ERROR_COLOR}">${Math.round(node.stats.errorRate * 100)}%</div>
            <div class="graph-detail-lbl">ERRORS</div>
          </div>
        ` : nothing}
      </div>

      ${edges.length > 0 ? html`
        <div class="graph-detail-sec">Connections</div>
        ${edges.map((e) => {
          const isOutbound = e.source === this.locked;
          const otherLabel = (isOutbound ? e.target : e.source).replace(/^(action|endpoint|table|external):/, "");
          return html`
            <div class="graph-detail-conn">
              <span class="graph-detail-edge-dot" style="background:${EDGE_COLORS[e.type]}"></span>
              <span class="graph-detail-edge-type">${e.type}</span>
              <span>${isOutbound ? "→" : "←"} ${otherLabel}</span>
              <span class="graph-detail-dim">${e.stats.frequency}× · ${e.stats.avgLatencyMs}ms</span>
            </div>
          `;
        })}
      ` : nothing}

      ${edges.some((e) => e.patterns?.length) ? html`
        <div class="graph-detail-sec">SQL Patterns</div>
        ${edges.filter((e) => e.patterns).flatMap((e) => e.patterns!).map((pattern) => html`
          <pre class="graph-detail-sql">${pattern.length > 200 ? pattern.slice(0, 200) + "…" : pattern}</pre>
        `)}
      ` : nothing}
    `;
  }

  private renderSecurityTab(annotations?: NodeAnnotations) {
    if (!annotations?.securityFindings?.length) return html`<div class="graph-detail-empty">No security findings</div>`;
    return html`
      ${annotations.securityFindings.map((finding) => html`
        <div class="graph-detail-finding">
          <span class="graph-detail-severity graph-detail-severity-${finding.severity}">${finding.severity}</span>
          <div class="graph-detail-finding-title">${finding.title}</div>
          <div class="graph-detail-finding-meta">${finding.rule} · ${finding.count} occurrence${finding.count !== 1 ? "s" : ""}</div>
        </div>
      `)}
    `;
  }

  private renderPerformanceTab(node: GraphNode, annotations?: NodeAnnotations) {
    return html`
      <div class="graph-detail-stats">
        ${annotations?.p95Ms !== undefined ? html`
          <div class="graph-detail-stat">
            <div class="graph-detail-val" style="color:${latencyColor(annotations.p95Ms)}">${annotations.p95Ms}ms</div>
            <div class="graph-detail-lbl">P95 LATENCY</div>
          </div>
        ` : nothing}
        <div class="graph-detail-stat">
          <div class="graph-detail-val" style="color:${latencyColor(node.stats.avgLatencyMs)}">${node.stats.avgLatencyMs}ms</div>
          <div class="graph-detail-lbl">AVG LATENCY</div>
        </div>
        ${node.stats.avgQueryCount > 0 ? html`
          <div class="graph-detail-stat">
            <div class="graph-detail-val">${node.stats.avgQueryCount}</div>
            <div class="graph-detail-lbl">QUERIES/REQ</div>
          </div>
        ` : nothing}
        <div class="graph-detail-stat">
          <div class="graph-detail-val">${node.stats.requestCount}</div>
          <div class="graph-detail-lbl">TOTAL REQS</div>
        </div>
      </div>

      ${(annotations?.insights?.length ?? 0) > 0 ? html`
        <div class="graph-detail-sec">Performance Insights</div>
        ${annotations!.insights!.map((insight) => html`
          <div class="graph-detail-finding">
            <span class="graph-detail-severity graph-detail-severity-${insight.severity}">${insight.severity}</span>
            <div class="graph-detail-finding-title">${insight.title}</div>
            <div class="graph-detail-finding-meta">${insight.type}</div>
          </div>
        `)}
      ` : nothing}
    `;
  }

  private renderIssuesTab(annotations?: NodeAnnotations) {
    const count = annotations?.openIssueCount ?? 0;
    if (count === 0) return html`<div class="graph-detail-empty">No open issues</div>`;
    return html`
      <div class="graph-detail-issue-summary">
        <div class="graph-detail-stat">
          <div class="graph-detail-val" style="color:${ERROR_COLOR}">${count}</div>
          <div class="graph-detail-lbl">OPEN ISSUES</div>
        </div>
      </div>
      <p class="graph-detail-hint">View the Issues tab for full details and remediation hints.</p>
    `;
  }

  // ── Helpers ──

  private getSelectedNodeDetail(): { node: GraphNode; edges: GraphEdge[] } | null {
    if (!this.locked) return null;
    const node = this.graphNodes.find((n) => n.id === this.locked);
    if (!node) return null;
    const edges = this.graphEdges.filter((e) => e.source === this.locked || e.target === this.locked);
    return { node, edges };
  }
}
