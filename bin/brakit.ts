import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "brakit",
    version: "0.1.0",
    description: "Multi-dimensional code security scanner",
  },
  subCommands: {
    scan: () => import("../src/cli/commands/scan").then((m) => m.default),
    info: () => import("../src/cli/commands/info").then((m) => m.default),
  },
});

runMain(main);
