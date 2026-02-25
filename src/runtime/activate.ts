import { CLOUD_SIGNALS } from "../constants/index.js";

export function shouldActivate(): boolean {
  if (process.env.BRAKIT_DISABLE === "true") return false;

  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === "production" || env === "staging") return false;

  if (process.env.CI) return false;

  if (CLOUD_SIGNALS.some((key) => process.env[key])) return false;

  return true;
}
