import type {
  BrakitPlugin,
  FileRoleRule,
  AnalysisPattern,
  CompoundRule,
  ScoringContribution,
} from "./types.js";

export interface ResolvedRegistry {
  plugins: ReadonlyMap<string, BrakitPlugin>;
  fileRoles: ReadonlyMap<string, FileRoleRule>;
  patterns: ReadonlyMap<string, AnalysisPattern>;
  compoundRules: ReadonlyMap<string, CompoundRule>;
  scoring: ReadonlyMap<string, ScoringContribution>;
  warnings: readonly string[];
}

export class RegistryBuilder {
  private plugins = new Map<string, BrakitPlugin>();

  addPlugin(plugin: BrakitPlugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Duplicate plugin: "${plugin.name}"`);
    }
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  resolve(): ResolvedRegistry {
    const fileRoles = new Map<string, FileRoleRule>();
    const patterns = new Map<string, AnalysisPattern>();
    const compoundRules = new Map<string, CompoundRule>();
    const scoring = new Map<string, ScoringContribution>();
    const warnings: string[] = [];

    // First pass: collect all capabilities except compound rules.
    for (const [name, plugin] of this.plugins) {
      if (plugin.fileRoles) {
        for (const [id, rule] of Object.entries(plugin.fileRoles)) {
          fileRoles.set(`${name}:${id}`, rule);
        }
      }
      if (plugin.patterns) {
        for (const [id, pattern] of Object.entries(plugin.patterns)) {
          patterns.set(`${name}:${id}`, pattern);
        }
      }
      if (plugin.scoring) {
        scoring.set(name, plugin.scoring);
      }
    }

    // Second pass: validate compound rules against the full pattern set.
    for (const [name, plugin] of this.plugins) {
      if (!plugin.compoundRules) continue;
      for (const [id, rule] of Object.entries(plugin.compoundRules)) {
        const qualifiedId = `${name}:${id}`;
        const missing = rule.requires.filter((req) => !patterns.has(req));
        if (missing.length > 0) {
          warnings.push(
            `Compound rule "${qualifiedId}" skipped: requires [${missing.join(", ")}]`,
          );
          continue;
        }
        compoundRules.set(qualifiedId, rule);
      }
    }

    return {
      plugins: new Map(this.plugins),
      fileRoles,
      patterns,
      compoundRules,
      scoring,
      warnings,
    };
  }
}
