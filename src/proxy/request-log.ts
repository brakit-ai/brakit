export {
  RequestStore,
  type CaptureInput,
  flattenHeaders,
} from "../store/request-store.js";
export { isStaticPath } from "./static-patterns.js";

import { RequestStore } from "../store/request-store.js";
import type { CaptureInput } from "../store/request-store.js";
import type { TracedRequest, RequestListener } from "../types/index.js";

export const defaultStore = new RequestStore();

export const captureRequest = (input: CaptureInput): TracedRequest =>
  defaultStore.capture(input);
export const getRequests = (): readonly TracedRequest[] =>
  defaultStore.getAll();
export const clearRequests = (): void => defaultStore.clear();
export const onRequest = (fn: RequestListener): void =>
  defaultStore.onRequest(fn);
export const offRequest = (fn: RequestListener): void =>
  defaultStore.offRequest(fn);
