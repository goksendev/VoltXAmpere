// VoltXAmpere v2 — tel sembolü (Sprint 0.5).
//
// Manhattan routing: from → (via noktaları) → to. Sadece 90° köşeler.
// lineCap/Join round — köşelerde yumuşak geçiş, ince stroke.
// Renderer tel çizimini world coord'da çağırır (rotate/translate YOK).
import type { Point, RenderColors } from '../helpers.ts';

// Tel stroke kalınlığı — plan: 1.5 px. Yeterince belirgin ama bileşen
// stroke'larından (1.8-2.6) hafif daha ince olacak şekilde.
const WIRE_STROKE = 1.5;

export interface WireSpec {
  from: Point;
  to: Point;
  /** Ara köşe noktaları (Manhattan). Sıralı — from'dan to'ya doğru. */
  via?: Point[];
}

export function drawWire(
  ctx: CanvasRenderingContext2D,
  wire: WireSpec,
  colors: RenderColors,
): void {
  ctx.strokeStyle = colors.wire;
  ctx.lineWidth = WIRE_STROKE;
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
