import type { DetectedProject } from "./config.js";

export interface FrontendDetector {
  readonly name: string;
  detect(rootDir: string): Promise<DetectedProject | null>;
}

export interface BackendDetector {
  readonly framework: string;
  readonly language: string;
  readonly defaultPort: number;
  detect(content: string): boolean;
  buildRunCommand(
    rootDir: string,
  ): Promise<{ runCommand: string[]; envVars?: Record<string, string> }>;
}
