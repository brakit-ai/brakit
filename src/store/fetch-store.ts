import type { TracedFetch } from "../types.js";
import { TelemetryStore } from "./telemetry-store.js";

export class FetchStore extends TelemetryStore<TracedFetch> {}

export const defaultFetchStore = new FetchStore();
