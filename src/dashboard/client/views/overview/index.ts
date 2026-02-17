import { getOverviewInsights } from "./insights.js";
import { getOverviewRender } from "./render.js";

export function getOverviewView(): string {
  return getOverviewInsights() + getOverviewRender();
}
