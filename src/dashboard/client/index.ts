import type { BrakitConfig } from "../../types/index.js";
import { getHelpers } from "./helpers.js";
import { getTelemetryViewHelpers } from "./view-helpers.js";
import { getFlowsView } from "./views/flows.js";
import { getRequestsView } from "./views/requests.js";
import { getFetchesView } from "./views/fetches.js";
import { getErrorsView } from "./views/errors.js";
import { getLogsView } from "./views/logs.js";
import { getQueriesView } from "./views/queries.js";
import { getGraphView } from "./views/graph.js";
import { getOverviewView } from "./views/overview/index.js";
import { getSecurityRules } from "./rules/index.js";
import { getSecurityView } from "./views/security.js";
import { getApp } from "./app.js";

export function getClientScript(config: BrakitConfig): string {
  return `
(function(){
  var PORT = ${config.proxyPort};
  var state = { flows: [], requests: [], fetches: [], errors: [], logs: [], queries: [], viewMode: 'simple', activeView: 'overview' };

  var appEl = document.getElementById('app');
  var flowListEl = document.getElementById('flow-list');
  var reqListEl = document.getElementById('request-list');
  var emptyFlows = document.getElementById('empty-flows');
  var toastEl = document.getElementById('toast');

  ${getHelpers()}
  ${getTelemetryViewHelpers()}
  ${getFlowsView()}
  ${getRequestsView()}
  ${getFetchesView()}
  ${getErrorsView()}
  ${getLogsView()}
  ${getQueriesView()}
  ${getGraphView()}
  ${getSecurityRules()}
  ${getOverviewView()}
  ${getSecurityView()}
  ${getApp()}
})();
`;
}
