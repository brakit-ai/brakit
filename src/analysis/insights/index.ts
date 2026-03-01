export type { InsightRule } from "./rule.js";
export type {
  Insight,
  InsightSeverity,
  InsightType,
  InsightContext,
  EndpointGroup,
  PreparedInsightContext,
} from "./types.js";
export { InsightRunner } from "./runner.js";

import type { InsightContext, Insight } from "./types.js";
import { InsightRunner } from "./runner.js";
import {
  n1Rule,
  crossEndpointRule,
  redundantQueryRule,
  errorRule,
  errorHotspotRule,
  duplicateRule,
  slowRule,
  queryHeavyRule,
  selectStarRule,
  highRowsRule,
  responseOverfetchRule,
  largeResponseRule,
  regressionRule,
  securityRule,
} from "./rules/index.js";

export function createDefaultInsightRunner(): InsightRunner {
  const runner = new InsightRunner();
  runner.register(n1Rule);
  runner.register(crossEndpointRule);
  runner.register(redundantQueryRule);
  runner.register(errorRule);
  runner.register(errorHotspotRule);
  runner.register(duplicateRule);
  runner.register(slowRule);
  runner.register(queryHeavyRule);
  runner.register(selectStarRule);
  runner.register(highRowsRule);
  runner.register(responseOverfetchRule);
  runner.register(largeResponseRule);
  runner.register(regressionRule);
  runner.register(securityRule);
  return runner;
}

export function computeInsights(ctx: InsightContext): Insight[] {
  return createDefaultInsightRunner().run(ctx);
}
