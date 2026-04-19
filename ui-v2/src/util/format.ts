// VoltXAmpere v2 — sayı formatlayıcılar (Sprint 0.5).
// Dashboard ve canvas probe aynı kaynaktan gelmesi gerekir — bu fonksiyonları
// paylaşıyoruz ki iki farklı format ihtimali olmasın.

/** Voltaj: "5.00 V". */
export function formatVolt(v: number): string {
  return `${v.toFixed(2)} V`;
}

/** Akım: SI otomatik ölçek (pA / nA / µA / mA / A).
 * DC steady-state'te |I| ≈ 0 — solver hassasiyetinde pA/nA gözükebilir. */
export function formatAmp(i: number): string {
  const a = Math.abs(i);
  if (a < 1e-9) return `${(i * 1e12).toFixed(2)} pA`;
  if (a < 1e-6) return `${(i * 1e9).toFixed(2)} nA`;
  if (a < 1e-3) return `${(i * 1e6).toFixed(2)} µA`;
  if (a < 1) return `${(i * 1e3).toFixed(2)} mA`;
  return `${i.toFixed(2)} A`;
}
