import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  url: string;
  method: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithContext(
  url: string,
  method: string,
  fn: () => void,
): void {
  storage.run({ requestId: randomUUID(), url, method }, fn);
}

export { storage as requestContextStorage };
