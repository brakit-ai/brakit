import { defineCommand } from "citty";
import { resolve } from "node:path";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { startBrakit, createShutdownHandler } from "../../lifecycle/index.js";

export default defineCommand({
  meta: {
    name: "brakit",
    version: VERSION,
    description: "Runtime request tracer for local development",
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
      default: ".",
    },
    port: {
      type: "string",
      description: "Port for brakit proxy",
      default: "3000",
    },
    command: {
      type: "string",
      alias: "c",
      description: "Custom dev server command (e.g. 'python manage.py runserver')",
    },
    "show-static": {
      type: "boolean",
      description: "Show static asset requests",
      default: false,
    },
  },
  async run({ args }) {
    const instance = await startBrakit({
      rootDir: resolve(args.dir as string),
      proxyPort: parseInt(args.port as string, 10),
      showStatic: args["show-static"] as boolean,
      customCommand: args.command as string | undefined,
    });

    const cleanup = createShutdownHandler(instance);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    instance.devProcess.on("exit", (code) => {
      console.log(pc.dim(`\n  Dev server exited with code ${code}`));
      instance.proxy.close();
      process.exit(code ?? 1);
    });
  },
});
