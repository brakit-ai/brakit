import type { BrakitConfig } from "../types.js";
import { getStyles } from "./styles.js";
import { getLayoutHtml } from "./layout.js";
import { getClientScript } from "./client.js";

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
${getLayoutHtml(config)}
<script>${getClientScript(config)}</script>
</body>
</html>`;
}
