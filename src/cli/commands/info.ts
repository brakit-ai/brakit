import { defineCommand } from "citty";
import { resolve } from "node:path";
import pc from "picocolors";
import { detectProjectContext } from "../../core/plugin/auto-detect.js";

export default defineCommand({
  meta: {
    name: "info",
    description: "Show detected project context and stack",
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
      default: ".",
    },
  },
  async run({ args }) {
    const rootDir = resolve(args.dir as string);
    const ctx = await detectProjectContext(rootDir);

    console.log(pc.bold("\nbrakit project info\n"));
    console.log(`  Directory:       ${rootDir}`);
    console.log(`  Package Manager: ${ctx.packageManager}`);
    console.log(`  TypeScript:      ${ctx.typescript ? "yes" : "no"}`);
    console.log();

    const stack = [
      ["Framework", ctx.framework],
      ["ORM", ctx.orm],
      ["Auth", ctx.auth],
      ["BaaS", ctx.baas],
    ] as const;

    console.log(pc.bold("  Detected Stack:"));
    for (const [label, info] of stack) {
      if (info) {
        console.log(
          `    ${label.padEnd(12)} ${pc.green(info.name)} ${pc.dim(`v${info.version}`)}`,
        );
      } else {
        console.log(`    ${label.padEnd(12)} ${pc.dim("not detected")}`);
      }
    }
    console.log();
  },
});
