// VoltXAmpere v2 — Tasarla modu grid iskeleti.
// Sprint 0.2: 5-bölgeli CSS Grid layout, tüm bölgeler placeholder.
// Sprint 0.3: canvas bölgesine <vxa-canvas> mount edildi; dashboard dahil
//             diğer 4 bölge hâlâ dashed-kenarlı placeholder.
// Sprint 0.4: dashboard artık canlı — engine bridge üzerinden RC low-pass'in
//             DC operating point'ini okuyup 3 slot (V_ÇIKIŞ / V_GİRİŞ / I(R1))
//             halinde gösteriyor. Topbar / sidebar / inspector hâlâ placeholder.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../canvas/canvas.ts';
import { solveCircuit, type SolveResult } from '../bridge/engine.ts';
import { RC_LOWPASS, RC_LOWPASS_LAYOUT } from '../circuits/rc-lowpass.ts';
import { formatVolt, formatAmp } from '../util/format.ts';

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'ok'; result: SolveResult }
  | { kind: 'err'; message: string };

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

    /* Placeholder bölge stili — kesikli kenar, mono etiket, sol-üst hizalama.
       Canvas ve dashboard bu class'ı KULLANMIYOR (Sprint 0.3-0.4'ten beri
       gerçek içerik). */
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

    /* Canvas bölgesi: placeholder değil — <vxa-canvas> tam olarak kaplar.
       .zone base class uygulanmıyor (Sprint 0.3). */
    .canvas-zone {
      grid-area: canvas-area;
      background: var(--canvas);
      overflow: hidden;
    }

    .zone.inspector {
      grid-area: inspector;
      background: var(--bg-1);
      border-left: 1px solid var(--line);
    }

    /* ─── Dashboard (Sprint 0.4) ──────────────────────────────────────────
       Canlı DC operating point verisi. .zone base class UYGULANMIYOR —
       dashed kenar + merkez-hizalı placeholder kuralları gerek yok artık. */
    .dashboard-zone {
      grid-area: dashboard;
      background: var(--bg-1);
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      overflow: hidden;
    }

    .slot {
      padding: var(--sp-3) var(--sp-4);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--sp-2);
      border-right: 1px solid var(--line);
    }
    .slot:last-child {
      border-right: 0;
    }

    .slot-title {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .slot-value {
      font-family: var(--sans);
      font-size: var(--fs-xl);
      font-weight: 500;
      color: var(--fg);
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }

    .slot-value--accent {
      color: var(--accent);
    }

    .slot-value--current {
      color: var(--current);
    }

    .slot-sub {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      letter-spacing: 0.05em;
      text-transform: lowercase;
    }

    /* Loading: grid iskelet ve renk duruyor, içerik boş — 3 slot kutusu
       sadece sınırlarıyla görünür. Plan "placeholder değer yok" diyor:
       tek bekleme göstergesi slot sınırlarıdır, sahte rakam yok. */
    .dashboard-zone--loading .slot {
      opacity: 0.35;
    }
    .slot-placeholder {
      /* Değer alanı boş kalsın ama yükseklik korunsun (layout zıplaması yok) */
      min-height: var(--fs-xl);
    }

    /* Hata durumu: tek merkez kutu, --err aksanı. */
    .dashboard-zone--error {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--sp-3) var(--sp-4);
    }

    .err-box {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--err);
      border-radius: var(--r-2);
      color: var(--fg);
      max-width: 520px;
    }

    .err-title {
      font-family: var(--mono);
      font-size: var(--fs-sm);
      color: var(--err);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .err-msg {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-2);
      word-break: break-word;
    }

    /* Sol alt köşe sprint etiketi — sabit, shadow DOM içinde position:fixed
       viewport'a göre konumlanır. Dashboard 140px yüksek olduğundan marker
       dashboard üstüne alındı (canvas zone'un sol-alt köşesi). İleride
       dev-mode-only toggle ile değişecek. */
    .dev-marker {
      position: fixed;
      left: var(--sp-3);
      bottom: calc(var(--grid-dashboard-h) + var(--sp-3));
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      letter-spacing: 0.12em;
      text-transform: lowercase;
      pointer-events: none;
      z-index: 2;
    }
  `;

  @state() private dashboard: DashboardState = { kind: 'loading' };

  override async firstUpdated(): Promise<void> {
    // Sprint 0.4: sayfa yüklenirken RC low-pass'in DC operating point'ini
    // solver worker'ına sorup state'e yazıyoruz. Hata durumunda dashboard
    // tek hata kutusu gösterir — sahte değer yok.
    try {
      const result = await solveCircuit(RC_LOWPASS);
      if (result.success) {
        this.dashboard = { kind: 'ok', result };
      } else {
        this.dashboard = {
          kind: 'err',
          message: result.errorMessage ?? 'Bilinmeyen hata',
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.dashboard = { kind: 'err', message: msg };
    }
  }

  private renderDashboard() {
    if (this.dashboard.kind === 'loading') {
      // Layout iskeleti hazır, değer alanı boş. Opacity azaltılmış.
      return html`
        <section class="dashboard-zone dashboard-zone--loading" aria-label="dashboard">
          <div class="slot">
            <span class="slot-title">V_ÇIKIŞ</span>
            <span class="slot-value slot-placeholder">${nothing}</span>
            <span class="slot-sub">DC operating point</span>
          </div>
          <div class="slot">
            <span class="slot-title">V_GİRİŞ</span>
            <span class="slot-value slot-placeholder">${nothing}</span>
            <span class="slot-sub">DC operating point</span>
          </div>
          <div class="slot">
            <span class="slot-title">I(R1)</span>
            <span class="slot-value slot-placeholder">${nothing}</span>
            <span class="slot-sub">DC operating point</span>
          </div>
        </section>
      `;
    }

    if (this.dashboard.kind === 'err') {
      return html`
        <section
          class="dashboard-zone dashboard-zone--error"
          aria-label="dashboard hata"
          role="alert"
        >
          <div class="err-box">
            <span class="err-title">⚠ Solver başlatılamadı</span>
            <span class="err-msg">${this.dashboard.message}</span>
          </div>
        </section>
      `;
    }

    const { nodeVoltages, branchCurrents } = this.dashboard.result;
    const vOut = nodeVoltages['out'] ?? 0;
    const vIn = nodeVoltages['in'] ?? 0;
    const iR1 = branchCurrents['R1'] ?? 0;

    return html`
      <section class="dashboard-zone" aria-label="dashboard">
        <div class="slot">
          <span class="slot-title">V_ÇIKIŞ</span>
          <span class="slot-value slot-value--accent">${formatVolt(vOut)}</span>
          <span class="slot-sub">DC operating point</span>
        </div>
        <div class="slot">
          <span class="slot-title">V_GİRİŞ</span>
          <span class="slot-value">${formatVolt(vIn)}</span>
          <span class="slot-sub">DC operating point</span>
        </div>
        <div class="slot">
          <span class="slot-title">I(R1)</span>
          <span class="slot-value slot-value--current">${formatAmp(iR1)}</span>
          <span class="slot-sub">DC operating point</span>
        </div>
      </section>
    `;
  }

  override render() {
    return html`
      <section class="zone topbar" aria-label="topbar">
        topbar · 54px · sprint 0.3'te toolbar
      </section>

      <section class="zone sidebar" aria-label="sidebar">
        sidebar · 96px · sprint 0.5'te bileşen kataloğu
      </section>

      <section class="canvas-zone" aria-label="canvas">
        <vxa-canvas
          .circuit=${RC_LOWPASS}
          .layout=${RC_LOWPASS_LAYOUT}
          .solve=${this.dashboard.kind === 'ok' ? this.dashboard.result : null}
        ></vxa-canvas>
      </section>

      <section class="zone inspector" aria-label="inspector">
        inspector · 216px · sprint 0.6'da bileşen özellikleri
      </section>

      ${this.renderDashboard()}

      <span class="dev-marker" aria-hidden="true"
        >sprint 0.5 · devre render + probe · v2</span
      >
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-design-mode': VxaDesignMode;
  }
}
