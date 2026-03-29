import { getBaseStyles } from "./styles/base.js";
import { getLayoutStyles } from "./styles/layout.js";
import { getFlowStyles } from "./styles/flows.js";
import { getRequestStyles } from "./styles/requests.js";
import { getPerformanceStyles } from "./styles/graph.js";
import { getOverviewStyles } from "./styles/overview.js";
import { getSecurityStyles } from "./styles/security.js";
import { getTimelineStyles } from "./styles/timeline.js";
import { getGraphViewStyles } from "./styles/graph-view.js";
import { getExplorerStyles } from "./styles/explorer.js";
import { getInsightsStyles } from "./styles/insights.js";

export function getStyles(): string {
  return (
    getBaseStyles() +
    getLayoutStyles() +
    getFlowStyles() +
    getRequestStyles() +
    getPerformanceStyles() +
    getOverviewStyles() +
    getSecurityStyles() +
    getTimelineStyles() +
    getGraphViewStyles() +
    getExplorerStyles() +
    getInsightsStyles()
  );
}
