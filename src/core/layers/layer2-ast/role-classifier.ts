import { extname } from "node:path";
import picomatch from "picomatch";
import type { FileRole, ASTSummary } from "../../types/analysis.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import type { FileRoleContext } from "../../plugin/types.js";

export interface ClassificationResult {
  roles: FileRole[];
  classifiedBy: string[];
}

export function classifyFile(
  filePath: string,
  relativePath: string,
  contents: string,
  ast: ASTSummary,
  registry: ResolvedRegistry,
): ClassificationResult {
  const roles: FileRole[] = [];
  const classifiedBy: string[] = [];

  const ctx: FileRoleContext = {
    filePath,
    relativePath,
    contents,
    extension: extname(filePath),
    ast,
  };

  for (const [qualifiedId, rule] of registry.fileRoles) {
    if (!picomatch.isMatch(relativePath, rule.fileGlob)) continue;

    const detected = rule.classify(ctx);
    if (detected.length > 0) {
      roles.push(...detected);
      classifiedBy.push(qualifiedId);
    }
  }

  return {
    roles: [...new Set(roles)],
    classifiedBy,
  };
}
