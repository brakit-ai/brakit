export interface Disposable {
  dispose(): void;
}

export class SubscriptionBag implements Disposable {
  private items = new Set<Disposable>();

  add(teardown: (() => void) | Disposable): void {
    this.items.add(typeof teardown === "function" ? { dispose: teardown } : teardown);
  }

  dispose(): void {
    for (const d of this.items) d.dispose();
    this.items.clear();
  }
}
