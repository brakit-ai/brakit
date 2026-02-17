// Preload module — loaded via --import flag and NODE_OPTIONS.
// Activates in any process that has BRAKIT_PORT set.
export {};

if (process.env.BRAKIT_PORT && process.env.BRAKIT_INSTRUMENT !== "0") {
  const { setupFetchHook } = await import("./hooks/fetch.js");
  const { setupConsoleHook } = await import("./hooks/console.js");
  const { setupErrorHook } = await import("./hooks/errors.js");
  const { setupHttpContextHook } = await import("./hooks/http-context.js");

  setupHttpContextHook();
  setupFetchHook();
  setupConsoleHook();
  setupErrorHook();
}
