// VoltXAmpere v2 — tel rotalama (Sprint 1.2).
//
// Smart heuristic: L → U → fallback+warn. A* değil.
//   1) Düz çizgi (aynı x veya y).
//   2) L-şekli 2 seçenek (yatay-sonra-dikey, dikey-sonra-yatay). Engel
//      kesmeyen ilk seçenek kazanır.
//   3) U-şekli 4 yön (üst/alt/sol/sağ ofset 24 px). Engel kesmeyen ilk.
//   4) Fallback: düz L-şekli + console.warn. Kullanıcı görsün ki bildirsin.
import type { AABB } from './hit-test.ts';
import type { Point } from './component-terminals.ts';

export interface WireRoute {
  /** from ve to hariç ara köşe noktaları. Düz çizgi ise boş. */
  via: Point[];
}

/** U-şekli fallback'te kullanılacak ofset miktarı (CSS piksel). */
const U_OFFSET = 24;

/** Yatay veya dikey segment'in bir AABB ile kesişip kesişmediği.
 *  Manhattan teller olduğundan segment'ler eksen-hizalı. */
function segmentIntersectsAABB(a: Point, b: Point, box: AABB): boolean {
  // Yatay segment (a.y === b.y)
  if (a.y === b.y) {
    const y = a.y;
    if (y < box.y1 || y > box.y2) return false;
    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    return xMax >= box.x1 && xMin <= box.x2;
  }
  // Dikey segment (a.x === b.x)
  if (a.x === b.x) {
    const x = a.x;
    if (x < box.x1 || x > box.x2) return false;
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    return yMax >= box.y1 && yMin <= box.y2;
  }
  // Diyagonal — Manhattan'da olmamalı; skip.
  return false;
}

export function segmentIntersectsAny(a: Point, b: Point, boxes: AABB[]): boolean {
  for (const box of boxes) {
    if (segmentIntersectsAABB(a, b, box)) return true;
  }
  return false;
}

function pathClear(points: Point[], obstacles: AABB[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentIntersectsAny(points[i]!, points[i + 1]!, obstacles)) {
      return false;
    }
  }
  return true;
}

export function routeWire(
  from: Point,
  to: Point,
  obstacles: AABB[],
): WireRoute {
  // 1) Düz çizgi
  if (from.x === to.x || from.y === to.y) {
    return { via: [] };
  }

  // 2) L-şekli seçenek 1 — önce yatay, sonra dikey
  const cornerHV: Point = { x: to.x, y: from.y };
  if (pathClear([from, cornerHV, to], obstacles)) {
    return { via: [cornerHV] };
  }

  // 3) L-şekli seçenek 2 — önce dikey, sonra yatay
  const cornerVH: Point = { x: from.x, y: to.y };
  if (pathClear([from, cornerVH, to], obstacles)) {
    return { via: [cornerVH] };
  }

  // 4) U-şekli 4 yön (from'un dışarı çıkışı olarak düşün)
  const uAttempts: Point[][] = [
    // Üst U: from → yukarı → to x'e yatay → aşağı to
    [
      { x: from.x, y: from.y - U_OFFSET },
      { x: to.x, y: from.y - U_OFFSET },
    ],
    // Alt U
    [
      { x: from.x, y: from.y + U_OFFSET },
      { x: to.x, y: from.y + U_OFFSET },
    ],
    // Sol U
    [
      { x: from.x - U_OFFSET, y: from.y },
      { x: from.x - U_OFFSET, y: to.y },
    ],
    // Sağ U
    [
      { x: from.x + U_OFFSET, y: from.y },
      { x: from.x + U_OFFSET, y: to.y },
    ],
  ];
  for (const via of uAttempts) {
    const path = [from, ...via, to];
    if (pathClear(path, obstacles)) {
      return { via };
    }
  }

  // 5) Fallback — düz L, kullanıcı görür ki bildirsin
  console.warn(
    `[wire-router] rota bulunamadı, fallback L-şekli. from=${JSON.stringify(from)} to=${JSON.stringify(to)}`,
  );
  return { via: [cornerHV] };
}
