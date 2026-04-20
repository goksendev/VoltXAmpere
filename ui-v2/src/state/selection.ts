// VoltXAmpere v2 — seçim modeli.
//
// Sprint 0.6: ilk hâl, tek bileşen seçimi (hard-coded 'R1').
// Sprint 1.1: event-driven — canvas click'ten geliyor.
// Sprint 1.5: discriminated union — component + wire + none.
//             Wire index ile referanslanır (layout.wires[i]); id string
//             kullanmıyoruz çünkü tellerin kalıcı ismi yok, dizi pozisyonu
//             tek kimlik.
//
// Eski `{ type, id? }` formatı Sprint 1.5'te terk edildi — exhaustive
// type narrowing için discriminated union şart.

export type Selection =
  | { type: 'none' }
  | { type: 'component'; id: string }
  | { type: 'wire'; index: number };

/** Sprint 1.1: sayfa açılışında hiçbir şey seçili değil. Kullanıcı canvas'a
 * tıklayınca bileşen veya tel seçer. */
export const INITIAL_SELECTION: Selection = {
  type: 'none',
};
