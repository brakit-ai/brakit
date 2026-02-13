export interface ProjectContext {
  rootDir: string;
  framework: StackInfo | null;
  orm: StackInfo | null;
  auth: StackInfo | null;
  baas: StackInfo | null;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  typescript: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface StackInfo {
  name: string;
  version: string;
  details: Record<string, unknown>;
}
