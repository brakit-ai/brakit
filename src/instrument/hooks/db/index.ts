import { patchPg } from "./pg.js";
import { patchMysql2 } from "./mysql.js";
import { patchPrisma } from "./prisma.js";

export function setupDbHook(): void {
  try { patchPg(); } catch { /* driver not installed or API changed */ }
  try { patchMysql2(); } catch { /* driver not installed or API changed */ }
  try { patchPrisma(); } catch { /* driver not installed or API changed */ }
}
