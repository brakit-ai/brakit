import type { TracedError } from "../types/index.js";
import { TelemetryStore } from "./telemetry-store.js";

export class ErrorStore extends TelemetryStore<TracedError> {}
