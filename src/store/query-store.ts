import type { TracedQuery } from "../types.js";
import { TelemetryStore } from "./telemetry-store.js";

export class QueryStore extends TelemetryStore<TracedQuery> {}

export const defaultQueryStore = new QueryStore();
