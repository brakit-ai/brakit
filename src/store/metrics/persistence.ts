import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { writeFile, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import type { MetricsData } from "../../types/index.js";
import { METRICS_DIR, METRICS_FILE } from "../../constants/index.js";
import { ensureGitignore } from "../../utils/fs.js";

export interface MetricsPersistence {
  load(): MetricsData;
  save(data: MetricsData): void;
  saveSync(data: MetricsData): void;
  remove(): void;
}

export class FileMetricsPersistence implements MetricsPersistence {
  private readonly metricsDir: string;
  private readonly metricsPath: string;
  private readonly tmpPath: string;
  private writing = false;
  private pendingData: MetricsData | null = null;

  constructor(rootDir: string) {
    this.metricsDir = resolve(rootDir, METRICS_DIR);
    this.metricsPath = resolve(rootDir, METRICS_FILE);
    this.tmpPath = this.metricsPath + ".tmp";
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
      process.stderr.write(`[brakit] failed to load metrics: ${(err as Error).message}\n`);
    }
    return { version: 1, endpoints: [] };
  }

  save(data: MetricsData): void {
    if (this.writing) {
      this.pendingData = data;
      return;
    }
    this.writeAsync(data);
  }

  saveSync(data: MetricsData): void {
    try {
      this.ensureDir();
      writeFileSync(this.tmpPath, JSON.stringify(data));
      renameSync(this.tmpPath, this.metricsPath);
    } catch (err) {
      process.stderr.write(`[brakit] failed to save metrics: ${(err as Error).message}\n`);
    }
  }

  remove(): void {
    try {
      if (existsSync(this.metricsPath)) {
        unlinkSync(this.metricsPath);
      }
    } catch {
      // Non-critical
    }
  }

  private async writeAsync(data: MetricsData): Promise<void> {
    this.writing = true;
    try {
      if (!existsSync(this.metricsDir)) {
        await mkdir(this.metricsDir, { recursive: true });
        ensureGitignore(this.metricsDir, METRICS_DIR);
      }
      await writeFile(this.tmpPath, JSON.stringify(data));
      await rename(this.tmpPath, this.metricsPath);
    } catch (err) {
      process.stderr.write(`[brakit] failed to save metrics: ${(err as Error).message}\n`);
    } finally {
      this.writing = false;
      if (this.pendingData) {
        const next = this.pendingData;
        this.pendingData = null;
        this.writeAsync(next);
      }
    }
  }

  private ensureDir(): void {
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
      ensureGitignore(this.metricsDir, METRICS_DIR);
    }
  }
}
