/** File extensions recognized as source files during uninstall scanning. */
export const SUPPORTED_SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts",
]);

/**
 * Framework build cache directories cleared during uninstall to remove
 * stale brakit references that would cause recompilation errors.
 */
export const BUILD_CACHE_DIRS = [".next", ".nuxt", ".output"] as const;

/** Directories scanned as a fallback when no known instrumentation files are found. */
export const FALLBACK_SCAN_DIRS = ["src", "."] as const;
