import pc from "picocolors";
import { SHUTDOWN_TIMEOUT_MS } from "../constants/index.js";
import type { BrakitInstance } from "./startup.js";

export function createShutdownHandler(instance: BrakitInstance): () => void {
  let shuttingDown = false;

  return () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(pc.dim("\n  Shutting down..."));
    instance.analysisEngine.stop();
    instance.metricsStore.stop();
    instance.proxy.close();
    instance.devProcess.kill("SIGTERM");
    setTimeout(() => {
      instance.devProcess.kill("SIGKILL");
      process.exit(0);
    }, SHUTDOWN_TIMEOUT_MS);
  };
}
