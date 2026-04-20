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
import type { CircuitDef, ComponentType, SolveResult } from '../bridge/engine.ts';

// Sprint 1.3: sidebar tool id'sinden engine component type'ına map.
// LED/Switch/Ground Sprint 1.3'te desteklenmiyor, null döner.
function toolToComponentType(tool: string): ComponentType {
  switch (tool) {
    case 'resistor':
      return 'R';
    case 'capacitor':
      return 'C';
    case 'battery':
      return 'V';
    default:
      // Tip garanti değilse güvenli fallback — ghost çizilmeyecek
      return 'R';
  }
}
import { readColors } from '../render/helpers.ts';
import {
  drawCircuit,
  type CircuitLayout,
} from '../render/circuit-renderer.ts';
import {
  componentAABB,
  hitTestTerminal,
  hitTestWire,
  mouseToCanvasCoords,
  pointInAABB,
} from '../interaction/hit-test.ts';
import type { WireDrawState } from '../interaction/wire-draw.ts';
import {
  COMPONENT_BOUNDS,
  DEFAULT_BOUNDS,
} from '../interaction/component-bounds.ts';
import {
  INITIAL_DRAG,
  computeDraggedPosition,
  shouldActivateDrag,
  snapToGrid,
  type DragState,
} from '../interaction/drag.ts';
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

  /** Sprint 1.5: seçili telin layout.wires[] içindeki indeksi. null/undefined
   * ise hiçbir tel seçili değil. Seçili tel render'da accent rengiyle çizilir. */
  @property({ attribute: false }) selectedWireIndex: number | null = null;

  // ─── Chrome prop'ları (Sprint 0.10) ────────────────────────────────────
  // <vxa-canvas-chrome>'a pass-through; canvas draw'ını etkilemez.
  @property() chromeTitle = 'DENEY';
  @property() chromeSubtitle = '';
  @property({ type: Boolean }) isPlaying = false;
  @property() simTime = '—';
  @property({ type: Number }) zoom = 100;

  // Sprint 1.3: aktif yerleştirme aracı (sidebar'dan). null → placement modu kapalı.
  @property() activeTool: string | null = null;

  // Sprint 1.4: design-mode'dan gelen tel çekme durumu. Canvas'ta preview
  // tel + hover terminal marker'ları bu prop'a göre render edilir.
  @property({ attribute: false }) wireDraw: WireDrawState = { phase: 'idle' };

  // ─── Internal ───────────────────────────────────────────────────────────
  private readonly canvasRef: Ref<HTMLCanvasElement> = createRef();
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle: number | null = null;

  // Sprint 1.1: hover state canvas içinde. Kalıcı state değil — mouseleave
  // temizler. Selection ise design-mode'da (prop olarak geri iner).
  @state() private hoveredId: string | null = null;

  // Sprint 1.5: hover edilen telin indeksi (layout.wires[]). hoveredId ile
  // mutually exclusive değil teorik olarak ama pratikte aynı anda ikisi
  // olmaz — component AABB teli kapsar. Öncelik: component hover > wire hover.
  @state() private hoveredWireIndex: number | null = null;

  // Sprint 1.2: drag state. Mousedown armed → mousemove eşik aşınca active.
  // Document seviyesinde mousemove/mouseup dinleniyor ki canvas dışına
  // sürüklenince bile akış devam etsin.
  @state() private dragState: DragState = INITIAL_DRAG;

  // Drag'in hemen sonrasında DOM otomatik click event'i tetikleyebilir —
  // "R1'i sürükledim, bırakınca seçim kaybolmasın/taşınmasın" için flag.
  private justFinishedDrag = false;

  // Sprint 1.3: ghost preview pozisyonu (layout-relative, snap'li).
  // activeTool null ise null. Canvas redraw ghost'u çizer.
  @state() private ghostPosition: { x: number; y: number } | null = null;

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
    // Sprint 1.2: drag başlangıcı. Mousedown canvas'ta, ama mousemove/up
    // document'ten — canvas dışına çıkınca da devam etsin.
    canvas.addEventListener('mousedown', this.onCanvasMouseDown);

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
      changed.has('selectedWireIndex') ||
      changed.has('hoveredId') ||
      changed.has('hoveredWireIndex') ||
      changed.has('activeTool') ||
      changed.has('ghostPosition') ||
      changed.has('wireDraw')
    ) {
      this.scheduleDraw();
    }
    // Sprint 1.3: activeTool null olduğunda ghost pozisyonu temizlenir, cursor
    // default'a döner. Sidebar yeni araç seçince cursor crosshair.
    if (changed.has('activeTool')) {
      const canvas = this.canvasRef.value;
      if (canvas) {
        canvas.style.cursor = this.activeTool ? 'crosshair' : 'default';
      }
      if (!this.activeTool && this.ghostPosition !== null) {
        this.ghostPosition = null;
      }
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
      canvas.removeEventListener('mousedown', this.onCanvasMouseDown);
    }
    // Sprint 1.2: drag aktifken unmount olursa document listener'ları sızmasın.
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
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
    // Sprint 1.2: drag aktifken hover hesaplamayı bırak — cursor grabbing
    // moduna geçmiş, hover highlight kullanıcıyı yanıltmasın.
    if (this.dragState.phase !== 'idle') return;

    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const { x, y } = mouseToCanvasCoords(e, canvas);

    // Sprint 1.4: tel modu veya normal modda mouse-move event emit —
    // design-mode preview tel pozisyonunu bu event'ten güncelliyor.
    // cx/cy canvas merkezi (layout-relative hesabı için).
    const rect = canvas.getBoundingClientRect();
    this.dispatchEvent(
      new CustomEvent('mouse-move', {
        detail: { x, y, cx: rect.width / 2, cy: rect.height / 2 },
        bubbles: true,
        composed: true,
      }),
    );

    // Sprint 1.3: activeTool varsa — ghost pozisyonunu güncelle, hover atla.
    if (this.activeTool) {
      const rect = canvas.getBoundingClientRect();
      const layoutX = snapToGrid(x - rect.width / 2);
      const layoutY = snapToGrid(y - rect.height / 2);
      if (
        this.ghostPosition?.x !== layoutX ||
        this.ghostPosition?.y !== layoutY
      ) {
        this.ghostPosition = { x: layoutX, y: layoutY };
      }
      // Hover highlight'ı placement modunda kapat
      if (this.hoveredId !== null) this.hoveredId = null;
      return;
    }

    // Sprint 1.4: tel modundayken cursor crosshair (hedef bekleniyor).
    if (this.wireDraw.phase === 'started') {
      canvas.style.cursor = 'crosshair';
      // hover yine açık — hedef bileşenin terminalleri belirgin olsun
    }

    const hitId = this.hitTest(x, y);

    // Sprint 1.5: wire hover — ama component hover önceliği yüksek. Kullanıcı
    // bileşen üzerindeyse altındaki tel parlamasın.
    let wireHit: number | null = null;
    if (!hitId && this.circuit && this.layout) {
      const rect = canvas.getBoundingClientRect();
      wireHit = hitTestWire(
        x,
        y,
        this.layout,
        this.circuit,
        rect.width / 2,
        rect.height / 2,
      );
    }

    if (hitId !== this.hoveredId) {
      this.hoveredId = hitId;
      this.dispatchEvent(
        new CustomEvent('hover-change', {
          detail: { id: hitId },
          bubbles: true,
          composed: true,
        }),
      );
    }
    if (wireHit !== this.hoveredWireIndex) {
      this.hoveredWireIndex = wireHit;
    }

    // Cursor: wire draw modunda dokunma, aksi halde hit durumuna göre.
    if (this.wireDraw.phase !== 'started') {
      canvas.style.cursor = hitId || wireHit !== null ? 'pointer' : 'default';
    }
  };

  private onMouseLeave = (): void => {
    if (this.hoveredId !== null) {
      this.hoveredId = null;
      this.dispatchEvent(
        new CustomEvent('hover-change', {
          detail: { id: null },
          bubbles: true,
          composed: true,
        }),
      );
    }
    // Sprint 1.5: tel hover'ı da temizle.
    if (this.hoveredWireIndex !== null) {
      this.hoveredWireIndex = null;
    }
    const canvas = this.canvasRef.value;
    if (canvas) canvas.style.cursor = 'default';
  };

  private onClick = (e: MouseEvent): void => {
    // Sprint 1.2: drag biter bitmez browser click event'i tetikleyebilir;
    // bunu yoksay — kullanıcının niyeti taşımaktı, seçimi değiştirmek değil.
    if (this.justFinishedDrag) return;

    const canvas = this.canvasRef.value;
    if (!canvas) return;

    const { x, y } = mouseToCanvasCoords(e, canvas);

    // ─── Sprint 1.3: activeTool placement önceliği ─────────────────────
    if (this.activeTool && this.ghostPosition) {
      this.dispatchEvent(
        new CustomEvent('place-component', {
          detail: {
            tool: this.activeTool,
            x: this.ghostPosition.x,
            y: this.ghostPosition.y,
          },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    // ─── Sprint 1.4: terminal hit önceliği — bileşenden önce ───────────
    if (this.circuit && this.layout) {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const termHit = hitTestTerminal(
        x,
        y,
        this.layout,
        this.circuit.components,
        cx,
        cy,
      );
      if (termHit) {
        this.dispatchEvent(
          new CustomEvent('terminal-click', {
            detail: termHit,
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
    }

    // ─── Sprint 1.1/1.5: component > wire > none ──────────────────────
    //   Terminal (1.4) > Component (1.1) > Wire (1.5) > Empty.
    //   Component AABB'leri tellerin üstünde olduğundan bileşene tıklandığında
    //   altındaki tel değil, bileşen seçilmeli.
    const hitId = this.hitTest(x, y);
    if (hitId) {
      this.dispatchEvent(
        new CustomEvent('select', {
          detail: { type: 'component' as const, id: hitId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    if (this.circuit && this.layout) {
      const rect = canvas.getBoundingClientRect();
      const wireHit = hitTestWire(
        x,
        y,
        this.layout,
        this.circuit,
        rect.width / 2,
        rect.height / 2,
      );
      if (wireHit !== null) {
        this.dispatchEvent(
          new CustomEvent('select', {
            detail: { type: 'wire' as const, index: wireHit },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
    }

    // Boş alan — seçimi temizle.
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: { type: 'none' as const },
        bubbles: true,
        composed: true,
      }),
    );
  };

  // ─── Sprint 1.2: drag handler'ları ────────────────────────────────────

  private onCanvasMouseDown = (e: MouseEvent): void => {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    if (e.button !== 0) return; // sadece sol tık

    const { x, y } = mouseToCanvasCoords(e, canvas);
    const hitId = this.hitTest(x, y);
    if (!hitId) return; // boş alan — drag başlatma, click zaten handle eder

    const placement = this.layout?.components.find((c) => c.id === hitId);
    if (!placement) return;

    this.dragState = {
      phase: 'armed',
      componentId: hitId,
      startX: x,
      startY: y,
      origX: placement.x,
      origY: placement.y,
    };

    // Metin seçimi vs engelle
    e.preventDefault();

    // Drag boyunca document listener'ları — canvas dışına çıkınca da akış sürsün
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  };

  private onDocumentMouseMove = (e: MouseEvent): void => {
    if (this.dragState.phase === 'idle') return;
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const { x, y } = mouseToCanvasCoords(e, canvas);

    // Armed → active geçişi (eşik)
    if (this.dragState.phase === 'armed') {
      if (!shouldActivateDrag(this.dragState, x, y)) return;
      this.dragState = { ...this.dragState, phase: 'active' };
      canvas.style.cursor = 'grabbing';
      // Hover temizle — drag sırasında hover işi ölmeli
      if (this.hoveredId !== null) this.hoveredId = null;
    }

    if (this.dragState.phase === 'active') {
      const { x: newX, y: newY } = computeDraggedPosition(this.dragState, x, y);
      this.dispatchEvent(
        new CustomEvent('drag-position', {
          detail: {
            componentId: this.dragState.componentId,
            x: newX,
            y: newY,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private onDocumentMouseUp = (): void => {
    const wasActive = this.dragState.phase === 'active';
    if (wasActive) {
      this.dispatchEvent(
        new CustomEvent('drag-end', {
          detail: {
            componentId: (this.dragState as Extract<DragState, { phase: 'active' }>).componentId,
          },
          bubbles: true,
          composed: true,
        }),
      );
      // Browser mouseup sonrası click event'ini tetikleyebilir; onClick
      // handler'ı bu flag'e bakıp atlayacak. setTimeout 0 ile event kuyruğu
      // sonunda temizle — click event bu frame'de tetiklenirse yakalanmış olur.
      this.justFinishedDrag = true;
      setTimeout(() => {
        this.justFinishedDrag = false;
      }, 0);
    }
    const canvas = this.canvasRef.value;
    if (canvas) canvas.style.cursor = 'default';
    this.dragState = INITIAL_DRAG;
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
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

    // ─── Ön katman: devre (Sprint 0.5 + 0.6 + 1.1 hover + 1.3 ghost) ─────
    if (this.circuit && this.layout) {
      const colors = readColors(this);
      // Sprint 1.3: ghost için bileşen tipi. activeTool null ise ghost yok.
      const ghost =
        this.activeTool && this.ghostPosition
          ? {
              type: toolToComponentType(this.activeTool),
              x: this.ghostPosition.x,
              y: this.ghostPosition.y,
            }
          : undefined;
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
        ghost,
        this.wireDraw,
        this.selectedWireIndex,
        this.hoveredWireIndex,
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
