import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import type { MetricsData } from "../../types/index.js";
import { METRICS_FILE } from "../../constants/index.js";
import { AtomicWriter } from "../../utils/atomic-writer.js";
import { fileExists } from "../../utils/fs.js";
import { brakitWarn, brakitDebug } from "../../utils/log.js";
import { getErrorMessage, validateMetricsData } from "../../utils/type-guards.js";

const DEFAULT_METRICS: MetricsData = { version: 1, endpoints: [] };

export interface MetricsPersistence {
  load(): MetricsData;
  loadAsync(): Promise<MetricsData>;
  save(data: MetricsData): void;
  saveSync(data: MetricsData): void;
  remove(): void;
}

export class FileMetricsPersistence implements MetricsPersistence {
  private readonly metricsPath: string;
  private readonly writer: AtomicWriter;

  constructor(dataDir: string) {
    this.metricsPath = resolve(dataDir, METRICS_FILE);
    this.writer = new AtomicWriter({
      dir: dataDir,
      filePath: this.metricsPath,
      label: "metrics",
    });
  }

  load(): MetricsData {
    try {
      if (existsSync(this.metricsPath)) {
        return this.parseMetrics(readFileSync(this.metricsPath, "utf-8"));
      }
    } catch (err) {
      brakitWarn(`failed to load ${this.metricsPath}: ${getErrorMessage(err)}`);
    }
    return { ...DEFAULT_METRICS };
  }

  async loadAsync(): Promise<MetricsData> {
    try {
      if (await fileExists(this.metricsPath)) {
        return this.parseMetrics(await readFile(this.metricsPath, "utf-8"));
      }
    } catch (err) {
      brakitWarn(`failed to load ${this.metricsPath}: ${getErrorMessage(err)}`);
    }
    return { ...DEFAULT_METRICS };
  }

  /** Parse and validate metrics JSON, returning default empty data on invalid input. */
  private parseMetrics(raw: string): MetricsData {
    return validateMetricsData(JSON.parse(raw)) ?? { ...DEFAULT_METRICS };
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
    } catch (err) { brakitDebug(`failed to remove metrics file: ${getErrorMessage(err)}`); }
  }
}
