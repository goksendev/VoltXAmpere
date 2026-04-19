// VoltXAmpere v2 — Tasarla modu grid iskeleti.
// Sprint 0.2: 5-bölgeli CSS Grid layout.
// Sprint 0.3: canvas bölgesine <vxa-canvas> mount.
// Sprint 0.4: dashboard canlı — DC operating point (3 slot).
// Sprint 0.5: canvas'ta devre + probe etiketleri.
// Sprint 0.6: inspector canlı (seçili bileşen).
// Sprint 0.7: dashboard 220px yükseldi, üstte ZAMAN DOMAIN grafiği
//             (<vxa-transient-chart>), altta 3 slot (transient son örneği =
//             steady-state). DC çağrısı kaldırıldı — tek kaynak disiplini:
//             dashboard + inspector + canvas probe hepsi aynı transient
//             snapshot'ından besleniyor.
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../canvas/canvas.ts';
import '../inspector/inspector.ts';
import '../charts/transient-chart.ts';
import '../topbar/topbar.ts';
import type { ModeName } from '../topbar/topbar.ts';
import {
  solveTransient,
  type SolveResult,
  type TransientResult,
} from '../bridge/engine.ts';
import {
  RC_LOWPASS,
  RC_LOWPASS_LAYOUT,
  RC_TAU_SECONDS,
  RC_TRANSIENT_DT,
  RC_TRANSIENT_DURATION,
  RC_TRANSIENT_PROBE_NODES,
} from '../circuits/rc-lowpass.ts';
import {
  formatCurrent,
  formatTime,
  formatVoltage,
} from '../util/format.ts';
import { snapshotFromTransient } from '../util/snapshot.ts';
import { INITIAL_SELECTION, type Selection } from '../state/selection.ts';

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'ok'; transient: TransientResult; snapshot: SolveResult }
  | { kind: 'err'; message: string };

@customElement('vxa-design-mode')
export class VxaDesignMode extends LitElement {
  static override styles = css`
    :host {
      /* Hibrit grid: sidebar/inspector sabit px, canvas-area esnek.
         Topbar ve dashboard yükseklikleri sabit, canvas-area dikeyde de esner.
         Dashboard yüksekliği tokens.css'ten gelir — Sprint 0.7'de 220 px. */
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
       Canvas, dashboard ve inspector bu class'ı KULLANMIYOR. */
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

    /* Topbar bölgesi: placeholder değil — <vxa-topbar> tam kaplar (Sprint 0.8).
       .zone base class uygulanmıyor (dashed kenar + merkez hiza gerek yok). */
    .topbar-zone {
      grid-area: topbar;
      background: var(--bg-1);
      border-bottom: 1px solid var(--line);
      overflow: hidden;
      display: flex;
    }
    .topbar-zone > vxa-topbar {
      flex: 1 1 auto;
      min-width: 0;
    }

    .zone.sidebar {
      grid-area: sidebar;
      background: var(--bg-1);
      border-right: 1px solid var(--line);
    }

    /* Canvas bölgesi: placeholder değil — <vxa-canvas> tam olarak kaplar. */
    .canvas-zone {
      grid-area: canvas-area;
      background: var(--canvas);
      overflow: hidden;
    }

    /* Inspector bölgesi: <vxa-inspector> tam kaplar. */
    .inspector-zone {
      grid-area: inspector;
      background: var(--bg-1);
      border-left: 1px solid var(--line);
      overflow: hidden;
      display: flex;
    }
    .inspector-zone > vxa-inspector {
      flex: 1 1 auto;
      min-width: 0;
    }

    /* ─── Dashboard (Sprint 0.7 — transient + 3 slot) ─────────────────────
       3 satır: başlık (22px) + grafik (1fr) + slot row (60px).
       220 px toplam (tokens.css --grid-dashboard-h). */
    .dashboard-zone {
      grid-area: dashboard;
      background: var(--bg-1);
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-rows: 22px minmax(0, 1fr) 60px;
      overflow: hidden;
    }

    /* Üst başlık şeridi. CSS uppercase UYGULAMIYORUZ — µ karakteri Greek
       capital mu'ya (Μ) dönüşüp Latin "M" ile karışıyor ("µs" → "Μs" ≈ "Ms").
       Static kısmı şablonda elle büyük, dinamik birim kısmı aynen. */
    .dash-header {
      padding: 0 var(--sp-4);
      display: flex;
      align-items: center;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.16em;
      border-bottom: 1px solid var(--line);
      gap: var(--sp-2);
    }
    .dash-header .sep {
      color: var(--fg-4);
    }
    /* Dinamik birim (formatTime çıktısı) — letter-spacing biraz daha dar,
       rakamlar düzgün akar. */
    .dash-header .value {
      letter-spacing: 0.08em;
      color: var(--fg-2);
    }

    /* Grafik kabuğu — chart canvas buraya oturur. */
    .dash-chart {
      position: relative;
      padding: var(--sp-2) var(--sp-4);
      overflow: hidden;
    }
    .dash-chart > vxa-transient-chart {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* Alt slot satırı — Sprint 0.4'ün 3 slot'u korundu. */
    .dash-slots {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border-top: 1px solid var(--line);
    }

    .slot {
      padding: 0 var(--sp-4);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
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
      line-height: 1.1;
    }

    .slot-value--accent { color: var(--accent); }
    .slot-value--current { color: var(--current); }

    .slot-sub {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      letter-spacing: 0.05em;
      text-transform: lowercase;
    }

    .dashboard-zone--loading .slot {
      opacity: 0.35;
    }
    .slot-placeholder {
      min-height: var(--fs-xl);
    }

    /* Hata durumu: başlık + tek hata kutusu merkez hizalı. */
    .dashboard-zone--error {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--sp-3) var(--sp-4);
      grid-template-rows: none;
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

    /* Sol alt köşe sprint etiketi — dashboard üstünde. */
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

  // Sprint 0.6: selection state. Sprint 0.7'de canvas click event'i bu state'i
  // güncelleyecek.
  @state() private selection: Selection = INITIAL_SELECTION;

  // Sprint 0.8: mod switch state. Şu an sadece 'tasarla' aktif; Keşfet/Güç
  // shell'leri Faz 3+'da gelecek.
  @state() private activeMode: ModeName = 'tasarla';

  override async firstUpdated(): Promise<void> {
    // Sprint 0.7: tek çağrı ile transient al. Son örnek = DC steady-state
    // yerine geçiyor → inspector ve canvas probe'ları aynı snapshot'tan.
    try {
      const transient = await solveTransient({
        circuit: RC_LOWPASS,
        dt: RC_TRANSIENT_DT,
        duration: RC_TRANSIENT_DURATION,
        probeNodes: [...RC_TRANSIENT_PROBE_NODES],
      });
      if (transient.success) {
        const snapshot = snapshotFromTransient(transient, RC_LOWPASS, -1);
        this.dashboard = { kind: 'ok', transient, snapshot };
      } else {
        this.dashboard = {
          kind: 'err',
          message: transient.errorMessage ?? 'Bilinmeyen hata',
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.dashboard = { kind: 'err', message: msg };
    }
  }

  private renderDashboardHeader() {
    return html`
      <div class="dash-header" aria-label="zaman domain başlık">
        <span>ZAMAN DOMAIN</span>
        <span class="sep">·</span>
        <span class="value">0 → ${formatTime(RC_TRANSIENT_DURATION)}</span>
        <span class="sep">·</span>
        <span class="value">τ = ${formatTime(RC_TAU_SECONDS)}</span>
      </div>
    `;
  }

  private renderDashboard() {
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

    if (this.dashboard.kind === 'loading') {
      return html`
        <section class="dashboard-zone dashboard-zone--loading" aria-label="dashboard">
          ${this.renderDashboardHeader()}
          <div class="dash-chart" aria-hidden="true"></div>
          <div class="dash-slots">
            <div class="slot">
              <span class="slot-title">V_ÇIKIŞ @son</span>
              <span class="slot-value slot-placeholder">${nothing}</span>
              <span class="slot-sub">transient steady-state</span>
            </div>
            <div class="slot">
              <span class="slot-title">V_GİRİŞ @son</span>
              <span class="slot-value slot-placeholder">${nothing}</span>
              <span class="slot-sub">transient steady-state</span>
            </div>
            <div class="slot">
              <span class="slot-title">I(R1) @son</span>
              <span class="slot-value slot-placeholder">${nothing}</span>
              <span class="slot-sub">transient steady-state</span>
            </div>
          </div>
        </section>
      `;
    }

    // ok durumu: transient + snapshot hazır
    const { transient, snapshot } = this.dashboard;
    const vOut = snapshot.nodeVoltages['out'] ?? 0;
    const vIn = snapshot.nodeVoltages['in'] ?? 0;
    const iR1 = snapshot.branchCurrents['R1'] ?? 0;

    return html`
      <section class="dashboard-zone" aria-label="dashboard">
        ${this.renderDashboardHeader()}
        <div class="dash-chart">
          <vxa-transient-chart
            .data=${transient}
            probeNode="out"
            tone="accent"
          ></vxa-transient-chart>
        </div>
        <div class="dash-slots">
          <div class="slot">
            <span class="slot-title">V_ÇIKIŞ @son</span>
            <span class="slot-value slot-value--accent">${formatVoltage(vOut)}</span>
            <span class="slot-sub">transient steady-state</span>
          </div>
          <div class="slot">
            <span class="slot-title">V_GİRİŞ @son</span>
            <span class="slot-value">${formatVoltage(vIn)}</span>
            <span class="slot-sub">transient steady-state</span>
          </div>
          <div class="slot">
            <span class="slot-title">I(R1) @son</span>
            <span class="slot-value slot-value--current">${formatCurrent(iR1)}</span>
            <span class="slot-sub">transient steady-state</span>
          </div>
        </div>
      </section>
    `;
  }

  override render() {
    const solve = this.dashboard.kind === 'ok' ? this.dashboard.snapshot : null;
    return html`
      <section class="topbar-zone" aria-label="topbar">
        <vxa-topbar .activeMode=${this.activeMode}></vxa-topbar>
      </section>

      <section class="zone sidebar" aria-label="sidebar">
        sidebar · 96px · sprint 0.5'te bileşen kataloğu
      </section>

      <section class="canvas-zone" aria-label="canvas">
        <vxa-canvas
          .circuit=${RC_LOWPASS}
          .layout=${RC_LOWPASS_LAYOUT}
          .solve=${solve}
          .selectionId=${this.selection.type === 'component' ? this.selection.id : undefined}
        ></vxa-canvas>
      </section>

      <section class="inspector-zone" aria-label="inspector">
        <vxa-inspector
          .selection=${this.selection}
          .circuit=${RC_LOWPASS}
          .layout=${RC_LOWPASS_LAYOUT}
          .solveResult=${solve}
        ></vxa-inspector>
      </section>

      ${this.renderDashboard()}

      <span class="dev-marker" aria-hidden="true"
        >sprint 0.8 · topbar · v2</span
      >
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-design-mode': VxaDesignMode;
  }
}
