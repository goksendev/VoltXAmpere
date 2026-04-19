// VoltXAmpere v2 — Tasarla modu grid iskeleti (Sprint 0.2).
// 5-bölgeli CSS Grid layout: topbar / sidebar / canvas-area / inspector / dashboard.
// İçerik yok — her bölge yalnızca placeholder etiketi ve kesikli kenar gösterir.
// Canvas 2D context, toolbar, bileşen kataloğu, inspector formları, dashboard
// grafikleri sonraki sprintlere ait.
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('vxa-design-mode')
export class VxaDesignMode extends LitElement {
  static override styles = css`
    :host {
      /* Hibrit grid: sidebar/inspector sabit px, canvas-area esnek.
         Topbar ve dashboard yükseklikleri sabit, canvas-area dikeyde de esner. */
      display: grid;
      grid-template-columns:
        var(--grid-sidebar-w)
        minmax(0, 1fr)
        var(--grid-inspector-w);
      grid-template-rows:
        var(--grid-topbar-h)
        minmax(0, 1fr)
        var(--grid-dashboard-h);
      grid-template-areas:
        'topbar    topbar         topbar'
        'sidebar   canvas-area    inspector'
        'dashboard dashboard      dashboard';
      height: 100vh;
      width: 100vw;
      background: var(--bg-0);
      color: var(--fg);
      overflow: hidden;
    }

    /* Ortak placeholder bölge stili — kesikli kenar, mono etiket, hizalama. */
    .zone {
      border: 1px dashed var(--line-str);
      padding: var(--sp-3);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      overflow: hidden;
    }

    .zone.topbar {
      grid-area: topbar;
      background: var(--bg-1);
      border-bottom: 1px solid var(--line);
    }

    .zone.sidebar {
      grid-area: sidebar;
      background: var(--bg-1);
      border-right: 1px solid var(--line);
    }

    .zone.canvas {
      grid-area: canvas-area;
      background: var(--canvas);
      /* Canvas etiketi ortada dursun. */
      align-items: center;
      justify-content: center;
    }

    .zone.inspector {
      grid-area: inspector;
      background: var(--bg-1);
      border-left: 1px solid var(--line);
    }

    .zone.dashboard {
      grid-area: dashboard;
      background: var(--bg-1);
      border-top: 1px solid var(--line);
    }

    /* Canvas bölgesinde ortada büyük başlık + altında küçük açıklama. */
    .canvas-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .canvas-title {
      margin: 0;
      font-family: var(--mono);
      font-size: var(--fs-lg);
      color: var(--fg-2);
    }

    .canvas-sub {
      margin: 0;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
    }

    /* Sol alt köşe sprint etiketi — sabit, shadow DOM içinde position:fixed
       viewport'a göre konumlanır. İleride dev-mode-only toggle ile değişecek. */
    .dev-marker {
      position: fixed;
      left: var(--sp-3);
      bottom: var(--sp-3);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      letter-spacing: 0.12em;
      text-transform: lowercase;
      pointer-events: none;
      z-index: 2;
    }
  `;

  override render() {
    return html`
      <section class="zone topbar" aria-label="topbar">
        topbar · 54px · sprint 0.3'te toolbar
      </section>

      <section class="zone sidebar" aria-label="sidebar">
        sidebar · 96px · sprint 0.5'te bileşen kataloğu
      </section>

      <section class="zone canvas" aria-label="canvas">
        <div class="canvas-label">
          <p class="canvas-title">canvas-area</p>
          <p class="canvas-sub">
            sprint 0.3'te canvas 2d + sprint 0.4'te backend
          </p>
        </div>
      </section>

      <section class="zone inspector" aria-label="inspector">
        inspector · 216px · sprint 0.6'da bileşen özellikleri
      </section>

      <section class="zone dashboard" aria-label="dashboard">
        dashboard · 140px · sprint 0.7'de analiz defteri
      </section>

      <span class="dev-marker" aria-hidden="true"
        >sprint 0.2 · tasarla grid iskelet · v2</span
      >
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-design-mode': VxaDesignMode;
  }
}
