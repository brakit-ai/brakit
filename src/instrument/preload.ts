export {};

if (process.env.BRAKIT_PORT && process.env.BRAKIT_INSTRUMENT !== "0") {
  const { setupFetchHook } = await import("./hooks/fetch.js");
  const { setupConsoleHook } = await import("./hooks/console.js");
  const { setupErrorHook } = await import("./hooks/errors.js");
  const { setupHttpContextHook } = await import("./hooks/http-context.js");
  const { createDefaultRegistry } = await import("./adapters/index.js");
  const { send } = await import("./transport.js");

  setupHttpContextHook();
  setupFetchHook();
  setupConsoleHook();
  setupErrorHook();

  const registry = createDefaultRegistry();
  registry.patchAll((event) => send(event));
}
