// VoltXAmpere v2 — <vxa-transient-chart> (Sprint 0.7).
//
// Küçük bir canvas ile bir düğümün voltaj-zaman eğrisini çizer. Sprint 0.3'teki
// <vxa-canvas> pattern'ini izliyor: ResizeObserver + DPI scaling + rAF-batched
// redraw. Pure render — state tutmuyor, prop'tan gelen data'yı çiziyor.
//
// Çizim akışı:
//   1) Arka plan şeffaf (parent zone rengi baskın)
//   2) Hafif grid (her 10 µs X, 1 V Y) — --chart-grid rengi
//   3) Eğri — glow pass (lineWidth 4, alpha 0.4) + normal pass (lineWidth 1.6)
//
// Glow için ctx.filter = 'blur' pahalı; iki stroke pass daha ucuz + doğru.
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import type { TransientResult } from '../bridge/engine.ts';

// Çizim sabitleri ──────────────────────────────────────────────────────────
// X-ekseni grid adımı (saniye). RC τ = 10 µs olduğu için 10 µs işareti doğal.
const X_GRID_STEP_S = 10e-6;
// Y-ekseni grid adımı (volt). 5V kaynak için 1 V doğal adım.
const Y_GRID_STEP_V = 1;
// Eğri padding — canvas kenarından içeri.
const PAD_X = 10;
const PAD_Y = 8;
// Stroke sabitleri.
const GLOW_STROKE = 4;
const CURVE_STROKE = 1.6;
const GLOW_ALPHA = 0.4;
const GRID_STROKE = 0.5;

export type TransientChartTone = 'accent' | 'current' | 'fg';

@customElement('vxa-transient-chart')
export class VxaTransientChart extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      letter-spacing: 0.1em;
      text-transform: lowercase;
      pointer-events: none;
    }
  `;

  @property({ attribute: false }) data?: TransientResult | null;
  @property() probeNode = 'out';
  @property() tone: TransientChartTone = 'accent';

  private readonly canvasRef: Ref<HTMLCanvasElement> = createRef();
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle: number | null = null;

  override firstUpdated(): void {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    this.resizeObserver = new ResizeObserver(() => this.scheduleDraw());
    this.resizeObserver.observe(this);
    this.scheduleDraw();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('data') || changed.has('probeNode') || changed.has('tone')) {
      this.scheduleDraw();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private scheduleDraw(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.draw();
    });
  }

  private draw(): void {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPI scaling — Sprint 0.3'teki aynı strateji.
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // Veri yoksa grid bile çizme — parent "empty" divini gösteriyor.
    if (!this.data || !this.data.success) return;
    const times = this.data.time;
    const values = this.data.nodeVoltages[this.probeNode];
    if (!values || times.length === 0) return;

    // Eksen min/max — zaman 0→duration, voltaj otomatik (min/max serisinden).
    // Eğri üst/alt kenara oturmasın diye küçük pad ekliyoruz.
    const tMax = times[times.length - 1] ?? 0;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    if (!isFinite(vMin) || !isFinite(vMax)) return;
    // Düz eğri (tek voltaj) görünsün diye ±0.5 V genişlet.
    if (vMax - vMin < 1e-6) {
      vMin -= 0.5;
      vMax += 0.5;
    }

    const innerW = cssW - 2 * PAD_X;
    const innerH = cssH - 2 * PAD_Y;
    const xOf = (t: number): number => PAD_X + (t / tMax) * innerW;
    const yOf = (v: number): number =>
      PAD_Y + (1 - (v - vMin) / (vMax - vMin)) * innerH;

    // ─── Grid ──────────────────────────────────────────────────────────────
    const styles = getComputedStyle(this);
    const gridColor = styles.getPropertyValue('--chart-grid').trim() || 'rgba(200,210,230,0.08)';

    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = GRID_STROKE;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    // X grid: her 10 µs
    for (let t = 0; t <= tMax + 1e-12; t += X_GRID_STEP_S) {
      const x = Math.round(xOf(t)) + 0.5; // +0.5 tam piksel keskinliği
      ctx.moveTo(x, PAD_Y);
      ctx.lineTo(x, cssH - PAD_Y);
    }
    // Y grid: her 1 V (min/max aralığında)
    const gMin = Math.ceil(vMin / Y_GRID_STEP_V) * Y_GRID_STEP_V;
    const gMax = Math.floor(vMax / Y_GRID_STEP_V) * Y_GRID_STEP_V;
    for (let v = gMin; v <= gMax + 1e-9; v += Y_GRID_STEP_V) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.moveTo(PAD_X, y);
      ctx.lineTo(cssW - PAD_X, y);
    }
    ctx.stroke();
    ctx.restore();

    // ─── Eğri ──────────────────────────────────────────────────────────────
    const toneVar =
      this.tone === 'current' ? '--current'
      : this.tone === 'fg' ? '--fg'
      : '--accent';
    const curveColor = styles.getPropertyValue(toneVar).trim() || '#FFB84D';

    ctx.strokeStyle = curveColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Path tek defa kurulsun, iki kere stroke'lansın.
    ctx.beginPath();
    ctx.moveTo(xOf(times[0]!), yOf(values[0]!));
    for (let i = 1; i < times.length; i++) {
      ctx.lineTo(xOf(times[i]!), yOf(values[i]!));
    }

    // Glow pass — geniş + şeffaf
    ctx.globalAlpha = GLOW_ALPHA;
    ctx.lineWidth = GLOW_STROKE;
    ctx.stroke();

    // Normal pass — ince + opak
    ctx.globalAlpha = 1;
    ctx.lineWidth = CURVE_STROKE;
    ctx.stroke();
  }

  override render() {
    const hasData =
      this.data?.success === true &&
      !!this.data.nodeVoltages[this.probeNode] &&
      this.data.time.length > 0;
    return html`
      <canvas ${ref(this.canvasRef)} aria-label="transient grafik"></canvas>
      ${hasData
        ? ''
        : html`<div class="empty" aria-hidden="true">veri bekleniyor</div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-transient-chart': VxaTransientChart;
  }
}
