// VoltXAmpere v2 — sayı formatlayıcılar (Sprint 0.5 + 0.6).
//
// SI prefix + anlamlı-hane seçimiyle okunabilir çıktı üretiyoruz. İki aile:
//   • Bileşen değerleri (R / C / L)   → trailing-zero atılır ("1 kΩ", "10 nF")
//   • Canlı ölçümler (V / I / P / E)  → her zaman 2 decimal ("5.00 V", "1.15 mA")
//
// Neden iki aile: Kullanıcı devreye "1 kΩ" yazar; "1.00 kΩ" görünce yadırgar.
// Ama ölçüm değeri hassasiyet taşır — "5 V" ile "5.00 V" farklıdır (ölçüm
// çözünürlüğü). Canlı değerlerde 2 decimal hassasiyeti okuyucuya verir.

interface ScaledValue {
  scaled: number;
  prefix: string;
}

/** SI prefix seçimi. Mutlak büyüklüğe göre 1000'erli eşiklerle basamak kaydırır.
 * f (femto) → p (piko) → n (nano) → µ (micro) → m (milli) → "" → k → M → G */
function siScale(v: number): ScaledValue {
  const a = Math.abs(v);
  if (a === 0) return { scaled: 0, prefix: '' };
  if (a < 1e-12) return { scaled: v * 1e15, prefix: 'f' };
  if (a < 1e-9)  return { scaled: v * 1e12, prefix: 'p' };
  if (a < 1e-6)  return { scaled: v * 1e9,  prefix: 'n' };
  if (a < 1e-3)  return { scaled: v * 1e6,  prefix: 'µ' };
  if (a < 1)     return { scaled: v * 1e3,  prefix: 'm' };
  if (a < 1e3)   return { scaled: v,        prefix: ''  };
  if (a < 1e6)   return { scaled: v / 1e3,  prefix: 'k' };
  if (a < 1e9)   return { scaled: v / 1e6,  prefix: 'M' };
  return { scaled: v / 1e9, prefix: 'G' };
}

/** abs(scaled)'a göre 0/1/2 decimal basamak sayısı seçer. 100+ için tam sayı. */
function digitsFor(scaled: number): number {
  const a = Math.abs(scaled);
  if (a >= 100) return 0;
  if (a >= 10)  return 1;
  return 2;
}

/** "1.00" → "1", "1.50" → "1.5", "1.23" → "1.23". */
function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

// ─── Bileşen değerleri (trailing zero atılır) ────────────────────────────────

export function formatResistance(ohms: number): string {
  if (ohms === 0) return '0 Ω';
  const { scaled, prefix } = siScale(ohms);
  return `${trimTrailingZeros(scaled.toFixed(digitsFor(scaled)))} ${prefix}Ω`;
}

export function formatCapacitance(farads: number): string {
  if (farads === 0) return '0 F';
  const { scaled, prefix } = siScale(farads);
  return `${trimTrailingZeros(scaled.toFixed(digitsFor(scaled)))} ${prefix}F`;
}

export function formatInductance(henries: number): string {
  if (henries === 0) return '0 H';
  const { scaled, prefix } = siScale(henries);
  return `${trimTrailingZeros(scaled.toFixed(digitsFor(scaled)))} ${prefix}H`;
}

// ─── Canlı ölçümler (her zaman 2 decimal) ────────────────────────────────────

export function formatVoltage(volts: number): string {
  if (volts === 0) return '0.00 V';
  const { scaled, prefix } = siScale(volts);
  return `${scaled.toFixed(2)} ${prefix}V`;
}

export function formatCurrent(amps: number): string {
  if (amps === 0) return '0.00 A';
  const { scaled, prefix } = siScale(amps);
  return `${scaled.toFixed(2)} ${prefix}A`;
}

export function formatPower(watts: number): string {
  if (watts === 0) return '0.00 W';
  const { scaled, prefix } = siScale(watts);
  return `${scaled.toFixed(2)} ${prefix}W`;
}

/** Enerji — kapasitör/indüktör için 0.5·C·V² veya 0.5·L·I². */
export function formatEnergy(joules: number): string {
  if (joules === 0) return '0.00 J';
  const { scaled, prefix } = siScale(joules);
  return `${scaled.toFixed(2)} ${prefix}J`;
}
