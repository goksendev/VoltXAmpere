# VoltXAmpere ui-v2 Pipeline — CLAUDE.md

## Rol Tanımı

- **Göksen** = Şef, ürün vizyonu, son karar, gerçek kullanım testi
- **architect** (subagent) = sprint promptu yazan mimar — 28 sprintlik insan mimarın rolünü otomatize ediyor
- **implementer** (subagent) = kodu yazan Zenco
- **verifier** (subagent) = bağımsız doğrulayıcı — fabrication kapanı

Şef, architect ve implementer/Zenco arasında geçen kopyala-yapıştır
yükünü sıfırlamak için kurulmuştur. Şef'in gerçek işi: ürün vizyonu,
3 dakika gerçek kullanım testi, bug yakalama, faz kararları.

## Proje Bağlamı

VoltXAmpere'in yeni UI'ı. Vite + Lit 3 + TypeScript.
- Aktif geliştirme: `/Users/goksenolgun/Desktop/VoltXAmpere/ui-v2/`
- Raporlar: VoltXAmpere kökünde `SPRINT-X.Y-REPORT.md`
- Son sprint: 2.8 (Faz 2B kapandı, Faz 2C başlıyor)
- Mevcut format 2.1-2.8 raporlarında mevcut — aynen devam edecek
- `src/` (v1 live) dokunulmaz

## Komutlar

```bash
cd ui-v2
npm run dev        # dev server (port 5174, strictPort)
npm run build      # tsc --noEmit && vite build
npm run preview    # production preview
```

Test runner yok. `npm run build` = gate.

---

## Parti Modeli

Şef pipeline'a "önümüzdeki N sprint X kapsamında koş, sonra dur" der.
N'i her seferinde Şef belirler (2-3 ile başla, sonra 5-10'a çıkabilir).

Parti içinde pipeline otonom: architect → implementer → verifier →
commit+push → sıradaki sprint.

Parti sonunda zorunlu dur. Şef onay vermeden yeni parti başlamaz.

### Parti Boyutu Disiplini (mimar itirazı #1)

İlk iki parti **maksimum 3 sprint**. Otomasyon henüz test edilmedi;
ilk sapmayı küçük pencerede yakalamak kritik. Great Reset riskini
görmezden gelmeyiz.

---

## Sıkı Eşikler (mimar itirazı #2)

Parti otomatik durur ve Şef'i çağırır eğer:

- **Sprint başına bundle artışı > +5 KB (gzip)**
  Faz 2B ortalaması +2 KB/sprint idi. +5 kayda değer sapma.
- **Parti toplam bundle artışı > +15 KB (gzip)**
- **`npm run build` kırıldı** (tsc strict veya vite hata)
- **Verifier BLOCK verdi**
- **Şef'in spec'te belirttiği "dahil değil" maddelerinden birine
  dokunuldu**

Eşikler gevşetilmek zorunda kalırsa, yeni parti öncesi Şef onayı
gerekir. Sıkılaştırmak her zaman serbest.

---

## LED Stop (mimar itirazı #3)

Faz 2C'de LED bileşeni girdiği an **non-linear solver** gündeme gelir.
v2'de ngspice ground-truth yok. LED'e dokunan sprint pipeline tarafından
**otomatik olarak çalıştırılmaz**.

Pipeline LED spec'i gördüğünde durur, Şef'i çağırır. Ngspice verification
stratejisi Şef+architect tarafından birlikte kurulana kadar LED sprint'i
yoktur.

Bu kural Great Reset'in geri gelmemesi için.

Tetikleyici kelimeler (architect bu kelimeleri gördüğünde spec yazmaz,
Şef'i çağırır):
- LED, diode, zener, bjt, mosfet, transistor, non-linear, nonlinear
- solver değişikliği, MNA, newton-raphson, fixed-point

---

## Prompt Kalitesi — 3 Ölçüt (mimar itirazı #4)

Architect'in ürettiği her spec **mutlaka** şunları içermelidir.
Verifier kontrol eder, eksikse BLOCK:

### 1. "Dahil Değil" Bölümü
Her spec'te açıkça "bu sprint'te YAPMAYACAĞIZ" listesi olmalı.
Mimar Sprint 2.7-2.8 boyunca "waypoint YOK, LED YOK, refactor YOK"
gibi kapsam kilitleri koydu. Otomasyon bunu aynen üretmeli.

### 2. Önceki Sprintlere Referans
Spec, ilgili önceki sprintlere ismen atıf yapmalı. "Sprint 2.5 guard
mekanizması", "Sprint 1.3 disiplini revize", "Sprint 2.6 floating
state" gibi. Tarihsel bağlam olmadan spec temelsizdir.

### 3. Mimari Disiplin Güncellemesi
Spec sadece "şunu düzelt" değil, felsefi/mimari katmanı tanımalı.
Sprint 2.7 "NaN validation" fix'i değildi — "başarısızlık kendi
durumudur" disiplin kararıydı. Architect bug'ı disiplin katmanında da
konumlandırmalı.

**Bu üç ölçüt olmadan spec yetersizdir. Verifier eksikliği tespit
ederse BLOCK verir, architect spec'i yeniden yazar.**

---

## Fabrication Kapanı

Sprint 98-103 fabrication'ının tam panzehiri. İki bağımsız bağlam:

1. **implementer** "build yeşil, iş bitti" der
2. **verifier** aynı kodu sıfırdan okur, `npm run build`'i bağımsız
   koşar, `git diff` ile spec kapsamını denetler

Tek kaynağa güven yok. Sprint 98-103'te tek Zenco'ya güvendik ve
fabrication çıktı. Şimdi iki bağımsız gözlem zorunlu.

---

## Protocol Rules (Sprint 102.5'ten devralındı)

### 1. Arka planda iş bırakma
`setInterval`, `setTimeout`, `nohup`, `&`, `disown` — sprint sonunda
temiz olmalı. Verifier `ps aux` ile kontrol eder.

### 2. Scope dışı "küçük düzeltme" yasak
Fark edilen ama scope dışı olan bug rapora yazılır, **bir sonraki
sprint için** — şu anki sprint'te düzeltilmez.

### 3. Sahte PASS yok
Build yeşil ≠ iş bitti. Verifier kabul kriterlerini tek tek kontrol
eder. "Muhtemelen çalışıyor" yasak.

### 4. Her sprint sonu `git status` temiz olmalı

### 5. Her sprint bağımsız commit + push
Geri alma git revert ile tek adım olmalı.

---

## Sprint Rapor Formatı

Raporlar VoltXAmpere kökünde `SPRINT-X.Y-REPORT.md` olarak yazılır.
Mevcut 2.1-2.8 formatı korunur:

```
# Sprint X.Y — <başlık>

**Status:** ✅ Tamamlandı | ❌ BLOCK
**Tarih:** YYYY-MM-DD
**Bundle:** X KB JS (gzip Y KB) — önceki sprint'ten ±Z KB

## Özet
## Keşif (architect aşaması)
## Spec — Dahil
## Spec — Dahil Değil
## Fix / Implementation
## Doğrulama (verifier aşaması)
## Dosya Değişiklik Özeti
## Bundle Trendi
## Askıda Kalan
## Sonraki
## Notlar
```

---

## Kapı Açık

Mimar (insan) şunu söyledi: "İlk iki parti sonunda otomasyon kaliteyi
tutamazsa geri gel. Ego meselesi yapma."

İlk iki parti (toplam 4-6 sprint) sonunda Şef değerlendirir:
- "Dahil değil" bölümleri spec'lerde tutarlı mı?
- Tarihsel referanslar anlamlı mı, şablonik mi?
- Disiplin katmanı kayboldu mu?

Cevap "otomasyon kaliteyi tutmuyor" ise, Şef mimarla (insan) tekrar
konuşmaya döner. Küçük partilerle devam edilir, kritik sprint promptları
elle yazılır. Bu yenilgi değil, disiplin.

VoltXAmpere'in dünya simülatörü olma hedefi prompt otomasyonuna feda
edilemez.
