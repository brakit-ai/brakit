import type { TracedLog } from "../types/index.js";
import { TelemetryStore } from "./telemetry-store.js";

export class LogStore extends TelemetryStore<TracedLog> {}
