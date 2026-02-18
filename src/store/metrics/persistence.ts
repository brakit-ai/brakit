import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import type { MetricsData } from "../../types/index.js";
import { METRICS_DIR, METRICS_FILE } from "../../constants/index.js";
import { ensureGitignore } from "../../utils/fs.js";

export interface MetricsPersistence {
  load(): MetricsData;
  save(data: MetricsData): void;
  remove(): void;
}

export class FileMetricsPersistence implements MetricsPersistence {
  private readonly metricsDir: string;
  private readonly metricsPath: string;

  constructor(rootDir: string) {
    this.metricsDir = resolve(rootDir, METRICS_DIR);
    this.metricsPath = resolve(rootDir, METRICS_FILE);
  }

  load(): MetricsData {
    try {
      if (existsSync(this.metricsPath)) {
        const raw = readFileSync(this.metricsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.endpoints)) {
          return parsed as MetricsData;
        }
      }
    } catch {
      // Corrupted file — start fresh
    }
    return { version: 1, endpoints: [] };
  }

  save(data: MetricsData): void {
    try {
      if (!existsSync(this.metricsDir)) {
        mkdirSync(this.metricsDir, { recursive: true });
        ensureGitignore(this.metricsDir, METRICS_DIR);
      }
      writeFileSync(this.metricsPath, JSON.stringify(data, null, 2));
    } catch {
      // Disk write failed — non-critical
    }
  }

  remove(): void {
    try {
      if (existsSync(this.metricsPath)) {
        unlinkSync(this.metricsPath);
      }
    } catch {
      // Non-critical — file may already be gone
    }
  }
}
