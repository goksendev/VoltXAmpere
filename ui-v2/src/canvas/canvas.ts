// VoltXAmpere v2 — <vxa-canvas> (Sprint 0.3 + 0.5).
//
// Sprint 0.3: Canvas 2D mount, DPI scaling, ResizeObserver, statik noktalı grid.
// Sprint 0.5: prop tabanlı devre render. circuit + layout + solve prop olarak
//             gelir, pure render — component state tutmuyor.
//
// İki katmanlı çizim:
//   1. Arka: noktalı grid (her zaman)
//   2. Ön:   devre (circuit/layout/solve prop'ları verilmişse)
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import type { CircuitDef, SolveResult } from '../bridge/engine.ts';
import { readColors } from '../render/helpers.ts';
import {
  drawCircuit,
  type CircuitLayout,
} from '../render/circuit-renderer.ts';
import {
  componentAABB,
  mouseToCanvasCoords,
  pointInAABB,
} from '../interaction/hit-test.ts';
import {
  COMPONENT_BOUNDS,
  DEFAULT_BOUNDS,
} from '../interaction/component-bounds.ts';
import './canvas-chrome.ts';

// ─── Grid sabitleri ──────────────────────────────────────────────────────────
// Küçük grid adımı: 16 CSS piksel. Devre bacakları ve wire snap için ideal bir
// denge — 8px fazla yoğun (görsel gürültü), 20px fazla seyrek (hassasiyet kaybı).
const MINOR_STEP = 16;

// Büyük grid adımı: her 5 küçük grid'de bir majör nokta (efektif 5 × 16 = 80 CSS
// piksel aralık). Göz tarama sırasında "burası neresi" referans noktası veriyor.
// Sabit 80'i ayrıca tanımlamıyoruz çünkü MINOR_STEP × MAJOR_STEP_RATIO yeterli —
// aynı değerin iki kaynağı divergence riskidir.
const MAJOR_STEP_RATIO = 5;

// Nokta boyutları (CSS piksel).
// Küçük: 1px tam piksel → keskin doldurulur (fillRect 1x1, integer koordinat).
// Büyük: 1.4px → minör ile açık ayırt edilecek kadar iri ama "blok" olmayan
// yumuşak anti-aliased nokta. 2px yapmak kocaman görünüyor.
const MINOR_DOT = 1;
const MAJOR_DOT = 1.4;

@customElement('vxa-canvas')
export class VxaCanvas extends LitElement {
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
    /* Sprint 0.9: .debug-label kaldırıldı. DPI scaling Sprint 0.3 doğrulamasıyla
       güvence altında — göz önünde durmasına gerek yok. */
  `;

  // ─── Props (Sprint 0.5 + 0.6) ────────────────────────────────────────────
  // attribute: false — HTML attribute olarak deserialize edilmesin, complex obj.
  @property({ attribute: false }) circuit?: CircuitDef;
  @property({ attribute: false }) layout?: CircuitLayout;
  @property({ attribute: false }) solve?: SolveResult | null;
  /** Seçili bileşenin id'si (Sprint 0.6). Canvas bu prop'a göre o bileşeni
   * --accent renginde çizer ve etrafına dashed frame ekler. Sprint 0.7'de
   * canvas click event'i bu prop'u güncelleyecek. */
  @property({ attribute: false }) selectionId?: string;

  // ─── Chrome prop'ları (Sprint 0.10) ────────────────────────────────────
  // <vxa-canvas-chrome>'a pass-through; canvas draw'ını etkilemez.
  @property() chromeTitle = 'DENEY';
  @property() chromeSubtitle = '';
  @property({ type: Boolean }) isPlaying = false;
  @property() simTime = '—';
  @property({ type: Number }) zoom = 100;

  // ─── Internal ───────────────────────────────────────────────────────────
  private readonly canvasRef: Ref<HTMLCanvasElement> = createRef();
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle: number | null = null;

  // Sprint 1.1: hover state canvas içinde. Kalıcı state değil — mouseleave
  // temizler. Selection ise design-mode'da (prop olarak geri iner).
  @state() private hoveredId: string | null = null;

  override firstUpdated(): void {
    const canvas = this.canvasRef.value;
    if (!canvas) throw new Error('vxa-canvas: canvas referansı alınamadı');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('vxa-canvas: Canvas 2D context alınamadı');

    this.resizeObserver = new ResizeObserver(() => this.scheduleDraw());
    this.resizeObserver.observe(this);

    // Sprint 1.1: mouse event'leri. Canvas element'e bağlıyoruz — shadow DOM
    // içinde olduğundan design-mode listener bubbles+composed ile yakalıyor.
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('click', this.onClick);

    this.scheduleDraw();
  }

  override updated(changed: Map<string, unknown>): void {
    // Sprint 0.5: prop değişiminde yeniden çiz. Resize gibi scheduleDraw ile
    // rAF içinde tek frame'e batch'lenir. Lit zaten render olduğu için burada
    // sadece canvas repaint tetiklenir.
    if (
      changed.has('circuit') ||
      changed.has('layout') ||
      changed.has('solve') ||
      changed.has('selectionId') ||
      changed.has('hoveredId')
    ) {
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
    const canvas = this.canvasRef.value;
    if (canvas) {
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('mouseleave', this.onMouseLeave);
      canvas.removeEventListener('click', this.onClick);
    }
  }

  // ─── Sprint 1.1: hit testing + mouse handler'ları ──────────────────────

  /** Canvas mouse koordinatından hangi bileşenin (varsa) altında olduğunu bul.
   * Ters sırada (son çizilen önce) — ileride overlap'te üstteki kazanır. */
  private hitTest(px: number, py: number): string | null {
    if (!this.circuit || !this.layout) return null;
    const canvas = this.canvasRef.value;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    for (let i = this.layout.components.length - 1; i >= 0; i--) {
      const comp = this.layout.components[i];
      if (!comp) continue;
      const circuitComp = this.circuit.components.find((c) => c.id === comp.id);
      if (!circuitComp) continue;

      const bounds = COMPONENT_BOUNDS[circuitComp.type] ?? DEFAULT_BOUNDS;
      const aabb = componentAABB(
        centerX,
        centerY,
        comp,
        bounds.halfWidth,
        bounds.halfHeight,
      );
      if (pointInAABB(px, py, aabb)) {
        return comp.id;
      }
    }
    return null;
  }

  private onMouseMove = (e: MouseEvent): void => {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const { x, y } = mouseToCanvasCoords(e, canvas);
    const hitId = this.hitTest(x, y);

    if (hitId !== this.hoveredId) {
      this.hoveredId = hitId;
      canvas.style.cursor = hitId ? 'pointer' : 'default';
      this.dispatchEvent(
        new CustomEvent('hover-change', {
          detail: { id: hitId },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private onMouseLeave = (): void => {
    if (this.hoveredId !== null) {
      this.hoveredId = null;
      const canvas = this.canvasRef.value;
      if (canvas) canvas.style.cursor = 'default';
      this.dispatchEvent(
        new CustomEvent('hover-change', {
          detail: { id: null },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private onClick = (e: MouseEvent): void => {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const { x, y } = mouseToCanvasCoords(e, canvas);
    const hitId = this.hitTest(x, y);

    // Plan gereği: bileşen hit → select; boş alan → none (seçimi temizle).
    const detail = hitId
      ? { type: 'component' as const, id: hitId }
      : { type: 'none' as const };

    this.dispatchEvent(
      new CustomEvent('select', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

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

    // ─── DPI scaling ──────────────────────────────────────────────────────
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

    // ─── Arka katman: noktalı grid ────────────────────────────────────────
    const styles = getComputedStyle(this);
    const minorColor = styles.getPropertyValue('--canvas-dot').trim();
    const majorColor = styles.getPropertyValue('--canvas-dot-maj').trim();

    const centerX = cssW / 2;
    const centerY = cssH / 2;

    const startI = -Math.ceil(centerX / MINOR_STEP);
    const endI = Math.ceil((cssW - centerX) / MINOR_STEP);
    const startJ = -Math.ceil(centerY / MINOR_STEP);
    const endJ = Math.ceil((cssH - centerY) / MINOR_STEP);

    ctx.fillStyle = minorColor;
    for (let i = startI; i <= endI; i++) {
      const iMajor = i % MAJOR_STEP_RATIO === 0;
      const x = Math.round(centerX + i * MINOR_STEP);
      for (let j = startJ; j <= endJ; j++) {
        if (iMajor && j % MAJOR_STEP_RATIO === 0) continue;
        const y = Math.round(centerY + j * MINOR_STEP);
        ctx.fillRect(x, y, MINOR_DOT, MINOR_DOT);
      }
    }

    ctx.fillStyle = majorColor;
    const majHalf = MAJOR_DOT / 2;
    const startIM = Math.ceil(startI / MAJOR_STEP_RATIO) * MAJOR_STEP_RATIO;
    const startJM = Math.ceil(startJ / MAJOR_STEP_RATIO) * MAJOR_STEP_RATIO;
    for (let i = startIM; i <= endI; i += MAJOR_STEP_RATIO) {
      const x = Math.round(centerX + i * MINOR_STEP);
      for (let j = startJM; j <= endJ; j += MAJOR_STEP_RATIO) {
        const y = Math.round(centerY + j * MINOR_STEP);
        ctx.fillRect(x - majHalf, y - majHalf, MAJOR_DOT, MAJOR_DOT);
      }
    }

    // ─── Ön katman: devre (Sprint 0.5 + 0.6 + 1.1 hover) ──────────────────
    if (this.circuit && this.layout) {
      const colors = readColors(this);
      drawCircuit(
        ctx,
        cssW,
        cssH,
        this.circuit,
        this.layout,
        this.solve ?? null,
        colors,
        this.selectionId,
        this.hoveredId,
      );
    }

    // Sprint 0.9: debug state kaldırıldı — cssW/cssH/dpr içeride hesaplanıyor
    // ve draw tamamlandığında artık kullanılmıyor.
    void dpr; // lint (noUnusedLocals) — dpr yukarıda scale için zaten kullanıldı
  }

  override render() {
    return html`
      <canvas ${ref(this.canvasRef)} aria-label="devre canvas"></canvas>
      <vxa-canvas-chrome
        .expTitle=${this.chromeTitle}
        .subtitle=${this.chromeSubtitle}
        .isPlaying=${this.isPlaying}
        .simTime=${this.simTime}
        .zoom=${this.zoom}
      ></vxa-canvas-chrome>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-canvas': VxaCanvas;
  }
}
