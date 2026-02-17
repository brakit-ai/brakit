import type { TracedLog } from "../types.js";
import { TelemetryStore } from "./telemetry-store.js";

export class LogStore extends TelemetryStore<TracedLog> {}

export const defaultLogStore = new LogStore();
