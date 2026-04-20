---
description: Parti halinde ui-v2 sprint zinciri (N sprint koş, sonra dur)
argument-hint: "<N> sprint, kapsam: <açıklama>. Örn: '3 sprint, kapsam: 2C-A rotation + GND + Switch yerleştirme'"
---

Parti modu: $ARGUMENTS

# Parti kuralları

1. **İlk iki parti maksimum 3 sprint.** Şef daha fazla istese bile
   reddet — CLAUDE.md Mimar İtirazı #1.
   
2. Her sprint için `/sprint` komutunu çağır.

3. Her sprint sonunda kontrol:
   - Verifier SHIP verdi mi? Hayırsa parti DURUR.
   - Bundle parti toplam artışı ≤ +15 KB gzip mi? Değilse DURUR.
   - LED_STOP dosyası yazıldı mı? Yazıldıysa DURUR.

4. Sprint başarılıysa commit zaten atıldı. Sıradaki sprint'e geç.

5. Parti bittiğinde:
   - Hepsi başarılıysa: tüm sprint'leri push et, Şef'e rapor ver
   - Bir kısım başarılı bir kısım değilse: başarılı olanları push et,
     kırıldığı noktayı Şef'e raporla

# Parti raporu formatı

Parti bitince VoltXAmpere kökünde:
`PARTY-<tarih>-REPORT.md`

```
# Parti Raporu — YYYY-MM-DD

## Kapsam
<Şef'in verdiği kapsam cümlesi>

## Sprint'ler
- Sprint X.Y — <başlık> — SHIP | BLOCK
- Sprint X.Z — <başlık> — SHIP | BLOCK
- ...

## Bundle Trendi
Parti başı: <pre> KB
Parti sonu: <post> KB
Toplam Δ: <Z> KB (eşik: 15 KB) [✓ / ✗]

## Manuel Kontrol Bekleyen (Şef için)
<tüm sprint'lerden toplanmış liste>

## Sonraki Parti Önerisi
<architect'in gözlemi>

## Mimar Ölçütleri Sağlığı (İlk 2 parti için kritik)
Spec'lerde "Dahil Değil" kalite: <iyi | şablonik>
Tarihsel referans derinliği: <iyi | sığ>
Disiplin katmanı: <tanınıyor | kayboluyor>
```

# Çıktı

Parti bitince Şef'i çağır. 3 satır özet:
- Parti: N/N sprint SHIP
- Bundle: +X KB (eşik: 15)
- Kapı açık mı? (ilk 2 parti kontrol noktası)
