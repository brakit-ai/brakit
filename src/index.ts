export const VERSION = process.env.BRAKIT_VERSION ?? "0.0.0";

export type {
  TracedRequest,
  DetectedProject,
  BrakitConfig,
  Framework,
  HttpMethod,
  FlatHeaders,
  RequestCategory,
  RequestListener,
  NormalizedOp,
  SecurityFinding,
  SecuritySeverity,
} from "./types/index.js";
export type { BrakitAdapter } from "./instrument/adapter.js";
export type { SecurityRule, SecurityContext } from "./analysis/rules/index.js";
export type { Insight, InsightContext } from "./analysis/insights.js";
export { createProxyServer } from "./proxy/server.js";
export { detectProject } from "./detect/project.js";
export { AdapterRegistry } from "./instrument/adapter-registry.js";
export { SecurityScanner, createDefaultScanner } from "./analysis/rules/index.js";
export { AnalysisEngine } from "./analysis/engine.js";
export { computeInsights } from "./analysis/insights.js";
