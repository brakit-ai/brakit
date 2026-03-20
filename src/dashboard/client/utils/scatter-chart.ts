/**
 * Standalone scatter chart drawing utilities extracted from performance-view.
 * Pure canvas rendering — no Lit or DOM dependencies.
 */

import {
  DOT_COLORS,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  CHART_PAD,
  CHART_GRID_COLOR,
  CHART_LABEL_COLOR,
  CHART_FONT,
  CHART_FONT_SM,
  CHART_FONT_XS,
} from "../constants.js";
import type { LiveRequestPoint } from "../store/types.js";

export interface ScatterDot {
  x: number;
  y: number;
  idx: number;
  r: LiveRequestPoint;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return Math.round(ms) + "ms";
  return (ms / 1000).toFixed(1) + "s";
}

function dotColor(ms: number): string {
  if (ms < HEALTH_GOOD_MS) return DOT_COLORS.green;
  if (ms < HEALTH_OK_MS) return DOT_COLORS.amber;
  return DOT_COLORS.red;
}

function reqDotColor(r: LiveRequestPoint): string {
  if (r.statusCode >= 400) return DOT_COLORS.red;
  return dotColor(r.durationMs);
}

function parseHex(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const [r, g, b] = parseHex(color);
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawErrorX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, lineWidth: number) {
  const [r, g, b] = parseHex(color);
  ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
  ctx.lineWidth = lineWidth + 2;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw the full scatter chart (with grid, thresholds, time axis, data dots).
 * Returns the array of ScatterDot positions for hit-testing on click.
 */
export function drawScatterChart(canvas: HTMLCanvasElement, requests: LiveRequestPoint[]): ScatterDot[] {
  const dots: ScatterDot[] = [];
  const setup = setupCanvas(canvas);
  if (!setup || requests.length === 0) return dots;
  const { ctx, w, h } = setup;

  const pad = CHART_PAD;
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  let maxVal = 0, minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
  for (const r of requests) {
    if (r.durationMs > maxVal) maxVal = r.durationMs;
    if (r.timestamp < minTime) minTime = r.timestamp;
    if (r.timestamp > maxTime) maxTime = r.timestamp;
  }
  maxVal = Math.max(maxVal, 10);
  maxVal = Math.ceil((maxVal * 1.15) / 10) * 10;
  const timeRange = maxTime - minTime || 1;

  // Grid lines
  ctx.strokeStyle = CHART_GRID_COLOR;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let gi = 0; gi <= gridLines; gi++) {
    const gy = pad.top + ch - (gi / gridLines) * ch;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + cw, gy); ctx.stroke();
    ctx.fillStyle = CHART_LABEL_COLOR;
    ctx.font = CHART_FONT;
    ctx.textAlign = "right";
    ctx.fillText(fmtMs(Math.round((gi / gridLines) * maxVal)), pad.left - 8, gy + 3);
  }

  // Threshold dashed lines
  for (const t of [{ ms: HEALTH_GOOD_MS }, { ms: HEALTH_OK_MS }]) {
    if (t.ms >= maxVal) continue;
    const ty = pad.top + ch - (t.ms / maxVal) * ch;
    ctx.beginPath(); ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(113,113,122,0.3)"; ctx.lineWidth = 1;
    ctx.moveTo(pad.left, ty); ctx.lineTo(pad.left + cw, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(113,113,122,0.5)"; ctx.font = CHART_FONT_SM;
    ctx.textAlign = "left";
    ctx.fillText(fmtMs(t.ms), pad.left + cw + 2, ty + 3);
  }

  // Data points
  for (let idx = 0; idx < requests.length; idx++) {
    const r = requests[idx];
    const x = requests.length === 1 ? pad.left + cw / 2 : pad.left + ((r.timestamp - minTime) / timeRange) * cw;
    const y = pad.top + ch - (r.durationMs / maxVal) * ch;
    const color = reqDotColor(r);
    dots.push({ x, y, idx, r });
    if (r.statusCode >= 400) drawErrorX(ctx, x, y, 4, color, 2);
    else drawDot(ctx, x, y, 4, color);
  }

  // Time axis
  ctx.fillStyle = CHART_LABEL_COLOR; ctx.font = CHART_FONT_SM; ctx.textAlign = "center";
  const timePoints = [minTime, minTime + timeRange / 2, maxTime];
  for (let i = 0; i < timePoints.length; i++) {
    const x = pad.left + (i / 2) * cw;
    const d = new Date(timePoints[i]);
    ctx.fillText(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), x, pad.top + ch + 14);
  }

  return dots;
}

/**
 * Draw a compact inline scatter chart (used in the overview endpoint cards).
 */
export function drawInlineScatter(canvas: HTMLCanvasElement, requests: LiveRequestPoint[]): void {
  const setup = setupCanvas(canvas);
  if (!setup || requests.length === 0) return;
  const { ctx, w, h } = setup;

  const padX = 4, padY = 4;
  const cw = w - padX * 2, ch = h - padY * 2;

  let maxVal = 0, minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
  for (const r of requests) {
    if (r.durationMs > maxVal) maxVal = r.durationMs;
    if (r.timestamp < minTime) minTime = r.timestamp;
    if (r.timestamp > maxTime) maxTime = r.timestamp;
  }
  maxVal = Math.max(maxVal, 10);
  maxVal = Math.ceil((maxVal * 1.15) / 10) * 10;
  const timeRange = maxTime - minTime || 1;

  for (const ms of [HEALTH_GOOD_MS, HEALTH_OK_MS]) {
    if (ms >= maxVal) continue;
    const ty = padY + ch - (ms / maxVal) * ch;
    ctx.beginPath(); ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(113,113,122,0.15)"; ctx.lineWidth = 1;
    ctx.moveTo(padX, ty); ctx.lineTo(padX + cw, ty); ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const r of requests) {
    const x = requests.length === 1 ? padX + cw / 2 : padX + ((r.timestamp - minTime) / timeRange) * cw;
    const y = padY + ch - (r.durationMs / maxVal) * ch;
    const color = reqDotColor(r);
    if (r.statusCode >= 400) drawErrorX(ctx, x, y, 2.5, color, 1.5);
    else drawDot(ctx, x, y, 2.5, color);
  }

  ctx.fillStyle = "rgba(113,113,122,0.5)"; ctx.font = CHART_FONT_XS;
  ctx.textAlign = "right";
  ctx.fillText(fmtMs(maxVal), w - 2, padY + 8);
  ctx.fillText(fmtMs(0), w - 2, h - 2);
}
