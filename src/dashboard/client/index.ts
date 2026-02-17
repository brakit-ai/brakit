import type { BrakitConfig } from "../../types.js";
import { getHelpers } from "./helpers.js";
import { getFlowsView } from "./views/flows.js";
import { getRequestsView } from "./views/requests.js";
import { getApp } from "./app.js";

export function getClientScript(config: BrakitConfig): string {
  return `
(function(){
  var PORT = ${config.proxyPort};
  var state = { flows: [], requests: [], viewMode: 'simple', activeView: 'actions' };

  var appEl = document.getElementById('app');
  var flowListEl = document.getElementById('flow-list');
  var reqListEl = document.getElementById('request-list');
  var emptyFlows = document.getElementById('empty-flows');
  var toastEl = document.getElementById('toast');

  ${getHelpers()}
  ${getFlowsView()}
  ${getRequestsView()}
  ${getApp()}
})();
`;
}
