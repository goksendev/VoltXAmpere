// VoltXAmpere v2 — bileşen tipi bazlı AABB yarı-boyutları (Sprint 1.1).
//
// Değerler Sprint 0.5 sembol çizim sabitlerinden türedi (rotation 0 varsayımı):
//   R zigzag: 80 px yatay × ±10 amp. halfWidth=40, halfHeight=14 (label margin tolerans)
//   C plaka: 48 px yatay (lead+gap+lead) × 24 plate extent. halfWidth=24, halfHeight=14
//   V daire+leads: 70 px yatay (lead+2·radius+lead) × 34 çap. halfWidth=35, halfHeight=18
//
// Tıklama alanı biraz cömert — label'lara veya yakın etiketlere kazara
// tıklandığında bile bileşen seçilir. Çok cömert yapmak komşu bileşenlerin
// hit alanlarını üst üste bindirir; şu an güvenli aralıkta.

export interface ComponentBounds {
  halfWidth: number;
  halfHeight: number;
}

export const COMPONENT_BOUNDS: Readonly<Record<string, ComponentBounds>> = {
  R: { halfWidth: 40, halfHeight: 14 },
  C: { halfWidth: 24, halfHeight: 14 },
  V: { halfWidth: 35, halfHeight: 18 },
  // L / D / Z / BJT / MOS / OA — Sprint 1.x'te eklenecek, sembol çizimleriyle
  // birlikte. Şimdilik RC için yeterli.
};

/** Bilinmeyen tip için güvenli default — hit testing çalışsın ama görsel
 * olarak çok büyük/çok küçük olmasın. Sprint 1.x+'da bilinmeyen tip zaten
 * whitelist'te tespit edilir, buraya nadiren düşer. */
export const DEFAULT_BOUNDS: ComponentBounds = { halfWidth: 20, halfHeight: 20 };
