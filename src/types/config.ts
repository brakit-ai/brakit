export type Framework =
  | "nextjs"
  | "remix"
  | "nuxt"
  | "vite"
  | "astro"
  | "flask"
  | "fastapi"
  | "django"
  | "custom"
  | "unknown";

export type PythonPackageManager = "uv" | "poetry" | "pipenv" | "pip" | "unknown";

export interface DetectedPythonProject {
  framework: "flask" | "fastapi" | "django" | "unknown";
  packageManager: PythonPackageManager;
  entryFile: string | null;
  defaultPort: number;
}

export interface DetectedProject {
  framework: Framework;
  devCommand: string;
  devBin: string;
  defaultPort: number;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
}

export interface BrakitConfig {
  proxyPort: number;
  targetPort: number;
  showStatic: boolean;
  maxBodyCapture: number;
  customCommand?: string;
}
