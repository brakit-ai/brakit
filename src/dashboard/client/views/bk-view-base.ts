/**
 * Base class for all dashboard view components.
 * Handles store subscription lifecycle and shadow DOM opt-out.
 */

import { LitElement } from "lit";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";

export abstract class BkViewBase extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  private handleStateChanged = () => this.requestUpdate();

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", this.handleStateChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.store.removeEventListener("state-changed", this.handleStateChanged);
  }
}
