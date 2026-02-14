import type { Severity } from "./findings.js";

export interface BrakitConfig {
  minSeverity: Severity;
  exclude: string[];
  pluginOptions: Record<string, Record<string, unknown>>;
  scoreThreshold?: number;
}

export interface ScanConfig {
  minSeverity: Severity;
  exclude: string[];
  pluginOptions: Record<string, Record<string, unknown>>;
  scoreThreshold: number;
}

export const DEFAULT_CONFIG: BrakitConfig = {
  minSeverity: "low",
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/__tests__/**",
  ],
  pluginOptions: {},
};
