import type { BrakitConfig } from "../../types.js";
import { getHelpers } from "./helpers.js";
import { getFlowsView } from "./views/flows.js";
import { getRequestsView } from "./views/requests.js";
import { getFetchesView } from "./views/fetches.js";
import { getErrorsView } from "./views/errors.js";
import { getLogsView } from "./views/logs.js";
import { getApp } from "./app.js";

export function getClientScript(config: BrakitConfig): string {
  return `
(function(){
  var PORT = ${config.proxyPort};
  var state = { flows: [], requests: [], fetches: [], errors: [], logs: [], viewMode: 'simple', activeView: 'actions' };

  var appEl = document.getElementById('app');
  var flowListEl = document.getElementById('flow-list');
  var reqListEl = document.getElementById('request-list');
  var emptyFlows = document.getElementById('empty-flows');
  var toastEl = document.getElementById('toast');

  ${getHelpers()}
  ${getFlowsView()}
  ${getRequestsView()}
  ${getFetchesView()}
  ${getErrorsView()}
  ${getLogsView()}
  ${getApp()}
})();
`;
}
