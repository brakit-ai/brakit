import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Toast } from "./toast.js";

@customElement("bk-copy-button")
export class CopyButton extends LitElement {
  @property() text = "";
  @property() label = "Copy";
  @property({ attribute: "toast-message" }) toastMessage = "Copied";

  createRenderRoot() { return this; }

  private async copy(e: Event) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(this.text);
      Toast.show(this.toastMessage);
    } catch {
      // clipboard API may not be available
    }
  }

  render() {
    return html`<button class="query-detail-copy" @click=${this.copy}>${this.label}</button>`;
  }
}
