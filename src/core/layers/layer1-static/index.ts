import type { Layer1Result, Layer2Result } from "../../pipeline/types.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import { runPatterns } from "./pattern-runner.js";
import { deduplicateFindings } from "./deduplicator.js";

export function runLayer1(
  layer2Result: Layer2Result,
  registry: ResolvedRegistry,
): Layer1Result {
  const findings = runPatterns(layer2Result, registry);
  const deduped = deduplicateFindings(findings);

  return {
    ...layer2Result,
    findings: deduped,
  };
}
