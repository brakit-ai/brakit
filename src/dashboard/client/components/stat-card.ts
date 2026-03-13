import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bk-stat-card")
export class StatCard extends LitElement {
  @property() value = "";
  @property() label = "";
  @property() color = "";

  createRenderRoot() { return this; }

  render() {
    return html`
      <div class="fetch-stat">
        <span class="fetch-stat-value" style="color:${this.color}">${this.value}</span>
        <span class="fetch-stat-label">${this.label}</span>
      </div>
    `;
  }
}
