import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { statusPillClass } from "../utils/format.js";

@customElement("bk-status-pill")
export class StatusPill extends LitElement {
  @property({ type: Number }) code = 0;

  createRenderRoot() { return this; }

  render() {
    const cls = statusPillClass(this.code);
    return html`<span class="status-pill ${cls}">${this.code}</span>`;
  }
}
