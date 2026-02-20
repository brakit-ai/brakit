import { AdapterRegistry } from "../adapter-registry.js";
import { pgAdapter } from "./pg.js";
import { mysql2Adapter } from "./mysql2.js";
import { prismaAdapter } from "./prisma.js";

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(pgAdapter);
  registry.register(mysql2Adapter);
  registry.register(prismaAdapter);
  return registry;
}

export { pgAdapter } from "./pg.js";
export { mysql2Adapter } from "./mysql2.js";
export { prismaAdapter } from "./prisma.js";
