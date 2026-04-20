// VoltXAmpere v2 — drag state machine (Sprint 1.2).
//
// Küçük FSM — idle / armed / active. Mousedown "armed" yapar, eşik
// aşılınca "active"'e geçer. Saf fonksiyonlar: DOM bilmez, state tutmaz;
// caller (canvas.ts) @state olarak saklar.

export type DragState =
  | { phase: 'idle' }
  | {
      phase: 'armed';
      componentId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      phase: 'active';
      componentId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    };

export const INITIAL_DRAG: DragState = { phase: 'idle' };

/** Drag "gerçekten başladı" eşiği — tıklama kazasından ayırır. */
export const DRAG_THRESHOLD_PX = 5;

/** Canvas grid aralığı — Sprint 0.3 minor grid ile aynı. */
export const SNAP_GRID_PX = 16;

/** En yakın grid noktasına yapıştır. */
export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_GRID_PX) * SNAP_GRID_PX;
}

/** Armed → active geçişi için eşik kontrolü. */
export function shouldActivateDrag(
  state: DragState,
  currentX: number,
  currentY: number,
): boolean {
  if (state.phase !== 'armed') return false;
  const dx = currentX - state.startX;
  const dy = currentY - state.startY;
  return dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}

/** Active drag'te bileşenin yeni layout (merkez-relative) pozisyonu. */
export function computeDraggedPosition(
  state: Extract<DragState, { phase: 'active' }>,
  currentX: number,
  currentY: number,
): { x: number; y: number } {
  const dx = currentX - state.startX;
  const dy = currentY - state.startY;
  return {
    x: snapToGrid(state.origX + dx),
    y: snapToGrid(state.origY + dy),
  };
}
