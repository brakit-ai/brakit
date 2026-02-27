import { runMain } from "citty";
import installCommand from "../src/cli/commands/install.js";
import uninstallCommand from "../src/cli/commands/uninstall.js";

const sub = process.argv[2];

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
  // `npx brakit` and `npx brakit install` both run install
  if (sub === "install") process.argv.splice(2, 1);
  runMain(installCommand);
}
