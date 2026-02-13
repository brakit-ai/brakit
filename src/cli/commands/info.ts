import { defineCommand } from "citty";

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
  run({ args }) {
    console.log(`brakit project info — ${args.dir}`);
    console.log("Project detection not yet implemented. Coming in Phase 2.");
  },
});
