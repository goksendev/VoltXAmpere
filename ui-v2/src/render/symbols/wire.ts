// VoltXAmpere v2 — tel sembolü (Sprint 0.5).
//
// Manhattan routing: from → (via noktaları) → to. Sadece 90° köşeler.
// lineCap/Join round — köşelerde yumuşak geçiş, ince stroke.
// Renderer tel çizimini world coord'da çağırır (rotate/translate YOK).
//
// Sprint 1.5: isHovered / isSelected state — bileşen sembolleriyle aynı
// disiplin. Seçili → accent, hover → fg, default → wire.
import type { Point, RenderColors } from '../helpers.ts';

// Tel stroke kalınlığı — plan: 1.5 px. Yeterince belirgin ama bileşen
// stroke'larından (1.8-2.6) hafif daha ince olacak şekilde.
const WIRE_STROKE = 1.5;
/** Seçili/hover tel stroke kalınlığı — az daha kalın ki state belirgin olsun. */
const WIRE_STROKE_ACTIVE = 2.0;

export interface WireSpec {
  from: Point;
  to: Point;
  /** Ara köşe noktaları (Manhattan). Sıralı — from'dan to'ya doğru. */
  via?: Point[];
}

export interface WireRenderState {
  isSelected: boolean;
  isHovered: boolean;
}

function resolveWireColor(
  colors: RenderColors,
  state: WireRenderState,
): string {
  if (state.isSelected) return colors.accent;
  if (state.isHovered) return colors.fg;
  return colors.wire;
}

export function drawWire(
  ctx: CanvasRenderingContext2D,
  wire: WireSpec,
  colors: RenderColors,
  state: WireRenderState = { isSelected: false, isHovered: false },
): void {
  const active = state.isSelected || state.isHovered;
  ctx.strokeStyle = resolveWireColor(colors, state);
  ctx.lineWidth = active ? WIRE_STROKE_ACTIVE : WIRE_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(wire.from.x, wire.from.y);
  if (wire.via) {
    for (const p of wire.via) ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(wire.to.x, wire.to.y);
  ctx.stroke();
}
