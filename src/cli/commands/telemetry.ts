import { defineCommand } from "citty";
import pc from "picocolors";
import { isTelemetryEnabled, setTelemetryEnabled } from "../../telemetry/index.js";

export default defineCommand({
  meta: {
    name: "telemetry",
    description: "Manage anonymous telemetry settings",
  },
  args: {
    action: {
      type: "positional",
      description: "on | off | status",
      required: false,
    },
  },
  run({ args }) {
    const action = (args.action as string | undefined)?.toLowerCase();

    if (action === "on") {
      setTelemetryEnabled(true);
      console.log(pc.green("  Telemetry enabled."));
      return;
    }

    if (action === "off") {
      setTelemetryEnabled(false);
      console.log(pc.yellow("  Telemetry disabled. No data will be collected."));
      return;
    }

    const enabled = isTelemetryEnabled();
    console.log();
    console.log(`  ${pc.bold("Telemetry")}: ${enabled ? pc.green("enabled") : pc.yellow("disabled")}`);
    console.log();
    console.log(pc.dim("  brakit collects anonymous usage data to improve the tool."));
    console.log(pc.dim("  No URLs, queries, bodies, or source code are ever sent."));
    console.log();
    console.log(pc.dim("  Opt out:     ") + pc.bold("brakit telemetry off"));
    console.log(pc.dim("  Opt in:      ") + pc.bold("brakit telemetry on"));
    console.log(pc.dim("  Env override: BRAKIT_TELEMETRY=false"));
    console.log();
  },
});
