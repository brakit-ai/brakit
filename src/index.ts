export const VERSION = process.env.BRAKIT_VERSION ?? "0.0.0";

export type {
  TracedRequest,
  DetectedProject,
  BrakitConfig,
  HttpMethod,
  FlatHeaders,
  RequestCategory,
  RequestListener,
} from "./types.js";
export { createProxyServer } from "./proxy/server.js";
export { detectProject } from "./detect/project.js";
