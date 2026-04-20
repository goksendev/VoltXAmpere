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
import { resolveTerminalLocal } from '../interaction/component-terminals.ts';

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

export function drawCircuit(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  circuit: CircuitDef,
  layout: CircuitLayout,
  solve: SolveResult | null,
  colors: RenderColors,
  selectionId?: string,
  hoveredId?: string | null,
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

  for (const w of layout.wires) {
    const ws: WireSpec = {
      from: resolveEndpoint(w.from),
      to: resolveEndpoint(w.to),
      via: w.via?.map(world),
    };
    drawWire(ctx, ws, colors);
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
    const isSelected = selectionId === p.id;
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
    const isSelected = selectionId === p.id;
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

  // ─── 5) Seçim çerçevesi (seçili bileşen varsa) ───────────────────────────
  if (selectionId) {
    const placement = layout.components.find((p) => p.id === selectionId);
    const comp = circuit.components.find((c) => c.id === selectionId);
    if (placement && comp && BBOX_BY_TYPE[comp.type]) {
      const { w, h } = bboxFor(comp.type, placement.rotation);
      drawSelectionFrame(ctx, cx + placement.x, cy + placement.y, w, h, colors);
    }
  }

  // ─── 6) Probe'lar (üst katman) — solver başarılıysa ──────────────────────
  if (!solve || !solve.success) return;
  for (const pr of layout.probes) {
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
