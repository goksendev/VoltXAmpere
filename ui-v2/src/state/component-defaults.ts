// VoltXAmpere v2 — bileşen default rating'leri (Sprint 0.6).
//
// Inspector'da gösterilen "Güç", "Voltaj sınıfı" gibi alanların ilk değeri.
// Sprint 0.7+'da kullanıcı override edebilecek (component.overrides?). Şimdilik
// tip bazlı sabit. Tipik standart değerler (hobi / orta güç devreleri).
import type { ComponentType } from '../bridge/engine.ts';

export interface ComponentDefaults {
  /** Maks sürekli güç (W) — R için ısınmadan taşıyabileceği. */
  powerRating?: number;
  /** Çalışma voltajı (V) — C için dielektrik dayanımı. */
  voltageRating?: number;
  /** Akım sınırı (A) — L / D / Z için. */
  currentRating?: number;
}

export const COMPONENT_DEFAULTS: Readonly<Record<ComponentType, ComponentDefaults>> = {
  V:   { },
  I:   { currentRating: 0.1 },
  R:   { powerRating: 0.25 },     // 1/4 W — breadboard standartı
  C:   { voltageRating: 50 },     // 50 V — SMD/axial ortalama
  L:   { currentRating: 0.5 },
  D:   { currentRating: 1 },
  Z:   { currentRating: 0.5 },
  BJT: { currentRating: 0.5 },
  MOS: { currentRating: 1 },
  OA:  { },
};
