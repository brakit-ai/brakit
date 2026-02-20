export type Framework =
  | "nextjs"
  | "remix"
  | "nuxt"
  | "vite"
  | "astro"
  | "custom"
  | "unknown";

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
