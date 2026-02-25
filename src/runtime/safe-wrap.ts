import { health } from "./health.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;
type AsyncFn = (...args: any[]) => Promise<any>;

/**
 * Wrap a synchronous function so brakit failures never prevent the original
 * from executing.  If the wrapper throws, the original is called directly.
 */
export function safeWrap<T extends AnyFn>(
  original: T,
  wrapper: (this: ThisParameterType<T>, original: T, ...args: Parameters<T>) => ReturnType<T>,
): T {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    if (!health.isActive()) return original.apply(this, args);
    try {
      return wrapper.call(this, original, ...args);
    } catch {
      health.reportError();
      return original.apply(this, args);
    }
  } as unknown as T;
}

/**
 * Async variant — catches both synchronous throws and rejected promises.
 */
export function safeWrapAsync<T extends AsyncFn>(
  original: T,
  wrapper: (this: ThisParameterType<T>, original: T, ...args: Parameters<T>) => Promise<ReturnType<T>>,
): T {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): Promise<ReturnType<T>> {
    if (!health.isActive()) return original.apply(this, args);
    try {
      const result = wrapper.call(this, original, ...args);
      return result.catch(() => {
        health.reportError();
        return original.apply(this, args);
      });
    } catch {
      health.reportError();
      return original.apply(this, args);
    }
  } as unknown as T;
}
