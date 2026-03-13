/**
 * Generates a standalone dashboard HTML file.
 *
 * Run after `npm run build`:
 *   npx tsx scripts/export-dashboard.ts
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { getStyles } from "../src/dashboard/styles.js";
import { getLayoutHtml } from "../src/dashboard/layout.js";

const PLACEHOLDER = "{{PORT}}";
const VERSION_PLACEHOLDER = "{{VERSION}}";

const clientBundle = readFileSync(resolve("dist/dashboard-client.global.js"), "utf-8");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>brakit</title>
<style>${getStyles()}</style>
</head>
<body>
${getLayoutHtml()}
<script>window.__BRAKIT_CONFIG__={port:${PLACEHOLDER},version:"${VERSION_PLACEHOLDER}"};</script>
<script>${clientBundle}</script>
</body>
</html>`;

const distPath = resolve("dist/dashboard.html");
mkdirSync(dirname(distPath), { recursive: true });
writeFileSync(distPath, html, "utf-8");
console.log(`  wrote ${distPath}`);
