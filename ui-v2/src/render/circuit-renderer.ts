// VoltXAmpere v2 — devre render orkestratörü (Sprint 0.5 + 0.6).
//
// CircuitDef + CircuitLayout + SolveResult alır, Canvas 2D context'e çizer.
// Katman sırası (alt → üst):
//   teller → toprak → bileşenler → label'ler → seçim çerçevesi → probe'lar.
//
// Layout koordinatları "canvas merkezine göre relative". Renderer canvas
// merkezini (cssW/2, cssH/2) ekleyip dünya koordinatına çevirir. Böylece
// canvas resize olunca devre otomatik yeni merkeze kayar.
//
// Sprint 0.6: selectionId parametresi. Seçili bileşenin sembol + label rengi
// --accent olur, çevresine dashed frame çizilir.
import type { CircuitDef, ComponentType, SolveResult } from '../bridge/engine.ts';
import type { Point, RenderColors } from './helpers.ts';
import { drawWire, type WireSpec } from './symbols/wire.ts';
import { drawGround } from './symbols/ground.ts';
import { drawResistor, drawResistorLabels } from './symbols/resistor.ts';
import { drawCapacitor, drawCapacitorLabels } from './symbols/capacitor.ts';
import {
  drawVoltageSource,
  drawVoltageSourceLabels,
} from './symbols/voltage-source.ts';
import { drawProbe, type ProbeDrawSpec, type ProbeTone } from './symbols/probe.ts';
import { formatVoltage } from '../util/format.ts';
import {
  resolveTerminalLocal,
  TERMINAL_ORDER,
} from '../interaction/component-terminals.ts';
import type { WireDrawState } from '../interaction/wire-draw.ts';
import { routeWire } from '../interaction/wire-router.ts';

export type Rotation = 0 | 90 | 180 | 270;

export interface ComponentPlacement {
  id: string;
  x: number;
  y: number;
  rotation: Rotation;
  displayValue: string;
}

/** Sprint 1.2 — wire endpoint iki türde:
 *   - terminal: bileşen id + terminal adı (bileşen taşındıkça takip eder)
 *   - fixed:    sabit layout-merkez-relative nokta (GND'ler) */
export type WireEndpoint =
  | { kind: 'terminal'; componentId: string; terminal: string }
  | { kind: 'fixed'; x: number; y: number };

export interface WireLayout {
  from: WireEndpoint;
  to: WireEndpoint;
  /** Manhattan rota ara köşe noktaları (layout merkez-relative).
   * design-mode state'te cache — her drag sonrası yeniden hesaplanır. */
  via?: Point[];
}

export interface ProbePlacement {
  node: string;
  pin: Point;
  box: Point;
  label: string;
  tone: ProbeTone;
}

export interface CircuitLayout {
  components: ComponentPlacement[];
  wires: WireLayout[];
  grounds: Point[];
  probes: ProbePlacement[];
}

// ─── Sembol bounding box (rotation 0 referans) ───────────────────────────────
// Sembol dosyalarındaki sabitlerin elle türetilmiş özet tablosu. Bileşene yeni
// bir sembol eklendiğinde buraya da bir satır eklenir.
const BBOX_BY_TYPE: Partial<Record<ComponentType, { w: number; h: number }>> = {
  R: { w: 80, h: 20 },  // 80 genişlik + ±10 zigzag amp
  C: { w: 48, h: 24 },  // 2·LEAD + GAP + PLATE_LEN yatay × PLATE_LEN dikey
  V: { w: 70, h: 34 },  // 2·LEAD + 2·RADIUS × 2·RADIUS
};

function bboxFor(type: ComponentType, rotation: Rotation): { w: number; h: number } {
  const base = BBOX_BY_TYPE[type] ?? { w: 40, h: 40 };
  if (rotation === 90 || rotation === 270) {
    return { w: base.h, h: base.w };
  }
  return base;
}

/** Sprint 0.6 — seçili bileşen çerçevesi. Dashed, --accent, 1.2 stroke,
 * bounding box'tan 6 px dışarı padding. Geometry değişmez, sadece vurgu. */
function drawSelectionFrame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  colors: RenderColors,
): void {
  const PAD = 6;
  const x = cx - w / 2 - PAD;
  const y = cy - h / 2 - PAD;
  ctx.save();
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, w + PAD * 2, h + PAD * 2);
  ctx.restore();
}

/** Sprint 1.3 — placement ghost preview. Canvas bu parametreyi doldurursa
 * normal bileşenlerden sonra yarı saydam amber ghost çizilir. */
export interface GhostSpec {
  type: ComponentType;
  x: number;
  y: number;
}

/** Ghost saydamlık — placement modunda yarı görünür. */
const GHOST_ALPHA = 0.45;

/** Sprint 1.4 — hover'da bileşen terminal marker'ı boyutu. */
const TERMINAL_MARKER_RADIUS = 4;
/** Preview tel alfa'sı. */
const PREVIEW_WIRE_ALPHA = 0.6;

export function drawCircuit(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  circuit: CircuitDef,
  layout: CircuitLayout,
  solve: SolveResult | null,
  colors: RenderColors,
  /** Sprint 2.2: seçili bileşen ID'leri. Tek seçim tek elemanlı array, multi
   *  N elemanlı, none boş array. */
  selectedIds: readonly string[],
  hoveredId?: string | null,
  ghost?: GhostSpec,
  wireDraw?: WireDrawState,
  /** Sprint 1.5: seçili telin indeksi (varsa). Selection tipi 'wire' ise. */
  selectedWireIndex?: number | null,
  /** Sprint 1.5: hover edilen telin indeksi. */
  hoveredWireIndex?: number | null,
): void {
  const cx = cssW / 2;
  const cy = cssH / 2;
  const world = (p: Point): Point => ({ x: cx + p.x, y: cy + p.y });

  // ─── 1) Teller ──────────────────────────────────────────────────────────
  // Sprint 1.2: WireEndpoint resolve — terminal referansı ise bileşen
  // konumundan hesapla, fixed ise direkt kullan. via layout'ta cached.
  const resolveEndpoint = (ep: WireEndpoint): Point => {
    if (ep.kind === 'fixed') {
      return world({ x: ep.x, y: ep.y });
    }
    const placement = layout.components.find((c) => c.id === ep.componentId);
    if (!placement) {
      // Güvenli fallback — eksik bileşen durumunda (0,0) layoutta
      return world({ x: 0, y: 0 });
    }
    const comp = circuit.components.find((c) => c.id === ep.componentId);
    const compType = comp?.type ?? 'R';
    const local = resolveTerminalLocal(
      { x: placement.x, y: placement.y, rotation: placement.rotation },
      compType,
      ep.terminal,
    );
    return world(local);
  };

  for (let i = 0; i < layout.wires.length; i++) {
    const w = layout.wires[i]!;
    const ws: WireSpec = {
      from: resolveEndpoint(w.from),
      to: resolveEndpoint(w.to),
      via: w.via?.map(world),
    };
    const isSelected = selectedWireIndex === i;
    const isHovered = hoveredWireIndex === i;
    drawWire(ctx, ws, colors, { isSelected, isHovered });
  }

  // ─── 2) Toprak sembolleri ────────────────────────────────────────────────
  for (const g of layout.grounds) {
    ctx.save();
    ctx.translate(cx + g.x, cy + g.y);
    drawGround(ctx, colors);
    ctx.restore();
  }

  // ─── 3) Bileşen gövdeleri (rotate edilir) ────────────────────────────────
  for (const p of layout.components) {
    const comp = circuit.components.find((c) => c.id === p.id);
    if (!comp) continue;
    const isSelected = selectedIds.includes(p.id);
    const isHovered = hoveredId === p.id;
    ctx.save();
    ctx.translate(cx + p.x, cy + p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    switch (comp.type) {
      case 'R':
        drawResistor(ctx, colors, isSelected, isHovered);
        break;
      case 'C':
        drawCapacitor(ctx, colors, isSelected, isHovered);
        break;
      case 'V':
        drawVoltageSource(ctx, colors, isSelected, isHovered);
        break;
      // L / D / Z / BJT / MOS / OA — Sprint 0.7+ sembolleri eklenecek.
    }
    ctx.restore();
  }

  // ─── 4) Bileşen etiketleri (rotation uygulanmaz — düz okunur) ────────────
  for (const p of layout.components) {
    const comp = circuit.components.find((c) => c.id === p.id);
    if (!comp) continue;
    const isSelected = selectedIds.includes(p.id);
    const center: Point = { x: cx + p.x, y: cy + p.y };
    switch (comp.type) {
      case 'R':
        drawResistorLabels(ctx, center, p.rotation, p.id, p.displayValue, colors, isSelected);
        break;
      case 'C':
        drawCapacitorLabels(ctx, center, p.rotation, p.id, p.displayValue, colors, isSelected);
        break;
      case 'V':
        drawVoltageSourceLabels(ctx, center, p.rotation, p.id, p.displayValue, colors, isSelected);
        break;
    }
  }

  // ─── 5) Seçim çerçeveleri (multi için tüm seçili bileşenlerin etrafı) ────
  for (const selId of selectedIds) {
    const placement = layout.components.find((p) => p.id === selId);
    const comp = circuit.components.find((c) => c.id === selId);
    if (placement && comp && BBOX_BY_TYPE[comp.type]) {
      const { w, h } = bboxFor(comp.type, placement.rotation);
      drawSelectionFrame(ctx, cx + placement.x, cy + placement.y, w, h, colors);
    }
  }

  // ─── 6) Probe'lar (üst katman) — solver başarılıysa + node hâlâ aktif ─
  //   Sprint 2.5 / Bug #5: probe.node artık hiçbir bileşene bağlı değilse
  //   (silme sonrası orphan) probe'u çizme. Canvas'ta asılı probe kutusu
  //   + orphan pin daireleri kullanıcıyı yanıltıyordu. Topoloji kontrolü
  //   basit: en az bir bileşenin nodes[]'ında geçiyor mu?
  if (solve && solve.success) {
    const activeNodes = new Set<string>();
    for (const c of circuit.components) {
      for (const n of c.nodes) activeNodes.add(n);
    }
    for (const pr of layout.probes) {
      if (!activeNodes.has(pr.node)) continue; // orphan probe — atla
      const voltage = solve.nodeVoltages[pr.node] ?? 0;
      const spec: ProbeDrawSpec = {
        pin: world(pr.pin),
        box: world(pr.box),
        label: pr.label,
        value: formatVoltage(voltage),
        tone: pr.tone,
      };
      drawProbe(ctx, spec, colors);
    }
  }

  // ─── 6.5) Terminal marker'ları (Sprint 1.4) ─────────────────────────────
  // Hover edilen bileşenin terminalleri küçük amber daire + glow. Tel
  // modundayken kaynak bileşenin terminalleri de belirgin kalır.
  const terminalHighlightIds = new Set<string>();
  if (hoveredId) terminalHighlightIds.add(hoveredId);
  if (wireDraw?.phase === 'started') {
    terminalHighlightIds.add(wireDraw.from.componentId);
  }
  if (terminalHighlightIds.size > 0) {
    for (const p of layout.components) {
      if (!terminalHighlightIds.has(p.id)) continue;
      const comp = circuit.components.find((c) => c.id === p.id);
      if (!comp) continue;
      const terms = TERMINAL_ORDER[comp.type];
      if (!terms) continue;
      ctx.save();
      for (const t of terms) {
        const local = resolveTerminalLocal(
          { x: p.x, y: p.y, rotation: p.rotation },
          comp.type,
          t,
        );
        const wp = world(local);
        // Glow pass — hafif halo
        ctx.shadowBlur = 8;
        ctx.shadowColor = colors.accent;
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, TERMINAL_MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ─── 6.6) Preview tel (Sprint 1.4) — tel modundayken ────────────────────
  if (wireDraw?.phase === 'started') {
    const fromWorld = world(wireDraw.fromPoint);
    const toWorld = world(wireDraw.previewTo);
    // Obstacles: tüm bileşen AABB'leri (kaynak bileşen hariç — kendi
    // terminalinden tel çıkıyor).
    const obstacles: {x1:number;y1:number;x2:number;y2:number}[] = [];
    for (const p of layout.components) {
      if (p.id === wireDraw.from.componentId) continue;
      const comp = circuit.components.find((c) => c.id === p.id);
      if (!comp) continue;
      // Basit AABB — Sprint 1.2'deki hesaplama (layout relative, +8 padding)
      const BBOX_PAD = 8;
      const H_MAP: Record<string, { w: number; h: number }> = {
        R: { w: 80, h: 28 }, C: { w: 48, h: 28 }, V: { w: 70, h: 36 },
      };
      const base = H_MAP[comp.type] ?? { w: 40, h: 40 };
      const isRot = p.rotation === 90 || p.rotation === 270;
      const hw = (isRot ? base.h : base.w) / 2 + BBOX_PAD;
      const hh = (isRot ? base.w : base.h) / 2 + BBOX_PAD;
      obstacles.push({
        x1: cx + p.x - hw, y1: cy + p.y - hh,
        x2: cx + p.x + hw, y2: cy + p.y + hh,
      });
    }
    const route = routeWire(fromWorld, toWorld, obstacles);
    ctx.save();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = PREVIEW_WIRE_ALPHA;
    ctx.beginPath();
    ctx.moveTo(fromWorld.x, fromWorld.y);
    for (const v of route.via) ctx.lineTo(v.x, v.y);
    ctx.lineTo(toWorld.x, toWorld.y);
    ctx.stroke();
    ctx.restore();
  }

  // ─── 7) Ghost preview (Sprint 1.3) — en üstte, yarı saydam ──────────────
  // Rotation 0, seçim çerçevesi ve label yok. İsSelected=true ile accent
  // rengi; globalAlpha ile saydamlık. Mevcut sembol fonksiyonları yeniden
  // kullanılıyor.
  if (ghost) {
    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.translate(cx + ghost.x, cy + ghost.y);
    switch (ghost.type) {
      case 'R':
        drawResistor(ctx, colors, true, false);
        break;
      case 'C':
        drawCapacitor(ctx, colors, true, false);
        break;
      case 'V':
        drawVoltageSource(ctx, colors, true, false);
        break;
      // Diğer tipler Sprint 1.x+ sembolleriyle gelecek
    }
    ctx.restore();
  }
}
