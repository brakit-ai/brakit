import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "scan",
    description: "Scan the current project for vulnerabilities",
  },
  args: {
    dir: {
      type: "positional",
      description: "Directory to scan",
      required: false,
      default: ".",
    },
    json: {
      type: "boolean",
      description: "Output results as JSON",
      default: false,
    },
    "min-severity": {
      type: "string",
      description: "Minimum severity to report (critical|high|medium|low)",
      default: "low",
    },
    verbose: {
      type: "boolean",
      description: "Show detailed output including analyzer timing",
      default: false,
    },
  },
  run({ args }) {
    console.log(`brakit v0.1.0 — scanning ${args.dir}`);
    console.log("Scanner not yet implemented. Coming in Phase 6.");
  },
});
