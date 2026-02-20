import { runMain } from "citty";
import devCommand from "../src/cli/commands/dev.js";

if (process.argv[2] === "dev") {
  process.argv.splice(2, 1);
}

runMain(devCommand);
