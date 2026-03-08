/**
 * Generates a standalone dashboard HTML file and syncs it to the Python SDK.
 *
 * Run after `npm run build`:
 *   npx tsx scripts/export-dashboard.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { getDashboardHtml } from "../src/dashboard/page.js";
import type { BrakitConfig } from "../src/types/config.js";

const SENTINEL_PORT = 0;
const PLACEHOLDER = "{{PORT}}";

const config: BrakitConfig = {
  proxyPort: SENTINEL_PORT,
  targetPort: 0,
  showStatic: false,
  maxBodyCapture: 10_240,
};

let html = getDashboardHtml(config);

// Replace sentinel port values with placeholders
html = html.replace(`var PORT = ${SENTINEL_PORT};`, `var PORT = ${PLACEHOLDER};`);
html = html.replace(`:${SENTINEL_PORT}</div>`, `:${PLACEHOLDER}</div>`);

// Write standalone HTML
const distPath = resolve("dist/dashboard.html");
mkdirSync(dirname(distPath), { recursive: true });
writeFileSync(distPath, html, "utf-8");
console.log(`  wrote ${distPath}`);
