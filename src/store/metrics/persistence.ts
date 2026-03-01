import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import type { MetricsData } from "../../types/index.js";
import { METRICS_DIR, METRICS_FILE } from "../../constants/index.js";
import { AtomicWriter } from "../../utils/atomic-writer.js";
import { brakitWarn } from "../../utils/log.js";

export interface MetricsPersistence {
  load(): MetricsData;
  save(data: MetricsData): void;
  saveSync(data: MetricsData): void;
  remove(): void;
}

export class FileMetricsPersistence implements MetricsPersistence {
  private readonly metricsPath: string;
  private readonly writer: AtomicWriter;

  constructor(rootDir: string) {
    this.metricsPath = resolve(rootDir, METRICS_FILE);
    this.writer = new AtomicWriter({
      dir: resolve(rootDir, METRICS_DIR),
      filePath: this.metricsPath,
      gitignoreEntry: METRICS_DIR,
      label: "metrics",
    });
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
    } catch (err) {
      brakitWarn(`failed to load metrics: ${(err as Error).message}`);
    }
    return { version: 1, endpoints: [] };
  }

  save(data: MetricsData): void {
    this.writer.writeAsync(JSON.stringify(data));
  }

  saveSync(data: MetricsData): void {
    this.writer.writeSync(JSON.stringify(data));
  }

  remove(): void {
    try {
      if (existsSync(this.metricsPath)) {
        unlinkSync(this.metricsPath);
      }
    } catch {}
  }
}
