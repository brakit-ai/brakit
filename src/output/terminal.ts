import pc from "picocolors";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX } from "../constants/index.js";

export function printBanner(proxyPort: number, targetPort: number): void {
  console.log();
  console.log(`  ${pc.bold(pc.magenta("brakit"))} ${pc.dim(`v${VERSION}`)}`);
  console.log();
  console.log(
    `  ${pc.dim("proxy")}      ${pc.bold(`http://localhost:${proxyPort}`)}`,
  );
  console.log(
    `  ${pc.dim("target")}     ${pc.dim(`http://localhost:${targetPort}`)}`,
  );
  console.log(
    `  ${pc.dim("dashboard")}  ${pc.bold(pc.magenta(`http://localhost:${proxyPort}${DASHBOARD_PREFIX}`))}`,
  );
  console.log();
}
