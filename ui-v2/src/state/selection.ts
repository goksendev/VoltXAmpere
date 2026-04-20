// VoltXAmpere v2 — seçim modeli.
//
// Sprint 0.6: ilk hâl, tek bileşen seçimi (hard-coded 'R1').
// Sprint 1.1: event-driven — canvas click'ten geliyor.
// Sprint 1.5: discriminated union — component + wire + none.
// Sprint 2.2: multi tipi — birden fazla bileşen (Shift+Click toggle).
//
// Tasarım disiplini:
//   - 'multi' en az 2 eleman içermeli. Tek bileşen → 'component'.
//   - 'multi' sadece bileşenleri taşır; teller multi'ye girmez.
//   - Toggle logic'i (design-mode.toggleComponentInSelection) geçişleri
//     garanti eder: none ↔ component ↔ multi.

export type Selection =
  | { type: 'none' }
  | { type: 'component'; id: string }
  | { type: 'wire'; index: number }
  | { type: 'multi'; componentIds: string[] };

/** Sprint 1.1: sayfa açılışında hiçbir şey seçili değil. */
export const INITIAL_SELECTION: Selection = {
  type: 'none',
};

/** Sprint 2.2 — seçimdeki bileşen ID'lerini array olarak döndür.
 *   'component' → [id]
 *   'multi'     → componentIds
 *   'wire' / 'none' → [] */
export function selectedComponentIds(sel: Selection): string[] {
  if (sel.type === 'component') return [sel.id];
  if (sel.type === 'multi') return sel.componentIds;
  return [];
}

/** Sprint 2.2 — bir bileşen ID'si selection'da mı? Renderer her bileşen
 *  için bu helper'ı çağırarak amber çerçeveyi kararlaştırır. */
export function isComponentSelected(sel: Selection, id: string): boolean {
  if (sel.type === 'component') return sel.id === id;
  if (sel.type === 'multi') return sel.componentIds.includes(id);
  return false;
}
