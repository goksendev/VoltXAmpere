// VoltXAmpere v2 — undo/redo snapshot stack (Sprint 2.1).
//
// Mimari karar: SNAPSHOT-LEVEL (action-level değil). Her undoable action
// öncesi tam circuit + layout kopyası `structuredClone` ile alınır, stack'e
// pushlanır. Ctrl+Z stack top'u restore eder, mevcut state'i future'a iter.
//
// Bu tasarımın avantajı: yeni bir action eklendiğinde undo'ya otomatik girer.
// Dezavantajı: büyük devreler için bellek — 50 × 10 KB = 500 KB. Şimdilik
// kabul edilebilir (Sprint 2.x'te 100+ bileşen olunca immer migrasyonu
// düşünülebilir; ayrı sprint).
//
// History SADECE circuit + layout tutar. UI state (selection, hover,
// activeTool, dragState, wireDraw) history'de DEĞİL — undo sonrası bunlar
// reset edilir. Sebep: undo geri yüklendikten sonra eski selection geçerli
// olmayabilir (silinen bileşen seçiliyse, undo ile geri geldi ama user
// sürekli seçili kalsın mı? Karmaşık. En güvenli: none'a düş).

import type { CircuitDef } from '../bridge/engine.ts';
import type { CircuitLayout } from '../render/circuit-renderer.ts';

/** Bir snapshot: circuit + layout'un tam derin kopyası. */
export interface HistorySnapshot {
  circuit: CircuitDef;
  layout: CircuitLayout;
}

/**
 * History state.
 *   past: geçmiş snapshot'lar (en eski → en yeni). Top (son eleman) bir
 *     sonraki Ctrl+Z ile restore edilecek olan.
 *   future: Ctrl+Z yapıldıktan sonra Ctrl+Shift+Z için bekleyen snapshot'lar
 *     (en yakın → en uzak). First (ilk eleman) bir sonraki Ctrl+Shift+Z.
 *
 * Yeni bir action yapılınca future BOŞALIR — yeni dallanma başladı, eski
 * yineleme yolu artık anlamsız.
 */
export interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

/** Başlangıç history — sayfa açılış. */
export const INITIAL_HISTORY: HistoryState = {
  past: [],
  future: [],
};

/** Maksimum undo adımı. Bellek tüketimini sınırlar. 50 adım tipik bir
 *  editör oturumu için fazlasıyla yeterli (Figma 100 verir, VSCode default
 *  ayarı ~1000 — ama bunlar metin, bizim devre state'i büyük). */
export const HISTORY_LIMIT = 50;

/**
 * Bir circuit + layout'tan derin kopyalı snapshot üret.
 * `structuredClone` iç array'leri, nested object'leri, Map/Set'leri güvenli
 * şekilde kopyalar. Shallow copy ile snapshot almak → later mutation history'i
 * bozar.
 */
export function snapshot(
  circuit: CircuitDef,
  layout: CircuitLayout,
): HistorySnapshot {
  return {
    circuit: structuredClone(circuit),
    layout: structuredClone(layout),
  };
}

/**
 * Yeni bir action yapıldığında çağrılır. Action ÖNCESİ snapshot'ı past'a
 * ekle, future'ı boşalt (yeni dallanma).
 *
 * @param history mevcut history
 * @param previous action öncesi state snapshot'ı
 */
export function pushAction(
  history: HistoryState,
  previous: HistorySnapshot,
): HistoryState {
  const newPast = [...history.past, previous];
  // HISTORY_LIMIT aşılırsa en eski snapshot'ı at (FIFO).
  const trimmed =
    newPast.length > HISTORY_LIMIT
      ? newPast.slice(newPast.length - HISTORY_LIMIT)
      : newPast;
  return {
    past: trimmed,
    future: [],
  };
}

/**
 * Ctrl+Z. Past'tan son snapshot'ı al, mevcut state'i future'a it.
 *
 * @param history mevcut history
 * @param current şu andaki state (future'a pushlanacak — redo için)
 * @returns { newHistory, restored } veya null (past boşsa)
 */
export function undo(
  history: HistoryState,
  current: HistorySnapshot,
): { newHistory: HistoryState; restored: HistorySnapshot } | null {
  if (history.past.length === 0) return null;
  const restored = history.past[history.past.length - 1]!;
  return {
    newHistory: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
    restored,
  };
}

/**
 * Ctrl+Shift+Z (Ctrl+Y). Future'dan ilk snapshot'ı al, mevcut state'i past'a
 * it.
 *
 * @param history mevcut history
 * @param current şu andaki state (past'a pushlanacak)
 * @returns { newHistory, restored } veya null (future boşsa)
 */
export function redo(
  history: HistoryState,
  current: HistorySnapshot,
): { newHistory: HistoryState; restored: HistorySnapshot } | null {
  if (history.future.length === 0) return null;
  const restored = history.future[0]!;
  return {
    newHistory: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
    restored,
  };
}

/** UI için — undo yapılabilir mi? Topbar buton disabled kontrolü (Sprint 2.4). */
export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

/** UI için — redo yapılabilir mi? */
export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}
