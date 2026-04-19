// VoltXAmpere v2 — devre render orkestratörü (Sprint 0.5).
//
// CircuitDef + CircuitLayout + SolveResult alır, Canvas 2D context'e çizer.
// Katman sırası (alt → üst): teller → toprak → bileşenler → label'ler → probe'lar.
//
// Layout koordinatları "canvas merkezine göre relative". Renderer canvas
// merkezini (cssW/2, cssH/2) ekleyip dünya koordinatına çevirir. Böylece
// canvas resize olunca devre otomatik yeni merkeze kayar.
import type { CircuitDef, SolveResult } from '../bridge/engine.ts';
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
import { formatVolt } from '../util/format.ts';

export type Rotation = 0 | 90 | 180 | 270;

/** Bir bileşenin canvas yerleşimi — circuit'ten id referansıyla bağlanır. */
export interface ComponentPlacement {
  id: string;
  /** Canvas merkezine göre relative. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Sembol yanında gösterilecek değer etiketi — "1 kΩ" / "10 nF" / "5 V". */
  displayValue: string;
}

export interface WireLayout {
  from: Point;
  to: Point;
  via?: Point[];
}

export interface ProbePlacement {
  /** CircuitDef.nodes'da tanımlı bir düğüm adı. */
  node: string;
  /** Ölçme noktası (canvas merkezine göre). */
  pin: Point;
  /** Etiket kutusu merkezi. */
  box: Point;
  /** Başlık — "V_GİRİŞ" vb. */
  label: string;
  /** Renk tonu — tokens.css'e göre etkilenen vurgu. */
  tone: ProbeTone;
}

export interface CircuitLayout {
  components: ComponentPlacement[];
  wires: WireLayout[];
  grounds: Point[];
  probes: ProbePlacement[];
}

export function drawCircuit(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  circuit: CircuitDef,
  layout: CircuitLayout,
  solve: SolveResult | null,
  colors: RenderColors,
): void {
  const cx = cssW / 2;
  const cy = cssH / 2;
  const world = (p: Point): Point => ({ x: cx + p.x, y: cy + p.y });

  // ─── 1) Teller ──────────────────────────────────────────────────────────
  for (const w of layout.wires) {
    const ws: WireSpec = {
      from: world(w.from),
      to: world(w.to),
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
    ctx.save();
    ctx.translate(cx + p.x, cy + p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    switch (comp.type) {
      case 'R':
        drawResistor(ctx, colors);
        break;
      case 'C':
        drawCapacitor(ctx, colors);
        break;
      case 'V':
        drawVoltageSource(ctx, colors);
        break;
      // L / D / Z / BJT / MOS / OA — Sprint 0.6+ sembolleri eklenecek.
    }
    ctx.restore();
  }

  // ─── 4) Bileşen etiketleri (rotation uygulanmaz — düz okunur) ────────────
  for (const p of layout.components) {
    const comp = circuit.components.find((c) => c.id === p.id);
    if (!comp) continue;
    const center: Point = { x: cx + p.x, y: cy + p.y };
    switch (comp.type) {
      case 'R':
        drawResistorLabels(ctx, center, p.rotation, p.id, p.displayValue, colors);
        break;
      case 'C':
        drawCapacitorLabels(ctx, center, p.rotation, p.id, p.displayValue, colors);
        break;
      case 'V':
        drawVoltageSourceLabels(ctx, center, p.rotation, p.id, p.displayValue, colors);
        break;
    }
  }

  // ─── 5) Probe'lar (solver sonucu yoksa çizme — plan "fake değer yok") ────
  if (!solve || !solve.success) return;
  for (const pr of layout.probes) {
    const voltage = solve.nodeVoltages[pr.node] ?? 0;
    const spec: ProbeDrawSpec = {
      pin: world(pr.pin),
      box: world(pr.box),
      label: pr.label,
      value: formatVolt(voltage),
      tone: pr.tone,
    };
    drawProbe(ctx, spec, colors);
  }
}
