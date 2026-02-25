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
import { n1Rule } from "./rules/n1.js";
import { crossEndpointRule } from "./rules/cross-endpoint.js";
import { redundantQueryRule } from "./rules/redundant-query.js";
import { errorRule } from "./rules/error.js";
import { errorHotspotRule } from "./rules/error-hotspot.js";
import { duplicateRule } from "./rules/duplicate.js";
import { slowRule } from "./rules/slow.js";
import { queryHeavyRule } from "./rules/query-heavy.js";
import { selectStarRule } from "./rules/select-star.js";
import { highRowsRule } from "./rules/high-rows.js";
import { responseOverfetchRule } from "./rules/response-overfetch.js";
import { largeResponseRule } from "./rules/large-response.js";
import { regressionRule } from "./rules/regression.js";
import { securityRule } from "./rules/security.js";

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
