import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bk-empty-state")
export class EmptyState extends LitElement {
  @property() title = "";
  @property() subtitle = "";

  createRenderRoot() { return this; }

  render() {
    return html`
      <div class="empty">
        <span class="empty-title">${this.title}</span>
        <span class="empty-sub">${this.subtitle}</span>
      </div>
    `;
  }
}
