import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrakitConfig } from "../types/index.js";
import { VERSION } from "../index.js";
import { getStyles } from "./styles.js";
import { getLayoutHtml } from "./layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let clientBundle: string | null = null;

function getClientBundle(): string {
  if (clientBundle) return clientBundle;
  const bundlePath = resolve(__dirname, "../dashboard-client.global.js");
  clientBundle = readFileSync(bundlePath, "utf-8");
  return clientBundle;
}

export function getDashboardHtml(config: BrakitConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>brakit</title>
<style>${getStyles()}</style>
</head>
<body>
${getLayoutHtml()}
<script>window.__BRAKIT_CONFIG__={port:${config.proxyPort},version:"${VERSION}"};</script>
<script>${getClientBundle()}</script>
</body>
</html>`;
}
