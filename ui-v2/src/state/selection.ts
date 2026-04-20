// VoltXAmpere v2 — seçim modeli (Sprint 0.6).
//
// Tek bileşen seçimi. Multi-select Sprint 1.x; wire seçimi Sprint 0.7+.
// Sprint 0.6'da selection canvas click'ten GELMIYOR — hard-coded "R1".
// Sprint 0.7'de event-driven hale gelecek.

export interface Selection {
  type: 'component' | 'wire' | 'none';
  /** component id ('R1', 'V1') veya wire id ('wire-0'). Tipi 'none' ise undefined. */
  id?: string;
}

/** Sprint 1.1: sayfa açılışında hiçbir şey seçili değil. Kullanıcı canvas'a
 * tıklayınca bileşen seçer. Sprint 0.6'daki hard-coded 'R1' başlangıcı
 * Faz 2A'da kaldırıldı — gerçek kullanım senaryosu. */
export const INITIAL_SELECTION: Selection = {
  type: 'none',
};
