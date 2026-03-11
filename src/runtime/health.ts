import { MAX_HEALTH_ERRORS, RECOVERY_WINDOW_MS } from "../constants/index.js";

class BrakitHealth {
  private errorCount = 0;
  private disabled = false;
  private disabledAt = 0;
  private teardownFn: (() => void) | null = null;

  reportError(): void {
    this.errorCount++;
    if (this.errorCount >= MAX_HEALTH_ERRORS && !this.disabled) {
      this.disabled = true;
      this.disabledAt = Date.now();
      // Use process.stderr.write instead of console.warn to avoid
      // re-entering brakit's console hook.
      try {
        process.stderr.write("brakit: too many errors, disabling temporarily.\n");
      } catch { /* last resort — even stderr failed */ }
      this.teardownFn?.();
    }
  }

  isActive(): boolean {
    if (!this.disabled) return true;
    // Self-healing: re-enable after recovery window
    if (Date.now() - this.disabledAt > RECOVERY_WINDOW_MS) {
      this.disabled = false;
      this.errorCount = 0;
      return true;
    }
    return false;
  }

  setTeardown(fn: () => void): void {
    this.teardownFn = fn;
  }
}

export const health = new BrakitHealth();
