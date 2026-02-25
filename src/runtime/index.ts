import { shouldActivate } from "./activate.js";

if (shouldActivate()) {
  try {
    const { setup } = await import("./setup.js");
    setup();
  } catch (err) {
    console.warn("brakit: failed to start —", (err as Error)?.message);
  }
}
