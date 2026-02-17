export {};

if (process.env.BRAKIT_PORT && process.env.BRAKIT_INSTRUMENT !== "0") {
  const { setupFetchHook } = await import("./hooks/fetch.js");
  const { setupConsoleHook } = await import("./hooks/console.js");
  const { setupErrorHook } = await import("./hooks/errors.js");
  const { setupHttpContextHook } = await import("./hooks/http-context.js");
  const { setupDbHook } = await import("./hooks/db.js");

  setupHttpContextHook();
  setupFetchHook();
  setupConsoleHook();
  setupErrorHook();
  setupDbHook();
}
