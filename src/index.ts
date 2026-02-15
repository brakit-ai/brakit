export const VERSION = "0.2.0";

export type { TracedRequest, DetectedProject, BrakitConfig } from "./types.js";
export { createProxyServer } from "./proxy/server.js";
export { detectProject } from "./detect/project.js";
