import type { TracedError } from "../types.js";
import { TelemetryStore } from "./telemetry-store.js";

export class ErrorStore extends TelemetryStore<TracedError> {}

export const defaultErrorStore = new ErrorStore();
