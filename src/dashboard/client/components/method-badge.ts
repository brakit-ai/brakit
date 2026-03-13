import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bk-method-badge")
export class MethodBadge extends LitElement {
  @property() method = "";

  createRenderRoot() { return this; }

  render() {
    const m = this.method.toUpperCase();
    return html`<span class="method-badge method-badge-${m}">${m}</span>`;
  }
}
