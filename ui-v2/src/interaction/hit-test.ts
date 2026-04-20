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

// ─── Sprint 1.4: terminal hit testing ──────────────────────────────────────

import {
  COMPONENT_TERMINALS,
  TERMINAL_ORDER,
  resolveTerminalLocal,
  type Point,
  type TerminalRef,
} from './component-terminals.ts';
import type { CircuitDef } from '../bridge/engine.ts';
import type {
  CircuitLayout,
  WireEndpoint,
  WireLayout,
} from '../render/circuit-renderer.ts';

/** Terminal hit radius (CSS piksel) — görsel 4 px ama tıklama alanı 8 px,
 * UX için cömert. */
const TERMINAL_HIT_RADIUS_PX = 8;

/** Circuit component layout bilgisi ile terminalin world koordinatını çöz. */
function terminalWorldPosition(
  placement: { x: number; y: number; rotation: 0 | 90 | 180 | 270 },
  componentType: string,
  terminal: string,
  centerX: number,
  centerY: number,
): { x: number; y: number } | null {
  if (!COMPONENT_TERMINALS[componentType]?.[terminal]) return null;
  const local = resolveTerminalLocal(placement, componentType, terminal);
  return { x: centerX + local.x, y: centerY + local.y };
}

/** Canvas koordinatı (px, py) hangi terminal'e denk geliyor? Daire şeklinde
 * hit test (TERMINAL_HIT_RADIUS_PX). İlk eşleşmeyi döner — reverse iteration
 * yok çünkü terminal'ler bileşen merkezinde değil, kenarlarında; overlap nadir. */
export function hitTestTerminal(
  px: number,
  py: number,
  layout: { components: ReadonlyArray<{ id: string; x: number; y: number; rotation: 0 | 90 | 180 | 270 }> },
  circuitComponents: ReadonlyArray<{ id: string; type: string }>,
  centerX: number,
  centerY: number,
): TerminalRef | null {
  const r2 = TERMINAL_HIT_RADIUS_PX * TERMINAL_HIT_RADIUS_PX;
  for (const placement of layout.components) {
    const comp = circuitComponents.find((c) => c.id === placement.id);
    if (!comp) continue;
    const terms = TERMINAL_ORDER[comp.type];
    if (!terms) continue;
    for (const t of terms) {
      const pos = terminalWorldPosition(placement, comp.type, t, centerX, centerY);
      if (!pos) continue;
      const dx = px - pos.x;
      const dy = py - pos.y;
      if (dx * dx + dy * dy <= r2) {
        return { componentId: placement.id, terminal: t };
      }
    }
  }
  return null;
}

// ─── Sprint 1.5: tel hit testing ───────────────────────────────────────────

/** Tel'e yakınlık eşiği (CSS piksel). Tel stroke'u 1.5 px; 4 px hit alanı
 * kullanıcıya "zor tıklanıyor" demeden rahat hedef verir. */
const WIRE_HIT_RADIUS_PX = 4;

/** Wire endpoint'ini world koordinatına çöz. circuit-renderer içindeki
 * resolveEndpoint mantığının aynısı — ortak util haline getirmek yerine
 * hit-test içinde izole tutuyoruz çünkü render vs hit test farklı iki
 * pipeline. */
function resolveWireEndpointWorld(
  ep: WireEndpoint,
  layout: CircuitLayout,
  circuit: CircuitDef,
  centerX: number,
  centerY: number,
): Point {
  if (ep.kind === 'fixed') {
    return { x: centerX + ep.x, y: centerY + ep.y };
  }
  const placement = layout.components.find((c) => c.id === ep.componentId);
  if (!placement) {
    // Güvenli fallback — bileşen silinmişse telin endpoint'i canvas merkezi.
    // Normalde silme akışı tel'i önce kaldırır, bu dal hit değil.
    return { x: centerX, y: centerY };
  }
  const comp = circuit.components.find((c) => c.id === ep.componentId);
  const compType = comp?.type ?? 'R';
  const local = resolveTerminalLocal(
    { x: placement.x, y: placement.y, rotation: placement.rotation },
    compType,
    ep.terminal,
  );
  return { x: centerX + local.x, y: centerY + local.y };
}

/** Bir telin world koordinat segment'lerini sırayla üretir.
 *  Tel: from → via[0] → via[1] → ... → to. Manhattan rotada 1-3 segment
 *  yaygın. Empty via → tek segment. */
function computeWireSegments(
  wire: WireLayout,
  layout: CircuitLayout,
  circuit: CircuitDef,
  centerX: number,
  centerY: number,
): [Point, Point][] {
  const from = resolveWireEndpointWorld(wire.from, layout, circuit, centerX, centerY);
  const to = resolveWireEndpointWorld(wire.to, layout, circuit, centerX, centerY);
  const points: Point[] = [from];
  if (wire.via) {
    for (const v of wire.via) {
      points.push({ x: centerX + v.x, y: centerY + v.y });
    }
  }
  points.push(to);

  const segments: [Point, Point][] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    segments.push([points[i]!, points[i + 1]!]);
  }
  return segments;
}

/** Klasik "nokta-segment mesafesi" formülü. Segment uzunluğu 0 ise
 * uçtan uzaklık. */
function distanceToSegment(
  px: number,
  py: number,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/** Canvas koordinatı (px, py) hangi telin (layout.wires[i]) üzerinde?
 *  WIRE_HIT_RADIUS_PX eşiğine en yakın ilk tel döner. Tellerin çok overlap
 *  olduğu durum nadir; ilk eşleşme kabul edilir. */
export function hitTestWire(
  px: number,
  py: number,
  layout: CircuitLayout,
  circuit: CircuitDef,
  centerX: number,
  centerY: number,
): number | null {
  for (let i = 0; i < layout.wires.length; i++) {
    const wire = layout.wires[i];
    if (!wire) continue;
    const segments = computeWireSegments(wire, layout, circuit, centerX, centerY);
    for (const [a, b] of segments) {
      if (distanceToSegment(px, py, a, b) <= WIRE_HIT_RADIUS_PX) {
        return i;
      }
    }
  }
  return null;
}
