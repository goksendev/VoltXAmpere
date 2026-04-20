// VoltXAmpere v2 — rubber-band seçim kutusu (Sprint 2.3).
//
// Üç durumlu FSM (Sprint 1.2 drag FSM pattern'i):
//   idle:   aktif kutu yok.
//   armed:  boş alana mousedown yapıldı, henüz 5px eşik aşılmadı —
//           kullanıcı iptal edebilir (hareketsiz mouseup = boş alana click).
//   active: eşik aşıldı, kutu görünür + fare pozisyonu takip edilir.
//
// baseSelection armed anında DONDURULUYOR — drag boyunca değişmez. Shift+drag
// için kritik: rubber-band-move her adımda baseSelection + kutu içindekiler
// union yapar; eğer baseSelection canlı güncellense "kullanıcının kutudan
// çıkardığı bileşenleri tekrar eklemek" imkansızlaşır.

import type { CircuitDef } from '../bridge/engine.ts';
import type { CircuitLayout } from '../render/circuit-renderer.ts';
import type { Selection } from '../state/selection.ts';
import {
  componentAABB,
  type AABB,
} from './hit-test.ts';
import {
  COMPONENT_BOUNDS,
  DEFAULT_BOUNDS,
} from './component-bounds.ts';

/** 5 CSS piksel — mousedown ile gerçek drag niyeti arasındaki sınır. Sprint 1.2
 *  drag FSM'inde de aynı eşik — kullanıcının "kazara hareket" karışıklığını
 *  engeller. */
export const RUBBER_BAND_THRESHOLD_PX = 5;

export type RubberBandState =
  | { phase: 'idle' }
  | {
      phase: 'armed';
      startX: number;
      startY: number;
      /** Mousedown anındaki shift modifier — drag boyunca sabit. */
      shiftKey: boolean;
      /** Armed öncesi selection. Shift+drag union için referans. */
      baseSelection: Selection;
    }
  | {
      phase: 'active';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      shiftKey: boolean;
      baseSelection: Selection;
    };

export const INITIAL_RUBBER_BAND: RubberBandState = { phase: 'idle' };

/** Kutunun canvas-relative AABB'si. Kullanıcı her yöne çizebilir (sol-üst
 *  başlangıç veya sağ-alt başlangıç); min/max ile normalize ediyoruz. */
export function rubberBandRect(state: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}): AABB {
  return {
    x1: Math.min(state.startX, state.currentX),
    y1: Math.min(state.startY, state.currentY),
    x2: Math.max(state.startX, state.currentX),
    y2: Math.max(state.startY, state.currentY),
  };
}

/** Armed → active geçiş kontrolü. 5px eşiği. Sprint 1.2'nin
 *  `shouldActivateDrag` mantığıyla simetrik. */
export function shouldActivateRubberBand(
  state: { startX: number; startY: number },
  currentX: number,
  currentY: number,
): boolean {
  const dx = currentX - state.startX;
  const dy = currentY - state.startY;
  return (
    dx * dx + dy * dy >
    RUBBER_BAND_THRESHOLD_PX * RUBBER_BAND_THRESHOLD_PX
  );
}

/** İki AABB kesişiyor mu? Standart separating-axis testi. Kenar değerleri
 *  dahil (A.x2 === B.x1 ise overlap). */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

/** Kutu içinde kalan (tam veya kısmi kesişen) bileşen ID'lerini bul.
 *  "Kısmi kesişim" Figma/Sketch davranışı: kullanıcı kutunun kenarına
 *  değmeyen bileşenler dahil değil, ama kutu kenarından geçen bileşenler
 *  dahil. Tam kapsama şartı KOYMAYIZ (çok katı). */
export function componentsInRect(
  rubberRect: AABB,
  layout: CircuitLayout,
  circuit: CircuitDef,
  centerX: number,
  centerY: number,
): string[] {
  const result: string[] = [];
  for (const comp of layout.components) {
    const circuitComp = circuit.components.find((c) => c.id === comp.id);
    if (!circuitComp) continue;
    const bounds = COMPONENT_BOUNDS[circuitComp.type] ?? DEFAULT_BOUNDS;
    const aabb = componentAABB(
      centerX,
      centerY,
      comp,
      bounds.halfWidth,
      bounds.halfHeight,
    );
    if (aabbOverlap(rubberRect, aabb)) {
      result.push(comp.id);
    }
  }
  return result;
}
