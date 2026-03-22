import { runMain } from "citty";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import installCommand from "../src/cli/commands/install.js";
import uninstallCommand from "../src/cli/commands/uninstall.js";
import { trackEvent } from "../src/telemetry/index.js";
import { TELEMETRY_EVENT_CLI_INVOKED } from "../src/constants/config.js";

const sub = process.argv[2];
const command = sub === "uninstall" ? "uninstall" : sub === "mcp" ? "mcp" : "install";
const cwd = process.cwd();

trackEvent(TELEMETRY_EVENT_CLI_INVOKED, {
  command,
  has_package_json: existsSync(resolve(cwd, "package.json")),
  cwd_has_node_modules: existsSync(resolve(cwd, "node_modules")),
});

if (sub === "uninstall") {
  process.argv.splice(2, 1);
  runMain(uninstallCommand);
} else if (sub === "mcp") {
  import("../src/mcp/server.js")
    .then(({ startMcpServer }) => startMcpServer())
    .catch((err) => {
      process.stderr.write(`[brakit] MCP server failed: ${(err as Error).message}\n`);
      process.exitCode = 1;
    });
} else {
  if (sub === "install") process.argv.splice(2, 1);
  runMain(installCommand);
}
