import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { formatDuration } from "../utils/format.js";

@customElement("bk-duration-label")
export class DurationLabel extends LitElement {
  @property({ type: Number }) ms = 0;

  createRenderRoot() { return this; }

  render() {
    return html`<span class="req-duration">${formatDuration(this.ms)}</span>`;
  }
}
