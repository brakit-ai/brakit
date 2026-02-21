import { runMain } from "citty";
import devCommand from "../src/cli/commands/dev.js";
import telemetryCommand from "../src/cli/commands/telemetry.js";

if (process.argv[2] === "telemetry") {
  process.argv.splice(2, 1);
  runMain(telemetryCommand);
} else {
  if (process.argv[2] === "dev") {
    process.argv.splice(2, 1);
  }
  runMain(devCommand);
}
