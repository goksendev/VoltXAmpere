// VoltXAmpere v2 — kök bileşen.
// Sprint 0.2 itibarıyla doğrudan Tasarla modu grid iskeletini render eder.
// Sprint 0.1'deki "iskelet ayakta" kanıt sayfası kaldırıldı.
// İleride mod switcher (Tasarla / Keşfet / Güç) buradan yönetilecek.
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './modes/design-mode.ts';

@customElement('vxa-app-root')
export class VxaAppRoot extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      background: var(--bg-0);
      color: var(--fg);
      font-family: var(--sans);
    }
  `;

  override render() {
    return html`<vxa-design-mode></vxa-design-mode>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-app-root': VxaAppRoot;
  }
}
