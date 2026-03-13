import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { CLIENT_TOAST_DURATION_MS } from "../constants.js";

@customElement("bk-toast")
export class Toast extends LitElement {
  @state() message = "";
  @state() visible = false;

  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  createRenderRoot() { return this; }

  static show(msg: string) {
    const el = document.querySelector<Toast>("bk-toast");
    if (el) el.showMessage(msg);
  }

  showMessage(msg: string) {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.message = msg;
    this.visible = true;
    this.hideTimer = setTimeout(() => {
      this.visible = false;
    }, CLIENT_TOAST_DURATION_MS);
  }

  render() {
    return html`<div class="toast ${this.visible ? "show" : ""}">${this.message}</div>`;
  }
}
