import { getBaseStyles } from "./styles/base.js";
import { getLayoutStyles } from "./styles/layout.js";
import { getFlowStyles } from "./styles/flows.js";
import { getRequestStyles } from "./styles/requests.js";
import { getPerformanceStyles } from "./styles/performance.js";

export function getStyles(): string {
  return (
    getBaseStyles() +
    getLayoutStyles() +
    getFlowStyles() +
    getRequestStyles() +
    getPerformanceStyles()
  );
}
