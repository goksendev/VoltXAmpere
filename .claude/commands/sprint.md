---
description: Tek bir ui-v2 sprint koş (architect → implementer → verifier)
argument-hint: "<X.Y>: <açıklama>"
---

Sprint $ARGUMENTS'i baştan sona koştur.

1. **architect** subagent → spec yaz
   - LED/non-linear kelimesi gördüyse DUR, Şef'i çağır
   - 3 mimar ölçütünü dolu yaz

2. **implementer** subagent → kodu yaz, build al
   - Bundle +5 KB eşiği aşılırsa DUR
   - Build 3 denemede kırılırsa DUR

3. **verifier** subagent → bağımsız doğrula
   - 3 mimar ölçütü kontrol
   - Kapsam kaçağı kontrol
   - Rapor yaz (SPRINT-X.Y-REPORT.md)

Sonra commit et. Push etme (parti sonu push).

Duraklama koşulları:
- LED_STOP, SPEC_ISSUE, BUILD_ISSUE, BUNDLE_WARNING dosyası yazılırsa
- Verifier BLOCK verirse
- Tool hatası

Çıktı 3 satır:
- Spec: <özet>
- Build: <bundle Δ>
- Verify: SHIP | BLOCK — <sebep>
