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
import '../sidebar/sidebar.ts';
import type { ModeName } from '../topbar/topbar.ts';
import type {
  CircuitLayout,
  WireEndpoint,
} from '../render/circuit-renderer.ts';
import { routeWire } from '../interaction/wire-router.ts';
import {
  COMPONENT_BOUNDS,
  DEFAULT_BOUNDS,
} from '../interaction/component-bounds.ts';
import {
  resolveTerminalLocal,
  TERMINAL_ORDER,
  type Point,
  type TerminalRef,
} from '../interaction/component-terminals.ts';
import {
  INITIAL_WIRE_DRAW,
  terminalToNodeName,
  type WireDrawState,
} from '../interaction/wire-draw.ts';
import {
  solveTransient,
  type CircuitDef,
  type ComponentType,
  type SolveResult,
  type TransientResult,
} from '../bridge/engine.ts';
import {
  RC_LOWPASS,
  RC_LOWPASS_LAYOUT,
  RC_TAU_SECONDS,
  RC_TRANSIENT_DT,
  RC_TRANSIENT_DURATION,
} from '../circuits/rc-lowpass.ts';
import {
  formatCapacitance,
  formatResistance,
} from '../util/format.ts';

// ─── Sprint 1.3 yerleştirme yardımcıları ──────────────────────────────────

/** Sidebar tool id → engine ComponentType. Null = desteklenmiyor. */
function toolToComponentType(tool: string): ComponentType | null {
  switch (tool) {
    case 'resistor':  return 'R';
    case 'capacitor': return 'C';
    case 'battery':   return 'V';
    default:          return null;
  }
}

/** Yeni bileşenin başlangıç değeri (SI birimde). Plan standardı. */
const DEFAULT_VALUES: Record<ComponentType, number> = {
  V: 5,       // 5 V pil
  R: 1000,    // 1 kΩ
  C: 10e-9,   // 10 nF
  L: 1e-3,    // 1 mH (Sprint 1.x+)
  I: 0.001,   // 1 mA (Sprint 1.x+)
  D: 0, Z: 0, BJT: 0, MOS: 0, OA: 0,
};

/** Bileşen yanındaki görünür etiket (Sprint 0.5'teki displayValue semantiği). */
function formatComponentDisplay(type: ComponentType, value: number): string {
  switch (type) {
    case 'R': return formatResistance(value);
    case 'C': return formatCapacitance(value);
    case 'V': return `${value} V`;
    default:  return String(value);
  }
}
import {
  formatCurrent,
  formatTime,
  formatVoltage,
} from '../util/format.ts';
import { snapshotFromTransient } from '../util/snapshot.ts';
import {
  INITIAL_SELECTION,
  isComponentSelected,
  selectedComponentIds,
  type Selection,
} from '../state/selection.ts';
import {
  INITIAL_HISTORY,
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  pushAction as historyPush,
  redo as historyRedo,
  snapshot as historySnapshot,
  undo as historyUndo,
  type HistoryState,
} from '../state/history.ts';
import {
  INITIAL_RUBBER_BAND,
  componentsInRect,
  rubberBandRect,
  shouldActivateRubberBand,
  type RubberBandState,
} from '../interaction/rubber-band.ts';

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'ok'; transient: TransientResult; snapshot: SolveResult }
  | { kind: 'err'; message: string }
  // Sprint 2.5 / Bug #3: boş devre. Kullanıcı tüm bileşenleri sildi ya da
  // henüz hiçbir şey eklemedi. Stale snapshot gösterme — placeholder UI.
  | { kind: 'empty' };

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

    /* Topbar bölgesi — <vxa-topbar> tam kaplar (Sprint 0.8). */
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

    /* Sidebar bölgesi — Sprint 0.9'da placeholder metin ve dashed border
       kaldırıldı. Boş zemin + sağ ayırıcı. İçerik Sprint 0.11'de. */
    .sidebar-zone {
      grid-area: sidebar;
      background: var(--bg-1);
      border-right: 1px solid var(--line);
      overflow: hidden;
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

    /* Sprint 2.5 / Bug #3: boş devre dashboard — chart yerine ipucu metni. */
    .empty-hint {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.08em;
      text-transform: lowercase;
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

    /* Sprint 0.9: .dev-marker kaldırıldı — production temiz görünüm. */
  `;

  @state() private dashboard: DashboardState = { kind: 'loading' };

  // Sprint 0.6: selection state. Sprint 0.7'de canvas click event'i bu state'i
  // güncelleyecek.
  @state() private selection: Selection = INITIAL_SELECTION;

  // Sprint 0.8: mod switch state. Şu an sadece 'tasarla' aktif; Keşfet/Güç
  // shell'leri Faz 3+'da gelecek.
  @state() private activeMode: ModeName = 'tasarla';

  // Sprint 0.11: aktif araç (sidebar katalog).
  // Sprint 1.3: artık gerçek — sidebar tool-select set eder, canvas ghost gezer.
  @state() private activeTool:
    | 'resistor'
    | 'capacitor'
    | 'battery'
    | null = null;

  // Sprint 1.2: layout artık state — kullanıcı bileşen drag edince güncellenir.
  // structuredClone ile derin kopya alıyoruz ki RC_LOWPASS_LAYOUT saf kalsın.
  // Via noktaları ilk yüklemede recomputeWires() ile hesaplanır.
  @state() private layout: CircuitLayout = structuredClone(RC_LOWPASS_LAYOUT);

  // Sprint 1.3: circuit de artık state — kullanıcı bileşen yerleştirince
  // components ve nodes listesi genişler. Derin kopya ile RC_LOWPASS saf kalır.
  @state() private circuit: CircuitDef = structuredClone(RC_LOWPASS);

  // Sprint 1.3: yeni bileşen terminalleri için eşsiz floating node sayacı.
  private floatingNodeCounter = 1;

  // Sprint 1.4: tel çekme durumu. idle → started → (kurulum/iptal) → idle.
  @state() private wireDraw: WireDrawState = INITIAL_WIRE_DRAW;

  // Sprint 2.1: undo/redo snapshot stack. Her undoable action öncesi
  // pushHistory() çağrılır; state/history.ts immutable reducer'larla yönetir.
  // UI state (selection, hover, activeTool) history'de DEĞİL.
  @state() private history: HistoryState = INITIAL_HISTORY;

  // Sprint 2.1: drag boyunca history tek sefer pushlanır. İlk drag-position
  // event'inde flag true olur, drag-end'de false'a döner. Aksi halde 60+ ara
  // mousemove her biri ayrı snapshot alır — kullanıcı 1 drag = 60 undo.
  private dragHistoryPushed = false;

  // Sprint 2.5 / Bug #6: drag sırasında Escape iptal için. İlk drag-position
  // event'inde etkilenen bileşenlerin orijinal konumları saklanır. Escape'te
  // layout bu konumlara restore + history.past'tan commit'sız snapshot atılır.
  private dragOrigPositions: Map<string, { x: number; y: number }> | null = null;

  // Sprint 2.3: rubber-band state. Canvas boş alan mousedown → armed → active.
  // baseSelection armed anında dondurulur; Shift+drag bu baseSelection'a ekler.
  @state() private rubberBand: RubberBandState = INITIAL_RUBBER_BAND;

  // Sprint 2.2: canvas select event — hit bilgisi + shift modifier.
  // Karar burada (design-mode state'e sahip). Shift+Click toggle,
  // normal click Sprint 1.1/1.5 davranışı.
  private onCanvasSelect = (e: Event): void => {
    const { hitComponent, hitWire, isShift } = (e as CustomEvent).detail as {
      hitComponent: string | null;
      hitWire: number | null;
      isShift: boolean;
    };

    if (isShift) {
      // Shift+Click: sadece bileşen toggle. Tel ve boş alan selection'ı
      // korur (Figma davranışı) — kullanıcı yanlışlıkla kaçırdıysa seçimi
      // kaybetmesin.
      if (hitComponent) {
        this.selection = this.toggleComponentInSelection(this.selection, hitComponent);
      }
      return;
    }

    // Shift yok — Sprint 1.1/1.5 normal davranış.
    if (hitComponent) {
      this.selection = { type: 'component', id: hitComponent };
    } else if (hitWire !== null) {
      this.selection = { type: 'wire', index: hitWire };
    } else {
      this.selection = INITIAL_SELECTION;
    }
  };

  /** Sprint 2.2: Shift+Click bileşen toggle.
   *  Geçiş kuralları:
   *    none → component (id)
   *    component (id) → none (aynı id)
   *    component (other) → multi [other, id]
   *    multi + id hariç → multi + id ekle
   *    multi + id dahil, n>2 → multi - id
   *    multi + id dahil, n=2 → component (kalan tek eleman)
   *    wire → component (id) (kategoriler arası geçişte tel iptal)
   *  'multi' TIPI EN AZ 2 ELEMAN — tek kalınca component'a düşer. */
  private toggleComponentInSelection(sel: Selection, id: string): Selection {
    const current = selectedComponentIds(sel);
    if (current.includes(id)) {
      const remaining = current.filter((x) => x !== id);
      if (remaining.length === 0) return { type: 'none' };
      if (remaining.length === 1) return { type: 'component', id: remaining[0]! };
      return { type: 'multi', componentIds: remaining };
    }
    const combined = [...current, id];
    if (combined.length === 1) return { type: 'component', id };
    return { type: 'multi', componentIds: combined };
  }

  // ─── Sprint 2.1: history helpers ──────────────────────────────────────

  /** Undoable bir action yapılmadan ÖNCE çağrılır. Mevcut circuit + layout
   *  snapshot'ı past stack'ine pushlanır, future temizlenir.
   *
   *  Kullanım:
   *    this.pushHistory();        // action öncesi snapshot
   *    this.layout = { ... };      // action'ı uygula
   *    await this.runSolver();     // solver tetikle
   *  */
  private pushHistory(): void {
    const current = historySnapshot(this.circuit, this.layout);
    this.history = historyPush(this.history, current);
  }

  /** Ctrl+Z: past'ın top'unu restore et, mevcut state'i future'a it. */
  private async doUndo(): Promise<void> {
    const current = historySnapshot(this.circuit, this.layout);
    const result = historyUndo(this.history, current);
    if (!result) return;
    this.history = result.newHistory;
    this.circuit = result.restored.circuit;
    this.layout = result.restored.layout;
    // UI state reset — eski selection/hover/wireDraw geçersiz olabilir.
    this.selection = INITIAL_SELECTION;
    this.wireDraw = INITIAL_WIRE_DRAW;
    this.activeTool = null;
    this.dragHistoryPushed = false;
    await this.runSolver();
  }

  /** Sprint 2.4: topbar'dan action event. Undo/Redo butonları design-mode
   *  handler'larına köprü — diğer butonlar (save/open/spice/bom/export) hâlâ
   *  TODO log. */
  private onTopbarAction = (e: Event): void => {
    const id = (e as CustomEvent).detail.id as string;
    if (id === 'undo') {
      void this.doUndo();
    } else if (id === 'redo') {
      void this.doRedo();
    } else {
      // Sprint 1.x+ handler'ları için placeholder
      console.log(`[TODO] ${id} butonu — Sprint 3.x+`);
    }
  };

  /** Ctrl+Shift+Z (veya Ctrl+Y): future'ın first'ünü restore et. */
  private async doRedo(): Promise<void> {
    const current = historySnapshot(this.circuit, this.layout);
    const result = historyRedo(this.history, current);
    if (!result) return;
    this.history = result.newHistory;
    this.circuit = result.restored.circuit;
    this.layout = result.restored.layout;
    this.selection = INITIAL_SELECTION;
    this.wireDraw = INITIAL_WIRE_DRAW;
    this.activeTool = null;
    this.dragHistoryPushed = false;
    await this.runSolver();
  }

  // ─── Sprint 1.3: yerleştirme akışı ────────────────────────────────────

  /** Sidebar'dan tool-select event'i. Yalnızca R/C/V destekleniyor — diğer
   * tipler [TODO] log. */
  private onSidebarToolSelect = (e: Event): void => {
    const id = (e as CustomEvent).detail.id as string;
    if (id === 'resistor' || id === 'capacitor' || id === 'battery') {
      this.activeTool = id;
    } else {
      // LED, Switch, Ground Sprint 1.x+'da gelecek
      console.log(`[TODO] ${id} aracı Sprint 1.x+'da gelecek`);
    }
  };

  /** Canvas'tan place-component event'i. Yeni bileşen id üret, circuit ve
   * layout state güncelle, solver yeniden çağır. */
  private onPlaceComponent = async (e: Event): Promise<void> => {
    const detail = (e as CustomEvent).detail as {
      tool: string;
      x: number;
      y: number;
    };
    const type = toolToComponentType(detail.tool);
    if (!type) return;

    // Sprint 2.1: action öncesi snapshot — undoable.
    this.pushHistory();

    const id = this.generateNewId(type);
    const value = DEFAULT_VALUES[type];
    const n1 = this.generateFloatingNode();
    const n2 = this.generateFloatingNode();
    const displayValue = formatComponentDisplay(type, value);

    // Circuit — immutable update. components + nodes genişler.
    this.circuit = {
      ...this.circuit,
      components: [
        ...this.circuit.components,
        { type, id, nodes: [n1, n2], value },
      ],
      nodes: [...this.circuit.nodes, n1, n2],
    };

    // Layout — yeni placement eklenir, wires dokunulmaz (yeni bileşen bağsız).
    const newLayout: CircuitLayout = {
      ...this.layout,
      components: [
        ...this.layout.components,
        { id, x: detail.x, y: detail.y, rotation: 0, displayValue },
      ],
    };
    this.layout = this.recomputeWires(newLayout);

    // Placement modunu kapat — tek tıklama = tek yerleştirme
    this.activeTool = null;

    // Sprint 1.3: topoloji değişti → solver yeniden çağrılmalı
    await this.runSolver();
  };

  /** Yeni bileşen id üretici. Mevcut aynı-tip id'lerini tarar, max+1. */
  private generateNewId(type: ComponentType): string {
    const prefix = type;
    const existing = this.circuit.components
      .filter((c) => c.type === type)
      .map((c) => {
        const match = c.id.match(/(\d+)$/);
        return match ? parseInt(match[1]!, 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `${prefix}${nextNum}`;
  }

  /** Eşsiz floating node adı. Her terminal bağımsız. */
  private generateFloatingNode(): string {
    return `float_${this.floatingNodeCounter++}`;
  }

  /** Tüm non-ground node adları — solver probeNodes parametresi için. */
  private getAllNonGroundNodes(): string[] {
    const nodes = new Set<string>();
    for (const c of this.circuit.components) {
      for (const n of c.nodes) {
        if (n !== 'gnd' && n !== 'ground' && n !== '0') nodes.add(n);
      }
    }
    return Array.from(nodes);
  }

  /** Solver'ı mevcut circuit ile yeniden çağır. Topoloji değişimi sonrası
   * (Sprint 1.3 yerleştirme, Sprint 1.4 tel çekme, Sprint 1.5 silme).
   * Drag (layout-only) tetiklemez.
   *
   * Sprint 2.5 / Bug #3: Boş devre için solver'ı çağırmadan empty state'e
   * düş. Aksi halde solver 0-bileşen için crash/garbage döner ve dashboard
   * stale snapshot'ta kalıyordu. */
  private async runSolver(): Promise<void> {
    if (this.circuit.components.length === 0) {
      this.dashboard = { kind: 'empty' };
      return;
    }
    try {
      const transient = await solveTransient({
        circuit: this.circuit,
        dt: RC_TRANSIENT_DT,
        duration: RC_TRANSIENT_DURATION,
        probeNodes: this.getAllNonGroundNodes(),
      });
      if (transient.success) {
        const snapshot = snapshotFromTransient(transient, this.circuit, -1);
        this.dashboard = { kind: 'ok', transient, snapshot };
      } else {
        // Sprint 2.5 / Bug #3: Başarısız solver → err state'e düş (önceki
        // disiplin "eski sonucu koru" idi ama kullanıcı için yanıltıcı;
        // "V=0 ama I=33.94µA" senaryosu bundan doğmuştu).
        this.dashboard = {
          kind: 'err',
          message: transient.errorMessage ?? 'solver başarısız',
        };
      }
    } catch (err) {
      console.error('[solver] beklenmedik hata:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this.dashboard = { kind: 'err', message: msg };
    }
  }

  /** Document keydown — Escape + Delete/Backspace + Undo/Redo.
   *  Escape: placement veya tel modunu iptal (Sprint 1.3/1.4).
   *  Delete/Backspace: seçili bileşen veya tel silme (Sprint 1.5).
   *  Ctrl/Cmd+Z: undo (Sprint 2.1).
   *  Ctrl/Cmd+Shift+Z veya Ctrl+Y: redo (Sprint 2.1). */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.activeTool) {
        this.activeTool = null;
        e.preventDefault();
        return;
      }
      if (this.wireDraw.phase !== 'idle') {
        this.wireDraw = INITIAL_WIRE_DRAW;
        e.preventDefault();
        return;
      }
      // Sprint 2.3: rubber-band aktifse iptal et, baseSelection geri dön.
      if (this.rubberBand.phase !== 'idle') {
        this.selection = this.rubberBand.baseSelection;
        this.rubberBand = INITIAL_RUBBER_BAND;
        e.preventDefault();
        return;
      }
      // Sprint 2.5 / Bug #6: drag sırasında Escape → iptal.
      if (this.dragOrigPositions !== null && this.dragHistoryPushed) {
        this.cancelActiveDrag();
        e.preventDefault();
        return;
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Text input odağındayken Backspace'i yakalama — form'ları kırar.
      if (this.isTextInputFocused(e)) return;

      // Sprint 2.2: router — component / wire / multi.
      if (this.selection.type !== 'none') {
        e.preventDefault();
        void this.deleteSelection();
      }
      return;
    }

    // Sprint 2.1: Undo/Redo. Mac'te Cmd, Windows/Linux'ta Ctrl.
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key.toLowerCase();

    if (!cmdKey) return;

    // Text input focus'unda tarayıcının kendi undo'suna izin ver.
    if (this.isTextInputFocused(e)) return;

    // Ctrl/Cmd+Shift+Z → redo. Ctrl+Y → redo (Windows klasik).
    if ((e.shiftKey && key === 'z') || (!e.shiftKey && key === 'y')) {
      e.preventDefault();
      void this.doRedo();
      return;
    }

    // Ctrl/Cmd+Z (shift yok) → undo.
    if (!e.shiftKey && key === 'z') {
      e.preventDefault();
      void this.doUndo();
      return;
    }
  };

  /** Event target text alanı mı? input/textarea/contentEditable. */
  private isTextInputFocused(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
  }

  /** Sprint 2.5 / Bug #6: aktif drag'i iptal et.
   *    1. Layout: etkilenen bileşenleri dragOrigPositions'tan restore et
   *       + wire'ları yeniden route et (recomputeWires).
   *    2. History: drag başında pushHistory yapılmıştı; commit olmadığı
   *       için past stack'in son elemanı atılır (Ctrl+Z "hayalet" drag'e
   *       gitmesin).
   *    3. Canvas: dragState.idle + document listener cleanup.
   *    4. design-mode flag'ler reset.
   *  Sıra kritik — layout restore → history pop → state reset. */
  private cancelActiveDrag(): void {
    if (!this.dragOrigPositions) return;
    const restored = this.layout.components.map((c) => {
      const orig = this.dragOrigPositions!.get(c.id);
      return orig ? { ...c, x: orig.x, y: orig.y } : c;
    });
    this.layout = this.recomputeWires({ ...this.layout, components: restored });

    // history.past'tan son (commit olmayan) snapshot'ı at
    this.history = {
      past: this.history.past.slice(0, -1),
      future: this.history.future,
    };

    this.dragHistoryPushed = false;
    this.dragOrigPositions = null;

    // Canvas'ı bilgilendir: dragState idle + document listener cleanup
    const canvas = this.shadowRoot?.querySelector('vxa-canvas') as
      | (HTMLElement & { cancelDrag?: () => void })
      | null;
    canvas?.cancelDrag?.();
  }

  /** Sprint 2.5 / Bug #1: silme sonrası canvas'ın stale hover state'ini
   *  temizle. Fare taşınana kadar hoveredId/hoveredWireIndex eski ID'de
   *  kalıyor; görsel orphan yaratıyor. */
  private clearCanvasHover(): void {
    const canvas = this.shadowRoot?.querySelector('vxa-canvas') as
      | (HTMLElement & { clearHover?: () => void })
      | null;
    canvas?.clearHover?.();
  }

  // ─── Sprint 1.5 / 2.2: silme akışı ────────────────────────────────────

  /** Sprint 2.2: Delete tuşuna basıldığında çağrılan router. Selection
   *  tipine göre tekil veya bulk silme fonksiyonuna yönlendirir. */
  private async deleteSelection(): Promise<void> {
    if (this.selection.type === 'component') {
      return this.deleteComponent(this.selection.id);
    }
    if (this.selection.type === 'wire') {
      return this.deleteWire(this.selection.index);
    }
    if (this.selection.type === 'multi') {
      return this.deleteMultipleComponents(this.selection.componentIds);
    }
  }

  /** Sprint 2.2: birden fazla bileşeni tek undo adımında sil.
   *  Her bileşen + bağlı tüm teller kaldırılır; node topolojisi
   *  `rebuildNodeTopology` ile yeniden kurulur; solver bir kez çalışır. */
  private async deleteMultipleComponents(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    // TEK snapshot — kullanıcı Ctrl+Z bassa N adım değil 1 adım geri alsın.
    this.pushHistory();

    const idSet = new Set(ids);

    // Circuit'ten bileşenleri çıkar
    const newComponents = this.circuit.components.filter((c) => !idSet.has(c.id));

    // Orphan node cleanup — silinen bileşenlerin artık kullanılmayan node'ları
    const stillUsed = new Set<string>();
    for (const c of newComponents) for (const n of c.nodes) stillUsed.add(n);
    stillUsed.add('gnd');

    // Layout'tan bileşenleri + bağlı tüm telleri kaldır
    const remainingWires = this.layout.wires.filter((w) => {
      const fromHit = w.from.kind === 'terminal' && idSet.has(w.from.componentId);
      const toHit = w.to.kind === 'terminal' && idSet.has(w.to.componentId);
      return !fromHit && !toHit;
    });

    // Node rebuild (Sprint 1.5 algoritması) — kalan bileşenler için topoloji
    const rebuilt = this.rebuildNodeTopology(
      {
        ...this.circuit,
        components: newComponents,
        nodes: this.circuit.nodes.filter((n) => stillUsed.has(n)),
      },
      remainingWires,
    );
    this.circuit = rebuilt;

    this.layout = this.recomputeWires({
      ...this.layout,
      components: this.layout.components.filter((c) => !idSet.has(c.id)),
      wires: remainingWires,
    });

    this.selection = INITIAL_SELECTION;

    // Sprint 2.5 / Bug #1: bulk delete sonrası hover cleanup.
    this.clearCanvasHover();

    await this.runSolver();
  }

  /** Bileşeni sil: bileşeni + ona bağlı tüm telleri kaldır, orphan
   *  node'ları temizle, seçimi sıfırla, solver yeniden çağır. */
  private async deleteComponent(id: string): Promise<void> {
    const comp = this.circuit.components.find((c) => c.id === id);
    if (!comp) return;

    // Sprint 2.1: action öncesi snapshot — undoable.
    this.pushHistory();

    // 1) Circuit'ten bileşeni çıkar
    const newComponents = this.circuit.components.filter((c) => c.id !== id);
    // 2) Artık hiçbir bileşenin kullanmadığı node'ları at (orphan cleanup)
    const stillUsed = new Set<string>();
    for (const c of newComponents) {
      for (const n of c.nodes) stillUsed.add(n);
    }
    // 'gnd' her zaman kalsın — layout'ta GND sembolü var
    stillUsed.add('gnd');

    this.circuit = {
      ...this.circuit,
      components: newComponents,
      nodes: this.circuit.nodes.filter((n) => stillUsed.has(n)),
    };

    // 3) Layout'tan bileşeni + ona bağlı tüm telleri kaldır
    const newLayout: CircuitLayout = {
      ...this.layout,
      components: this.layout.components.filter((c) => c.id !== id),
      wires: this.layout.wires.filter((w) => {
        const fromMatch = w.from.kind === 'terminal' && w.from.componentId === id;
        const toMatch = w.to.kind === 'terminal' && w.to.componentId === id;
        return !fromMatch && !toMatch;
      }),
    };
    this.layout = this.recomputeWires(newLayout);

    // 4) Seçim temizle — silinen bileşen seçiliyse empty'e düş
    this.selection = INITIAL_SELECTION;

    // Sprint 2.5 / Bug #1: silme sonrası canvas hover state'i temizle —
    // silinen bileşen hâlâ hoveredId olarak kalıyor, orphan marker yaratıyor.
    this.clearCanvasHover();

    // 5) Topoloji değişti → solver
    await this.runSolver();
  }

  /** Tel'i sil: layout.wires[index] kaldır + node topolojisini Union-Find
   *  ile yeniden hesapla. Rezerve isimler ('in', 'out', 'gnd') korunur. */
  private async deleteWire(index: number): Promise<void> {
    if (index < 0 || index >= this.layout.wires.length) return;

    // Sprint 2.1: action öncesi snapshot — undoable.
    this.pushHistory();

    const remainingWires = this.layout.wires.filter((_, i) => i !== index);

    // Node topolojisini yeniden kur — Seçenek B (Union-Find rebuild).
    const rebuilt = this.rebuildNodeTopology(this.circuit, remainingWires);
    this.circuit = rebuilt;

    // Layout'tan wire kaldır + yeniden route
    this.layout = this.recomputeWires({
      ...this.layout,
      wires: remainingWires,
    });

    // Seçim temizle
    this.selection = INITIAL_SELECTION;

    // Sprint 2.5 / Bug #1: tel silme sonrası stale hoveredWireIndex cleanup.
    this.clearCanvasHover();

    // Topoloji değişti → solver
    await this.runSolver();
  }

  /** Sprint 1.5 — tüm component.nodes[]'ı sıfırdan Union-Find ile yeniden
   *  kurar. Algoritma:
   *    1. Her terminal için başlangıç node'u:
   *       - Mevcut isim rezerve ise ('in', 'out', 'gnd') → koru.
   *       - Aksi halde → 'n_{id}_{terminal}' (benzersiz generic).
   *    2. Kalan tellerin her biri iki terminali aynı node'a merge eder.
   *       Rezerve isim > generic isim (chooseMergedNodeName benzeri).
   *    3. Tüm component.nodes[]'ı yeni atamalarla güncelle.
   *    4. circuit.nodes'u kullanılan node'lar kümesiyle güncelle. */
  private rebuildNodeTopology(
    circuit: CircuitDef,
    wires: ReadonlyArray<{ from: WireEndpoint; to: WireEndpoint }>,
  ): CircuitDef {
    // Terminal → node adı haritası
    const nodeOf = new Map<string, string>();

    // 1. Başlangıç atamaları
    for (const comp of circuit.components) {
      const termNames = TERMINAL_ORDER[comp.type];
      if (!termNames) continue;
      for (let i = 0; i < termNames.length; i++) {
        const key = `${comp.id}.${termNames[i]}`;
        const current = comp.nodes[i];
        // Mevcut isim rezerve ise (generic değilse) koru.
        const start =
          current && !this.isGeneratedNodeName(current) && current !== ''
            ? current
            : `n_${comp.id}_${termNames[i]}`;
        nodeOf.set(key, start);
      }
    }

    // 2. Wire'ları uygula — merge
    for (const wire of wires) {
      if (wire.from.kind !== 'terminal' || wire.to.kind !== 'terminal') continue;
      const kA = `${wire.from.componentId}.${wire.from.terminal}`;
      const kB = `${wire.to.componentId}.${wire.to.terminal}`;
      const nA = nodeOf.get(kA);
      const nB = nodeOf.get(kB);
      if (!nA || !nB || nA === nB) continue;

      const winner = this.chooseMergedNodeName(nA, nB);
      const loser = winner === nA ? nB : nA;
      for (const [k, v] of nodeOf) {
        if (v === loser) nodeOf.set(k, winner);
      }
    }

    // 3. component.nodes[] yeniden üret
    const newComponents = circuit.components.map((comp) => {
      const termNames = TERMINAL_ORDER[comp.type];
      if (!termNames) return comp;
      const newNodes = termNames.map((t) => {
        const k = `${comp.id}.${t}`;
        return nodeOf.get(k) ?? comp.nodes[termNames.indexOf(t)] ?? '';
      });
      return { ...comp, nodes: newNodes as typeof comp.nodes };
    });

    // 4. circuit.nodes — kullanılan set
    const used = new Set<string>();
    for (const c of newComponents) for (const n of c.nodes) used.add(n);
    used.add('gnd'); // toprak her zaman var

    return {
      ...circuit,
      components: newComponents,
      nodes: Array.from(used),
    };
  }

  /** Generic (üretilmiş) node adı mı? 'float_N' ve 'n_X_Y' generic; diğerleri
   *  rezerve sayılır ('in', 'out', 'gnd', composite 'in_out' vb.). */
  private isGeneratedNodeName(n: string): boolean {
    return n.startsWith('float_') || n.startsWith('n_');
  }

  // ─── Sprint 1.4: tel çekme akışı ──────────────────────────────────────

  /** Canvas'tan mouse-move event. Tel modundayken preview tel için previewTo
   * güncellenir (layout-relative). */
  private onCanvasMouseMove = (e: Event): void => {
    if (this.wireDraw.phase !== 'started') return;
    const detail = (e as CustomEvent).detail as {
      x: number;
      y: number;
      cx: number;
      cy: number;
    };
    // Canvas-local (x, y) → layout-relative (x-cx, y-cy)
    const previewTo = { x: detail.x - detail.cx, y: detail.y - detail.cy };
    this.wireDraw = { ...this.wireDraw, previewTo };
  };

  /** Canvas'tan terminal-click event. idle ise tel modunu başlat; started ise
   * ikinci terminal — kur veya iptal. */
  private onTerminalClick = (e: Event): void => {
    const term = (e as CustomEvent).detail as TerminalRef;

    if (this.wireDraw.phase === 'idle') {
      const point = this.getTerminalLayoutPosition(term);
      if (!point) return;
      this.wireDraw = {
        phase: 'started',
        from: term,
        fromPoint: point,
        previewTo: point,
      };
      return;
    }

    // started phase — ikinci terminal
    const from = this.wireDraw.from;
    if (
      term.componentId === from.componentId &&
      term.terminal === from.terminal
    ) {
      // Aynı terminal — iptal
      this.wireDraw = INITIAL_WIRE_DRAW;
      return;
    }
    if (term.componentId === from.componentId) {
      // Aynı bileşenin iki terminali — kısa devre, engelle
      console.warn('[wire] kısa devre engellendi: aynı bileşenin terminalleri');
      this.wireDraw = INITIAL_WIRE_DRAW;
      return;
    }

    this.wireDraw = INITIAL_WIRE_DRAW;
    void this.connectTerminals(from, term);
  };

  /** Terminal'in layout-relative noktasını döner. Canvas world için +cx/+cy. */
  private getTerminalLayoutPosition(term: TerminalRef): Point | null {
    const placement = this.layout.components.find((c) => c.id === term.componentId);
    if (!placement) return null;
    const comp = this.circuit.components.find((c) => c.id === term.componentId);
    if (!comp) return null;
    return resolveTerminalLocal(
      { x: placement.x, y: placement.y, rotation: placement.rotation },
      comp.type,
      term.terminal,
    );
  }

  /** Tel kur: iki terminal'in bağlı olduğu node'ları merge et + layout'a
   * wire ekle + solver tetikle. */
  private async connectTerminals(
    from: TerminalRef,
    to: TerminalRef,
  ): Promise<void> {
    const fromNode = terminalToNodeName(from, this.circuit);
    const toNode = terminalToNodeName(to, this.circuit);
    if (!fromNode || !toNode) {
      console.warn('[wire] terminal node isimleri bulunamadı');
      return;
    }
    if (fromNode === toNode) {
      console.warn('[wire] terminaller zaten aynı node\'da:', fromNode);
      return;
    }

    // Sprint 2.1: action öncesi snapshot — undoable.
    this.pushHistory();

    const merged = this.chooseMergedNodeName(fromNode, toNode);

    // Immutable merge: tüm components nodes[]'da fromNode ve toNode → merged.
    this.circuit = {
      ...this.circuit,
      components: this.circuit.components.map((c) => ({
        ...c,
        nodes: c.nodes.map((n) =>
          n === fromNode || n === toNode ? merged : n,
        ) as typeof c.nodes,
      })),
      nodes: Array.from(
        new Set(
          this.circuit.nodes.map((n) =>
            n === fromNode || n === toNode ? merged : n,
          ),
        ),
      ),
    };

    // Layout'a yeni wire ekle (terminal-ref format)
    const newWires = [
      ...this.layout.wires,
      {
        from: { kind: 'terminal' as const, componentId: from.componentId, terminal: from.terminal },
        to: { kind: 'terminal' as const, componentId: to.componentId, terminal: to.terminal },
      },
    ];
    this.layout = this.recomputeWires({ ...this.layout, wires: newWires });

    // Topoloji değişti → solver yeniden çağır
    await this.runSolver();
  }

  /** İki node adını tek ada indirger. Generic (float_/n_) vs rezerve ('in',
   *  'out', 'gnd', composite) → rezerve kazanır. Sprint 1.4 sadece float_
   *  prefix'ine bakıyordu; Sprint 1.5'te rebuild tarafından üretilen n_ prefix
   *  de generic muamelesi görmeli. */
  private chooseMergedNodeName(a: string, b: string): string {
    const aGen = this.isGeneratedNodeName(a);
    const bGen = this.isGeneratedNodeName(b);
    if (aGen && !bGen) return b;
    if (!aGen && bGen) return a;
    if (!aGen && !bGen) {
      // İkisi de rezerve — nadir (iki rezerve isim bir grupta birleşmeye çalışıyor).
      // Sırala ve join.
      const [lo, hi] = [a, b].sort();
      return `${lo}_${hi}`;
    }
    // İkisi generic — ilki tutulur (stabil).
    return a;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onKeyDown);
  }

  // ─── Sprint 1.2: drag event handler + wire routing ────────────────────

  /** Canvas drag-position event'i: bileşenin yeni layout pozisyonu (snap'lenmiş).
   * Components map güncelle, wire'ları yeniden hesapla.
   *
   * Sprint 2.1: drag BAŞINDA tek snapshot al (ilk drag-position event'i).
   * Sprint 2.4: multi-drag — drag'lenen bileşen selection içindeyse
   * selection'daki TÜM bileşenler aynı dx/dy ile taşınır. recomputeWires'a
   * draggedIds + offset verilir; iki ucu da draggedIds'de olan tellerin
   * via noktaları dx/dy kaydırılır (fast path, rota şekli korunur). */
  private onCanvasDragPosition = (e: Event): void => {
    const { componentId, x, y } = (e as CustomEvent).detail as {
      componentId: string;
      x: number;
      y: number;
    };

    // Drag'lenen bileşenin mevcut konumu → offset
    const dragged = this.layout.components.find((c) => c.id === componentId);
    if (!dragged) return;
    const dx = x - dragged.x;
    const dy = y - dragged.y;
    if (dx === 0 && dy === 0) return;

    // Selection içinde mi? → multi-drag. Değilse sadece o bileşen taşınır.
    const draggedSelected = isComponentSelected(this.selection, componentId);
    const targetIds = draggedSelected
      ? selectedComponentIds(this.selection)
      : [componentId];
    const targetSet = new Set(targetIds);

    // Sprint 2.5 / Bug #6: ilk drag-position event'inde etkilenen bileşenlerin
    // orijinal konumlarını da sakla (Escape iptal için). pushHistory'den ÖNCE
    // çünkü snapshot o konumları yakalamadı (dx/dy henüz uygulanmadı ama map
    // mantığı gereği pre-drag konum bilgimizin bu event'te tuttuğumuz
    // dragged.x/y değeri ile aynı).
    if (!this.dragHistoryPushed) {
      this.pushHistory();
      this.dragHistoryPushed = true;
      this.dragOrigPositions = new Map();
      for (const c of this.layout.components) {
        if (targetSet.has(c.id)) {
          this.dragOrigPositions.set(c.id, { x: c.x, y: c.y });
        }
      }
    }

    const components = this.layout.components.map((c) =>
      targetSet.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c,
    );
    const next: CircuitLayout = { ...this.layout, components };
    this.layout = this.recomputeWires(next, targetIds, dx, dy);
  };

  /** Canvas drag-end event'i (Sprint 2.1): drag snapshot flag'ini sıfırla.
   *  Canvas Sprint 1.2'den beri emit ediyordu ama design-mode dinlemiyordu. */
  private onCanvasDragEnd = (): void => {
    this.dragHistoryPushed = false;
    // Sprint 2.5 / Bug #6: drag commit oldu (Escape değil mouseup ile bitti),
    // orijinal pozisyonlar artık gereksiz. Escape senaryosunda cancelDrag
    // tarafından önceden temizleniyordu; normal akışta da burada temizlenir.
    this.dragOrigPositions = null;
  };

  // ─── Sprint 2.3: rubber-band handler'ları ─────────────────────────────

  /** Boş alan mousedown — canvas preventDefault etmiş, click gelmeyecek.
   *  Armed duruma geç, baseSelection'ı dondur. */
  private onCanvasRubberBandStart = (e: Event): void => {
    const { x, y, shiftKey } = (e as CustomEvent).detail as {
      x: number;
      y: number;
      shiftKey: boolean;
    };
    this.rubberBand = {
      phase: 'armed',
      startX: x,
      startY: y,
      shiftKey,
      baseSelection: this.selection,
    };
  };

  /** Rubber-band fare hareketi. Armed'de 5px eşik kontrolü → active.
   *  Active ise kutu içindeki bileşenleri hesapla + selection'ı güncelle. */
  private onCanvasRubberBandMove = (e: Event): void => {
    if (this.rubberBand.phase === 'idle') return;
    const { x, y } = (e as CustomEvent).detail as { x: number; y: number };

    if (this.rubberBand.phase === 'armed') {
      if (!shouldActivateRubberBand(this.rubberBand, x, y)) return;
      this.rubberBand = {
        ...this.rubberBand,
        phase: 'active',
        currentX: x,
        currentY: y,
      };
    } else {
      this.rubberBand = { ...this.rubberBand, currentX: x, currentY: y };
    }

    // Active durumda: kutu içindeki bileşenleri selection'a yaz.
    if (this.rubberBand.phase === 'active') {
      const rect = rubberBandRect(this.rubberBand);
      const canvasRect = this.canvasRectOrZero();
      const idsInBox = componentsInRect(
        rect,
        this.layout,
        this.circuit,
        canvasRect.width / 2,
        canvasRect.height / 2,
      );

      if (this.rubberBand.shiftKey) {
        // Shift+drag: baseSelection + kutu içindekiler union
        this.selection = this.unionSelectionWithIds(
          this.rubberBand.baseSelection,
          idsInBox,
        );
      } else {
        this.selection = this.idsToSelection(idsInBox);
      }
    }
  };

  /** Mouseup — drag bitti. Active'de selection zaten güncel, sadece state
   *  temizle. Armed'de (eşik aşılmadı) click davranışını taklit et — Sprint 1.1
   *  boş alan click: shift yoksa selection temizle, shift varsa koru. */
  private onCanvasRubberBandEnd = (): void => {
    if (this.rubberBand.phase === 'armed') {
      if (!this.rubberBand.shiftKey) {
        this.selection = INITIAL_SELECTION;
      }
      // shift varsa baseSelection zaten korundu (hiç değişmedi)
    }
    // Active'de zaten rubber-band-move'da selection güncellendi.
    this.rubberBand = INITIAL_RUBBER_BAND;
  };

  /** ID listesi → en uygun Selection tipi. 0 → none, 1 → component, 2+ → multi. */
  private idsToSelection(ids: string[]): Selection {
    if (ids.length === 0) return { type: 'none' };
    if (ids.length === 1) return { type: 'component', id: ids[0]! };
    return { type: 'multi', componentIds: ids };
  }

  /** baseSelection (component/multi/wire/none) + yeni ID'ler union.
   *  Wire tipi rubber-band baseSelection olsa bile kaybolur çünkü
   *  rubber-band sadece bileşen seçer. Bu kabul — kullanıcı tel seçili iken
   *  rubber-band başlatınca bilindik bir trade-off. */
  private unionSelectionWithIds(base: Selection, add: string[]): Selection {
    const baseIds = selectedComponentIds(base);
    const merged = Array.from(new Set([...baseIds, ...add]));
    return this.idsToSelection(merged);
  }

  /** Canvas DOM element'in boyutları — rubber-band koordinat dönüşümünde
   *  lazım. Canvas shadow DOM içinde; bu element'in shadowRoot'undan
   *  <vxa-canvas> → shadowRoot → canvas yolunu izle. */
  private canvasRectOrZero(): { width: number; height: number } {
    const canvasEl = this.shadowRoot
      ?.querySelector('vxa-canvas')
      ?.shadowRoot?.querySelector('canvas');
    if (!canvasEl) return { width: 0, height: 0 };
    return {
      width: canvasEl.clientWidth,
      height: canvasEl.clientHeight,
    };
  }

  /** Tüm wire'lar için via ara noktalarını yeniden hesapla.
   *  Layout-merkez-relative koordinatlar; render world'e çevirir.
   *
   *  Sprint 2.4 fast path: draggedIds + dx + dy verilirse iki ucu da
   *  draggedIds içinde olan tellerin via noktaları dx/dy kaydırılır
   *  (routeWire çağrılmaz). Böylece multi-drag'de rota şekli korunur +
   *  performans kazanılır. Tek ucu dragged olan teller smart re-route
   *  (Sprint 1.2 davranışı); hiç dragged olmayan teller aynen kalır. */
  private recomputeWires(
    layout: CircuitLayout,
    draggedIds?: readonly string[],
    dx?: number,
    dy?: number,
  ): CircuitLayout {
    // Tüm bileşenlerin layout-relative AABB + 8 px padding (tel nefes alsın)
    const TEL_PAD = 8;
    const compAabbs = layout.components
      .map((c) => {
        const comp = this.circuit.components.find((x) => x.id === c.id);
        if (!comp) return null;
        const bounds = COMPONENT_BOUNDS[comp.type] ?? DEFAULT_BOUNDS;
        const isRot = c.rotation === 90 || c.rotation === 270;
        const hw = isRot ? bounds.halfHeight : bounds.halfWidth;
        const hh = isRot ? bounds.halfWidth : bounds.halfHeight;
        return {
          id: c.id,
          aabb: {
            x1: c.x - hw - TEL_PAD,
            y1: c.y - hh - TEL_PAD,
            x2: c.x + hw + TEL_PAD,
            y2: c.y + hh + TEL_PAD,
          },
        };
      })
      .filter((x): x is { id: string; aabb: NonNullable<typeof x>['aabb'] } => x !== null);

    // Sprint 2.4: multi-drag fast path hazırlığı — draggedIds + offset verilmişse
    // iki ucu da hareket eden tellerin via'larını kaydır, routeWire çağrısız.
    const hasFastPath =
      draggedIds !== undefined &&
      dx !== undefined &&
      dy !== undefined &&
      draggedIds.length > 0;
    const draggedSet = hasFastPath ? new Set(draggedIds) : null;

    const wires = layout.wires.map((wire) => {
      // Fast path: iki ucu da drag grubunda → via dx/dy kaydır, rota şekli aynen.
      if (hasFastPath && draggedSet) {
        const fromIn =
          wire.from.kind === 'terminal' && draggedSet.has(wire.from.componentId);
        const toIn =
          wire.to.kind === 'terminal' && draggedSet.has(wire.to.componentId);
        if (fromIn && toIn) {
          return {
            ...wire,
            via: (wire.via ?? []).map((p) => ({ x: p.x + dx!, y: p.y + dy! })),
          };
        }
      }

      // Normal path: routeWire ile smart re-route.
      const from = this.resolveEndpoint(wire.from, layout);
      const to = this.resolveEndpoint(wire.to, layout);

      // Bu wire'ın bağlı olduğu bileşenler engel sayılmasın
      const exclude = new Set<string>();
      if (wire.from.kind === 'terminal') exclude.add(wire.from.componentId);
      if (wire.to.kind === 'terminal') exclude.add(wire.to.componentId);
      const obstacles = compAabbs
        .filter((x) => !exclude.has(x.id))
        .map((x) => x.aabb);

      const route = routeWire(from, to, obstacles);
      return { ...wire, via: route.via };
    });

    return { ...layout, wires };
  }

  private resolveEndpoint(ep: WireEndpoint, layout: CircuitLayout): Point {
    if (ep.kind === 'fixed') return { x: ep.x, y: ep.y };
    const placement = layout.components.find((c) => c.id === ep.componentId);
    if (!placement) return { x: 0, y: 0 };
    // Sprint 1.3: this.circuit (dinamik), RC_LOWPASS değil — yeni bileşenler
    // için de tipi bulabilsin.
    const comp = this.circuit.components.find((c) => c.id === ep.componentId);
    const compType = comp?.type ?? 'R';
    return resolveTerminalLocal(
      { x: placement.x, y: placement.y, rotation: placement.rotation },
      compType,
      ep.terminal,
    );
  }

  override async firstUpdated(): Promise<void> {
    // Sprint 1.2: ilk yüklemede wire via noktalarını hesapla (terminal-ref
    // formatı bittikten sonra layout'ta henüz via yok).
    this.layout = this.recomputeWires(this.layout);

    // Sprint 0.7: tek çağrı ile transient al. Son örnek = DC steady-state
    // yerine geçiyor → inspector ve canvas probe'ları aynı snapshot'tan.
    try {
      const transient = await solveTransient({
        circuit: this.circuit,
        dt: RC_TRANSIENT_DT,
        duration: RC_TRANSIENT_DURATION,
        probeNodes: this.getAllNonGroundNodes(),
      });
      if (transient.success) {
        const snapshot = snapshotFromTransient(transient, this.circuit, -1);
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

    // Sprint 2.5 / Bug #3: boş devre — stale snapshot göstermek yerine
    // kullanıcıya "bileşen ekle" ipucu. Slot'lar "—", grafik alanı boş.
    if (this.dashboard.kind === 'empty') {
      return html`
        <section class="dashboard-zone dashboard-zone--loading" aria-label="dashboard boş">
          ${this.renderDashboardHeader()}
          <div class="dash-chart" aria-hidden="true">
            <div class="empty-hint">Devre boş · soldaki araçlardan bileşen ekleyin</div>
          </div>
          <div class="dash-slots">
            <div class="slot">
              <span class="slot-title">V_ÇIKIŞ @son</span>
              <span class="slot-value">—</span>
              <span class="slot-sub">bileşen yok</span>
            </div>
            <div class="slot">
              <span class="slot-title">V_GİRİŞ @son</span>
              <span class="slot-value">—</span>
              <span class="slot-sub">bileşen yok</span>
            </div>
            <div class="slot">
              <span class="slot-title">I(R1) @son</span>
              <span class="slot-value">—</span>
              <span class="slot-sub">bileşen yok</span>
            </div>
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
        <vxa-topbar
          .activeMode=${this.activeMode}
          .canUndo=${historyCanUndo(this.history)}
          .canRedo=${historyCanRedo(this.history)}
          @action=${this.onTopbarAction}
        ></vxa-topbar>
      </section>

      <section class="sidebar-zone" aria-label="sidebar">
        <vxa-sidebar
          .activeTool=${this.activeTool}
          @tool-select=${this.onSidebarToolSelect}
        ></vxa-sidebar>
      </section>

      <section class="canvas-zone" aria-label="canvas">
        <vxa-canvas
          .circuit=${this.circuit}
          .layout=${this.layout}
          .solve=${solve}
          .selectedIds=${selectedComponentIds(this.selection)}
          .selectedWireIndex=${this.selection.type === 'wire' ? this.selection.index : null}
          .activeTool=${this.activeTool}
          .wireDraw=${this.wireDraw}
          .rubberBand=${this.rubberBand}
          chromeTitle="DENEY"
          chromeSubtitle="Alçak Geçiren RC Süzgeç · f_c ≈ 15.9 kHz"
          .isPlaying=${true}
          simTime="100.00 µs"
          .zoom=${100}
          @select=${this.onCanvasSelect}
          @drag-position=${this.onCanvasDragPosition}
          @drag-end=${this.onCanvasDragEnd}
          @place-component=${this.onPlaceComponent}
          @terminal-click=${this.onTerminalClick}
          @mouse-move=${this.onCanvasMouseMove}
          @rubber-band-start=${this.onCanvasRubberBandStart}
          @rubber-band-move=${this.onCanvasRubberBandMove}
          @rubber-band-end=${this.onCanvasRubberBandEnd}
        ></vxa-canvas>
      </section>

      <section class="inspector-zone" aria-label="inspector">
        <vxa-inspector
          .selection=${this.selection}
          .circuit=${this.circuit}
          .layout=${this.layout}
          .solveResult=${solve}
        ></vxa-inspector>
      </section>

      ${this.renderDashboard()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-design-mode': VxaDesignMode;
  }
}
