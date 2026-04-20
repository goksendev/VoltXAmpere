// VoltXAmpere v2 — hit testing helper'ları (Sprint 1.1).
//
// AABB (axis-aligned bounding box) bazlı nokta-içinde-mi testleri. Saf
// fonksiyonlar — state yok, DOM yok, test edilebilir. 71+ bileşen için linear
// scan O(n) yeterince hızlı (μs seviyesi); spatial index gerekmez.
//
// Koordinat sistemi:
//   AABB — canvas'ın sol-üst köşesinden (0,0) CSS piksel
//   Layout — canvas merkezine göre relative (RC_LOWPASS_LAYOUT semantiği)
//   Dönüşüm: aabbX = centerX + layoutX  (renderer.ts ile simetrik)

export interface AABB {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Bileşenin layout pozisyonundan AABB türet. Rotation 90/270'te halfW/halfH
 * swap edilir — sembol dik döner, bounding box da döner. */
export function componentAABB(
  centerX: number,
  centerY: number,
  comp: { x: number; y: number; rotation: 0 | 90 | 180 | 270 },
  halfWidth: number,
  halfHeight: number,
): AABB {
  const isRotated = comp.rotation === 90 || comp.rotation === 270;
  const hw = isRotated ? halfHeight : halfWidth;
  const hh = isRotated ? halfWidth : halfHeight;
  const cx = centerX + comp.x;
  const cy = centerY + comp.y;
  return { x1: cx - hw, y1: cy - hh, x2: cx + hw, y2: cy + hh };
}

/** Nokta AABB içinde mi? Kenar dahil (inclusive). */
export function pointInAABB(px: number, py: number, aabb: AABB): boolean {
  return px >= aabb.x1 && px <= aabb.x2 && py >= aabb.y1 && py <= aabb.y2;
}

/** Canvas mouse event → CSS piksel koordinatı.
 * `event.offsetX/Y` shadow DOM + DPI scaling'de browser'a göre tutarsız olabilir.
 * `getBoundingClientRect + clientX/Y` her browser'da tutarlı. */
export function mouseToCanvasCoords(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
