export interface Disposable {
  dispose(): void;
}

export class SubscriptionBag implements Disposable {
  private items: Disposable[] = [];

  add(teardown: (() => void) | Disposable): void {
    this.items.push(typeof teardown === "function" ? { dispose: teardown } : teardown);
  }

  dispose(): void {
    for (const d of this.items) d.dispose();
    this.items.length = 0;
  }
}
