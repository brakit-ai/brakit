import type { BrakitAdapter } from "./adapter.js";
import type { TelemetryEvent } from "../types/index.js";

export class AdapterRegistry {
  private adapters: BrakitAdapter[] = [];
  private active: BrakitAdapter[] = [];

  register(adapter: BrakitAdapter): void {
    this.adapters.push(adapter);
  }

  patchAll(emit: (event: TelemetryEvent) => void): void {
    for (const adapter of this.adapters) {
      try {
        if (adapter.detect()) {
          adapter.patch(emit);
          this.active.push(adapter);
        }
      } catch {
        // One adapter failing doesn't stop others
      }
    }
  }

  unpatchAll(): void {
    for (const adapter of this.active) {
      try {
        adapter.unpatch?.();
      } catch {
        // Best effort cleanup
      }
    }
    this.active = [];
  }

  getActive(): readonly BrakitAdapter[] {
    return this.active;
  }
}
