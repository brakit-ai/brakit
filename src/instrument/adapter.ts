import type { TelemetryEvent } from "../types/index.js";

export interface BrakitAdapter {
  name: string;
  detect(): boolean;
  patch(emit: (event: TelemetryEvent) => void): void;
  unpatch?(): void;
}
