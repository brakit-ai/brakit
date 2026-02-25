import { MAX_HEALTH_ERRORS } from "../constants/index.js";

class BrakitHealth {
  private errorCount = 0;
  private disabled = false;
  private teardownFn: (() => void) | null = null;

  reportError(): void {
    this.errorCount++;
    if (this.errorCount >= MAX_HEALTH_ERRORS && !this.disabled) {
      this.disabled = true;
      console.warn("brakit: too many errors, disabling for this session.");
      this.teardownFn?.();
    }
  }

  isActive(): boolean {
    return !this.disabled;
  }

  setTeardown(fn: () => void): void {
    this.teardownFn = fn;
  }
}

export const health = new BrakitHealth();
