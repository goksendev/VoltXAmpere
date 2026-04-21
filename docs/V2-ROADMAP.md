# V2-ROADMAP
## VoltXAmpere v1 → v2 Dönüşüm Planı

**Son güncelleme:** 21 Nisan 2026 · Sprint 2.9 sonrası, Parti 2 öncesi
**Yazar:** Claude (mimar) · Şef Göksen Olgun için
**Durum:** Canlı doküman — her parti kapanışında revize edilir
**Onay:** Şef kabul etti (21 Nisan 2026)

---

# §0 — NASIL OKUNUR

Bu doküman üç kitle için yazılmıştır, üçü de farklı ihtiyaçla gelir:

**Şef (Göksen):** Bütünü görmek, öncelik kararı vermek, neyin erteleneceğini seçmek. §1, §2, §4, §8 kritik. §5 sprint tabloları karar anlarında referans. §9 gidişatı sayısal ölçmek için.

**Mimar (sonraki Claude oturumları):** Sprint spec'lerini yazmak, disiplini korumak. §3 (3-katman hedef), §4 (dependency), §5 (sprint listesi), §6 (disiplin prensipleri) operasyonel. §7 (riskler) her sprint öncesi kontrol.

**Architect agent (otomasyon):** Spec üretmek için tarihsel bağlam ve kapsam kilidi. §5'teki "mimari disiplin" sütunu her sprintte doğrudan spec'e girer. §6 prensipleri ihlal edilmez.

Her bölüm kendinden önce ne okunmalı diye bağımlılık belirtir. Atlayarak okunabilir.

---

# §1 — VİZYON

## 1.1 Tek Cümle

VoltXAmpere'ın hedefi:

> **LTspice kadar doğru** + **EveryCircuit kadar güzel** + **Tinkercad kadar kolay** + **Türkçe birinci sınıf** + **web-first**

Bu beş özelliğin kesişimi piyasada yok. On iki rakip analizi bunu kanıtladı: **doğruluk × kolaylık düzleminde sağ üst çeyrek tamamen boş**. LTspice sağ alt (doğru ama zor), Tinkercad sol üst (kolay ama yetersiz), EveryCircuit ortada takılı. Türkçe ekosistemin yanıtı ise yok — Türk mühendislik öğrencisi İngilizce LTspice kullanmak zorunda.

v2 bu beş özelliği birden sunan ilk ürün olacak. Bu iddianın gerçekleşmesi için aşağıdaki somut ölçütlerin **hepsi** sağlanmalı:

| # | Boyut | Somut ölçüt | Doğrulama yöntemi |
|---|---|---|---|
| 1 | Doğruluk | Her sayısal sonuç ngspice referansından %0.1 sapma altında | Her non-linear bileşen sprintinde ngspice regresyon matrisi |
| 2 | Hız | Cold start < 1 s · 100-bileşen transient < 500 ms | Lighthouse + `performance.mark` her faz sonu |
| 3 | Kapsam | 71 bileşen yerleştirilebilir + SPICE import/export tam | Faz 5 tamamlanmalı |
| 4 | Öğreticilik | 12 yaşındaki çocuk 2 dakikada LED yakabilir | Kullanıcı testi (min. 5 çocuk, Faz 3 sonu) |
| 5 | Profesyonellik | Analog mühendis LTspice'ta yaptığı her analizi burada yapabilir | Faz 4 kabul kriteri (SPICE directive + .step + Monte Carlo) |
| 6 | Erişilebilirlik | iPad'de dokunmatik tam, telefonda okunur, kurulum sıfır | Faz 7 responsive + touch sprintleri |
| 7 | Türkçe | Tüm UI, hata mesajları, dersler, AI çıktıları Türkçe · terminoloji tutarlı | Sprint sonlarında Türkçe audit (§6.4) |

Bu yedi boyutun **tamamı** yerine gelmezse "dünyanın en iyisi" iddiası boştur. Her boyut bir faza karşılık gelir; hiçbiri feda edilmez.

## 1.2 Üç Kullanıcı, Tek Ürün

VoltXAmpere üç ayrı uygulama olmayacak. Tek kod tabanı, tek solver, tek devre dosyası. Sadece **UI shell** kullanıcıya göre değişir.

**A) Çocuk / Yeni Başlayan (Keşfet modu hedef kitlesi)**
- 12-16 yaş veya yetişkin amatör
- Elektronik bilgisi yok veya temel
- "LED neden yanıyor?" sorusunu sormak ister
- Karmaşık UI onu kaçırır

Keşfet modu: 8 temel bileşen (direnç, kapasitör, pil, LED, anahtar, toprak, lamba, motor), büyük ikonlar, "Bu ne yapıyor?" kartları, hazır devre galerisi (RC filtre, LED sürücü, gerilim bölücü, saat devresi vb.), adım adım dersler.

**B) EE Öğrencisi / Mühendis (Tasarla modu hedef kitlesi)**
- Üniversite 2-4. sınıf veya junior mühendis
- LTspice bilir veya öğrenmek ister
- Devre tasarlar, değer deneyer, sonuç bekler
- LTspice'ın karmaşık UI'ından bıkmıştır

Tasarla modu: Tam 71 bileşen, parametrik Inspector, waypoint wire çizimi, zoom/pan, Kaydet/Aç, SPICE export, klavye kısayolları, Undo/Redo sınırsız.

**C) Analog Uzmanı / Araştırmacı (Güç modu hedef kitlesi)**
- Senior analog tasarımcı, akademik araştırmacı
- LTspice her gün kullanır
- .step, .meas, .param, Monte Carlo, noise analiz ister
- Web tool'lardan genellikle memnun değildir

Güç modu: SPICE directive editörü (Monaco), .step parametric sweep, Monte Carlo, 4-slot dashboard (V(t) + Bode + Phase + .step overlay), node numaraları canvas'ta.

**Mod geçişi:** Kullanıcı Keşfet'te bir devre kurar. "Güç" sekmesine tıklar. Aynı devre şimdi SPICE editörü yanında duruyor. Monte Carlo koşturur. Aynı devre.

Bu "same state, different shell" mimarisi §5 Faz 3.1'in kalbi.

## 1.3 Neden Şimdi

Üç eşzamanlı fırsat var:

1. **Web teknolojileri olgunlaştı.** WebAssembly, Canvas 2D GPU-accelerated, IndexedDB, WebWorkers — LTspice seviyesi hesaplama browserda mümkün artık.
2. **LLM'ler devreye girdi.** AI diyagnoz, doğal dilden devre üretme — 2023'te fantezi, 2026'da uygulanabilir.
3. **LTspice'ın UI'ı 1997'den beri aynı.** Analog Devices 2016'da aldı, geliştirme neredeyse durdu. Boşluk büyüyor.

v2 bu üç dalgayı birden yakalar. Beş yıl sonra başka biri yaparsa VoltXAmpere geç kalır. Üç-altı ay sonra yaparsa kurucu konum alır.

---

# §2 — ŞU ANKİ DURUM (Nisan 2026)

## 2.1 Tamamlananlar

**v1 (src/, voltxampere.com canlı):** 68 sprint. SPICE parser 20/20, ngspice 46 KLU solver, band-matrix sparse LU, 71 bileşen, Protocol Rules (Sprint 102.5), Great Reset (v12.0.0-alpha.1). Stabil.

**v2 (ui-v2/, voltxampere.com/v2):** Sprint 0.1'den 2.9'a kadar 29 sprint. Bundle 124.78 KB gzip. pipeline-setup branch'te otomasyon kuruldu (architect + implementer + verifier agent, /sprint ve /party komutları, 3 ölçüt kalite gate, LED STOP kuralı).

### v2 Katman Durumu

| Katman | Durum | Sprint Referansı |
|---|---|---|
| Skeleton (Vite + Lit 3 + TS strict) | Tamam | 0.1-0.2 |
| Design tokens (47 token, 4-katman zemin) | Tamam | 0.2 |
| Canvas 2D + DPI scaling | Tamam | 0.3 |
| Dashboard shell + 3 slot | Tamam | 0.4 |
| Sidebar ikon catalog (14 bileşen) | Tamam | 0.5, 0.11 |
| Inspector shell | Tamam | 0.6 |
| Transient grafik | Tamam | 0.7 |
| Topbar (logo + mod switch + butonlar) | Tamam (switch görsel) | 0.8 |
| Canvas chrome (transport + zoom + deney başlığı) | Tamam (fonksiyonel değil) | 0.10 |
| Solver bridge (v1 engine'i Worker'da) | Tamam | 0.7 |
| Select / hover / drag | Tamam | 1.1-1.2 |
| Wire çizme (otomatik Manhattan) | Tamam | 1.4 |
| Delete + Undo/Redo altyapısı | Tamam | 1.5, 2.1 |
| Multi-select + rubber-band | Tamam | 2.3 |
| Multi-drag | Tamam | 2.2 |
| Escape iptal disiplini | Tamam | 2.4 |
| QA protokolü (3-aşamalı) | Kurulu | 2.5 |
| Empty state (components=0) | Tamam | 2.5 |
| Floating state (wires=0 / V-GND'siz) | Tamam | 2.6-2.7 |
| Error state (solver fail) | Tamam | 2.7-2.8 |
| 4-state dashboard matrix (ok/empty/floating/error) | Tamam | 2.8 |
| `isValidSolverResult` helper | Tamam | 2.8 |
| Tek kaynak disiplini (Sprint 0.7) restore | Tamam (zaten korunuyormuş) | 2.8 |
| 17-adım Ctrl+Z zinciri testi (0 stale) | Geçti | 2.8 |
| Rotation (tek bileşen, 90° increments) | Tamam | 2.9 |

## 2.2 Bilinen Eksikler (Önceliklendirme)

**P0 — Simulatör adını hak etmek için kritik:**
- Parametre düzenleme (R1 = 1kΩ → 10kΩ yapılamıyor)
- Kaydet/Aç (kullanıcı devresini saklayamıyor)
- Waypen wire çizimi (Şef'in doğrudan talebi)

**P1 — Profesyonel kullanım için gerekli:**
- GND yerleştirme (ikon var, fonksiyon yok)
- Switch yerleştirme
- Zoom gerçek (görsel var, fonksiyon yok)
- Pan
- Klavye kısayolları (R, C, L, V, A, D, G, W vb.)

**P2 — Kapsam genişletme:**
- LED yerleştirme (LED STOP aktif, ngspice strategy önce)
- Diyot, BJT, MOSFET, Op-amp
- SPICE import/export
- Çoklu bileşen rotation

**P3 — Modlar:**
- Mod switcher fonksiyonel (şu an [TODO] log)
- Keşfet modu içerik
- Güç modu içerik

**P4 — Amiral gemisi:**
- Canlı fizik katmanları (voltage gradient, heat map, manyetik alan)
- What-if slider
- Zaman makinesi
- AI diyagnoz
- NL → devre

## 2.3 Askıdaki Sorunlar

- **Bug #2 (V1 etiket kaybı):** 10+ senaryoda reproduce edilemedi. Şef yeniden gözlemlemezse askıda.
- **ES modules migration:** Sprint 0.9-0.11 arası gündeme geldi, ertelendi. Faz 7 polish'te tekrar bakılacak.
- **CHANGELOG yönetimi:** v2 için henüz CHANGELOG.md yok. Faz 2C sonunda kurulacak.

## 2.4 Pipeline Durumu

pipeline-setup branch:

- `CLAUDE.md` (14 KB, dokunulmaz): Sprint 102.5 Protocol Rules
- `CLAUDE-PIPELINE.md` (6 KB): Parti modeli, eşikler, LED STOP, 3 ölçüt
- `.claude/agents/`: architect, implementer, verifier
- `.claude/commands/`: `/sprint`, `/party`
- Tanıma testi: 6/6 geçti

**Parti disiplini:**
- İlk iki parti maksimum 3 sprint
- Architect çıktısı ilk parti boyunca Şef + mimar tarafından gözden geçirilir
- Kalite ölçütleri tutmazsa mimara geri dönüş (kapı açık)

**Eşikler:**
- Sprint başına bundle artışı > +5 KB (gzip) → dur
- Parti toplamı > +15 KB → dur
- LED STOP tetikleyici kelimeler (§6.5) görüldüğünde → dur

---

# §3 — HEDEF DURUM (Üç Katman)

Roadmap üç tamamlanma katmanı olarak düşünülür. Her katman kendi başına bir "ship edilebilir ürün" tanımlar. Proje yarıda kalırsa, hangi katman bitmişse o katmanın değeri cebine kalır.

## 3.1 Katman 1 — "İşlevsel" (Tasarla Mükemmel)

Hedef: EE öğrencisinin LTspice yerine v2'yi kullanmayı tercih edeceği durum.

**Kabul kriterleri:**

1. Kullanıcı sıfırdan RC, RL, RLC, op-amp, transistor, çoklu stage devreleri kurabilir
2. Her bileşenin her parametresi değiştirilebilir (direnç, kapasitör, voltaj, frekans, transistor model, vb.)
3. Wire çizimi hem otomatik router hem waypoint kontrolü ile çalışır
4. 71 bileşenin tamamı yerleştirilebilir (LED ve non-linear dahil, ngspice doğrulanmış)
5. Zoom + pan ile 200+ bileşen devreleri yönetilebilir
6. Devre kaydedilir, geri açılır (localStorage + opsiyonel cloud)
7. SPICE netlist (.cir) export edilir, LTspice'ta çalışır
8. SPICE netlist import edilir, otomatik layout
9. Klavye kısayolları hızlı kullanıcıya LTspice benzeri tempo sağlar
10. Bundle < 200 KB gzip (Monaco editor lazy-load dahil)

**İş tahmini:** Faz 2C (10 sprint) + Faz 5 (11 sprint) = **21 sprint**

**Bu katmanın "başarısı":** v2 Tasarla modu tek başına voltxampere.com/v2 olarak yayınlansa ve başka hiçbir mod/özellik olmasa, EE öğrencisi bu ürünü LTspice yerine kullanırdı.

## 3.2 Katman 2 — "Üç Mod" (Adaptif Mod Gerçek)

Hedef: Tek ürün, üç kullanıcı profili, üç UI yoğunluğu. Keşfet çocuğa ulaşır, Güç uzmana ulaşır.

**Kabul kriterleri (Katman 1 + şunlar):**

11. Mod switcher tıklanınca UI shell gerçekten değişir, state korunur
12. Keşfet modu: 8 bileşen palette, basit inspector, "Bu ne yapıyor?" kartları, hazır galeri (min. 20 devre), 10 Türkçe ders
13. Tasarla modu: Katman 1 aynen
14. Güç modu: SPICE directive editörü (Monaco), `.step` parametric sweep, Monte Carlo panel (n=1000), 4-slot dashboard (V(t) + Bode magnitude + Bode phase + .step overlay)
15. Mod geçişinde devre state korunur (bileşenler, tel, değerler)
16. Her modun klavye shortcut seti mod-specific (Keşfet'te fewer, Güç'te LTspice-parity)

**İş tahmini:** Faz 3 (8 sprint) + Faz 4 (7 sprint) = **15 sprint**

**Bu katmanın "başarısı":** Üç farklı kullanıcı tipi aynı gün aynı devreyi açıp kendi modunda çalışabilir. Keşfet'te yakılan LED, Güç'te .step ile 10 farklı dirençte analiz edilebilir.

## 3.3 Katman 3 — "Dünya Markası" (Amiral Gemisi)

Hedef: Piyasada hiçbir rakibin yapmadığı 3-5 özellik. "Tabii ki v2 kullanıyorum, başka simülatör niye açayım?" dedirten özellikler.

**Kabul kriterleri (Katman 2 + en az 3 tanesi mükemmel, diğerleri "iyi"):**

17. **Canlı fizik katmanı (voltage gradient):** Tel üzerinde voltaj yüksekken parlak amber, düşükken soluk. Toggle.
18. **Canlı fizik (heat map):** Direnç güç dissipation'a göre ısınır (kırmızı glow). P = V×I gerçek zamanlı.
19. **Canlı fizik (manyetik alan):** İndüktör etrafında dinamik field lines. Akım değişimi field'i canlı değiştirir.
20. **What-if slider:** Inspector'daki değere tıkla+sürükle → dashboard grafiği anlık değişir. LTspice `.step`'in real-time versiyonu.
21. **Zaman makinesi:** Transient bitince timeline scrub → t=X anındaki tüm node voltage + current canvas üstünde canlı gösterilir.
22. **AI diyagnoz:** "V_out neden 3V?" → LLM devre + sonuç analiz eder, Türkçe gerekçe + alternatif önerir.
23. **NL → devre:** "12V'tan 3.3V LDO" → LLM devre iskeleti çizer, canvas'a yerleştirilir, her seçimi açıklar.

**İş tahmini:** Faz 6 (14 sprint — gerçekçi)

**Bu katmanın "başarısı":** Rakip bir web simülatör VoltXAmpere kullanıcısına "bize geç" dediğinde, kullanıcı "ama sizde zaman makinesi yok" diyebilir.

## 3.4 Polish + Ticari Hazır

Bu bir katman değil, üç katmanın üzerine konan son kat:

- Ayarlar menüsü (dil, tema, kısayol)
- Onboarding (ilk açılışta 3-adım tur)
- Landing page redesign (voltxampere.com ana)
- Responsive (tablet, mobil)
- Dokunmatik + Pencil input
- v1 → v2 path swap (voltxampere.com = v2, v1 /legacy)
- v1 sunset kararı (6 ay izleme sonrası)

**İş tahmini:** Faz 7 (10 sprint)

## 3.5 Toplam İş Tahmini — Dürüst Versiyon

| Katman | Fazlar | Sprint Sayısı |
|---|---|---|
| Katman 1 (İşlevsel) | Faz 2C + 5 | 21 |
| Katman 2 (Üç Mod) | Faz 3 + 4 | 15 |
| Katman 3 (Amiral) | Faz 6 | 14 |
| Polish + Ticari | Faz 7 | 10 |
| QA sprintleri (her faz sonu) | — | 5 |
| Beklenmeyen (risk tamponu %20) | — | 13 |
| **Toplam** | — | **78** |

Önceki tempo: 28 sprint ~3 ay, yani **ortalama 9-10 sprint/ay**. Bu tempoda 78 sprint = **8-9 ay**.

Otomasyon hızlanma sağlayabilir ama ilk partilerde hız kazancı yok (kalite denetimi overhead'i var). Risk tamponu ciddi — LED verification, AI integration, responsive, bunların hepsi "sürpriz yok" garantili değil.

**Gerçekçi hedef: 2027 başı.** Agresif hedef: 2026 sonu. Slogan "3-6 ay" yanlış bir hız beklentisi yaratır, şimdiden düzeltilmeli.

---

# §4 — DEPENDENCY DAG

## 4.1 Ne Neden Önce Gelmeli

Sprintler arası bağımlılık grafiği. Oklar "öncekinden sonra olmalı" anlamında.

```
┌──────────────────────────────────────────────────────────────┐
│                   FAZ 0-2B (Sprint 0.1 - 2.9)                │
│                   Temel + Interaction + Rotation             │
│                   ✅ TAMAM (29 sprint)                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 2C — TASARLA TAM  (Sprint 2.10 - 2.21, ~12 sprint)      │
│                                                              │
│  Sprint 2.10 ──► Parametre edit (Inspector)  ◄─ ROOT         │
│       │                                                      │
│       ├───► 2.11 Waypoint wire                               │
│       ├───► 2.12 Inline canvas value edit                    │
│       ├───► 2.13 GND yerleştirme                             │
│       ├───► 2.14 Switch yerleştirme                          │
│       ├───► 2.15 Zoom (viewport transform)                   │
│       │         │                                            │
│       │         └──► 2.16 Pan (viewport translate)           │
│       │                                                      │
│       ├───► 2.17 Kaydet/Aç (JSON + localStorage)             │
│       │         │                                            │
│       │         ├──► 2.18 SPICE export                       │
│       │         └──► 2.19 SPICE import                       │
│       │                                                      │
│       ├───► 2.20 Klavye kısayolları                          │
│       └───► 2.21 QA sprinti (Faz 2C kapanış)                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 5 — LED + ADVANCED  (Sprint 5.0 - 5.10, ~11 sprint)     │
│                                                              │
│  Sprint 5.0 ──► ngspice verification strategy  ◄─ LED STOP   │
│       │         kalkması için zorunlu                        │
│       │                                                      │
│       ├───► 5.1 LED yerleştirme + non-linear solver keşfi    │
│       │         │                                            │
│       │         ├──► 5.2 Diyot (1N4148, 1N4007)              │
│       │         ├──► 5.3 Zener                               │
│       │         │                                            │
│       │         └──► 5.4 BJT (NPN, PNP)                      │
│       │                   │                                  │
│       │                   ├──► 5.5 MOSFET (N-ch, P-ch)       │
│       │                   └──► 5.6 JFET                      │
│       │                                                      │
│       ├───► 5.7 Op-amp (ideal + realistic)                   │
│       ├───► 5.8 Potentiometer (interactive)                  │
│       ├───► 5.9 Transformer + coupled inductors              │
│       └───► 5.10 QA sprinti (Faz 5 kapanış + ngspice batch)  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 3 — KEŞFET MODU  (Sprint 3.1 - 3.8, ~8 sprint)          │
│                                                              │
│  Sprint 3.1 ──► Mode switcher altyapı (CRITICAL)             │
│       │         State preservation, UI shell swap            │
│       │                                                      │
│       ├───► 3.2 Keşfet UI shell (sidebar + inspector)        │
│       │         │                                            │
│       │         └──► 3.3 "Bu ne yapıyor?" kartları           │
│       │                                                      │
│       ├───► 3.4 Deney başlığı sistemi (editable)             │
│       ├───► 3.5 Hazır devre galerisi (20 devre, kayıt tabanl)│
│       │                                                      │
│       ├───► 3.6 Ders altyapısı (step-by-step engine)         │
│       │         │                                            │
│       │         └──► 3.7 İlk 10 Türkçe ders                  │
│       │                                                      │
│       └───► 3.8 QA + çocuk kullanıcı testi                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 4 — GÜÇ MODU  (Sprint 4.1 - 4.7, ~7 sprint)             │
│                                                              │
│  Sprint 4.1 ──► Güç UI shell (SPICE panel)                   │
│       │                                                      │
│       ├───► 4.2 SPICE directive editör (Monaco, lazy-load)   │
│       │         │                                            │
│       │         ├──► 4.3 .step parametric sweep              │
│       │         ├──► 4.4 .meas measurements                  │
│       │         └──► 4.5 Monte Carlo panel                   │
│       │                                                      │
│       ├───► 4.6 4-slot dashboard (V/Bode/Phase/.step)        │
│       └───► 4.7 QA + analog uzman testi                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 6 — AMİRAL GEMİSİ  (Sprint 6.1 - 6.14, ~14 sprint)      │
│                                                              │
│  Sprint 6.1 ──► Canlı fizik altyapı (render katman)          │
│       │                                                      │
│       ├───► 6.2 Voltage gradient (tel parlaklığı)            │
│       ├───► 6.3 Heat map (direnç glow)                       │
│       ├───► 6.4 Manyetik alan (indüktör field)               │
│       │                                                      │
│       ├───► 6.5 What-if slider altyapı                       │
│       │         └──► 6.6 What-if real-time (graph update)    │
│       │                                                      │
│       ├───► 6.7 Zaman makinesi altyapı (transient cache)     │
│       │         └──► 6.8 Zaman makinesi UI (scrub)           │
│       │                                                      │
│       ├───► 6.9 AI altyapı (API entegrasyon)                 │
│       │         ├──► 6.10 AI diyagnoz v1                     │
│       │         └──► 6.11 AI diyagnoz v2 (Türkçe cilalı)     │
│       │                                                      │
│       ├───► 6.12 NL → devre v1 (iskelet generation)          │
│       │         └──► 6.13 NL → devre v2 (açıklamalı)         │
│       │                                                      │
│       └───► 6.14 QA + kullanıcı testi                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FAZ 7 — POLISH + TİCARİ  (Sprint 7.1 - 7.10, ~10 sprint)    │
│                                                              │
│  Sprint 7.1 ──► Ayarlar menüsü                               │
│       ├───► 7.2 Onboarding (3-adım tur)                      │
│       ├───► 7.3 Landing page redesign                        │
│       ├───► 7.4 Responsive layout (tablet)                   │
│       ├───► 7.5 Responsive layout (mobil)                    │
│       ├───► 7.6 Dokunmatik input                             │
│       ├───► 7.7 Kalem input (iPad Pencil)                    │
│       ├───► 7.8 Türkçe audit + terminoloji standardizasyon   │
│       ├───► 7.9 v1 → v2 path swap                            │
│       └───► 7.10 v1 sunset kararı (6 ay izleme sonu)         │
└──────────────────────────────────────────────────────────────┘
```

## 4.2 Kritik Bağımlılık Kararları

**K1 — Parametre düzenleme (Sprint 2.10) her şeyin köküdür.**

R1 = 1kΩ dışında bir değer koyulamıyorsa: Kaydet/Aç anlamsız (hep aynı değer), SPICE export anlamsız (hep aynı değer), Keşfet modu "Bu ne yapıyor?" anlamsız (değer değişmeden öğrenilmez), What-if slider imkânsız, AI diyagnoz zayıf.

Sonuç: Sprint 2.10 Parti 2'nin ilk sprinti. Ertelenemez.

**K2 — ngspice verification strategy (Sprint 5.0) LED'den önce.**

LED STOP kuralı bu amaçla var. Sprint 5.0 yazılmadan Sprint 5.1 (LED) spec'i yazılamaz. Architect agent bu durumda durur ve Şef'i çağırır.

Sprint 5.0 bir kod sprinti değil — protokol dokümanı. Her non-linear bileşen için:
- Hangi ngspice referans devresi kullanılır
- Hangi tolerans (%0.1 mi %1 mi, bileşene göre)
- Zenco testi nasıl koşar
- Regresyon nasıl saklanır

Bu doküman olmadan non-linear bileşenler sessizce bozuk kalır. Great Reset dersi.

**K3 — LED (Sprint 5.1) Keşfet modundan (Faz 3) önce.**

Keşfet'in 8 bileşen palette'inde LED **olmazsa olmaz**. Çocuk için LED = en görsel geri bildirim. Elektrik akımının gözle görülür kanıtı.

LED Faz 5'te geliyor ama Faz 3 Faz 5'ten sonra. Bu sebeple roadmap §4.1'de Faz 5, Faz 3'ten önce konuldu. Dokümanın önceki versiyonunda Faz 3 Faz 5'ten önceydi — bu hatalıydı, düzeltildi.

**K4 — Mode switcher (Sprint 3.1) Keşfet ve Güç içeriğinden önce.**

3.1 altyapı: Mod değişince UI shell swap olur, state (circuit + layout + undo history) korunur. Animasyon gerekiyorsa eklenir ama önce mekanizma.

3.1 bittikten sonra 3.2+ (Keşfet) ve 4.1+ (Güç) paralel ilerleyebilir ama aynı sprint değil. Sprint numarası çakışmaz.

**K5 — Tasarla tam olmalı → sonra Keşfet ve Güç.**

Keşfet = Tasarla'nın sadeleştirilmesi (8 bileşen filtresi, basit inspector). Güç = Tasarla'nın üzerine ek katman (SPICE panel, .step, Monte Carlo). İkisi de Tasarla'nın tam olmasına bağlı.

Faz 2C bitmeden Faz 3/4'e geçilmez. Aksi halde iki modda paralel hata ayıklanır, maliyet katlanır.

**K6 — Amiral gemisi özellikler Katman 2'den sonra.**

Canlı fizik üç modda da çalışır ama önce üç mod olmalı. What-if slider Tasarla + Güç'te anlamlıdır (Keşfet basit kalır). AI diyagnoz Tasarla + Güç'te. NL → devre Tasarla + Güç'te.

Faz 6 Faz 3+4 biter bitmez başlar.

**K7 — Polish (Faz 7) her şeyin sonunda.**

Responsive, touch, onboarding — bunlar feature değil cila. Önce feature'lar bitsin, sonra cila. Aksi halde her yeni feature responsive'i bozar, touch'ı bozar, sonsuz döngü.

İstisna: Sprint 7.8 (Türkçe audit) — Faz 2C sonunda da bir mini-audit olur (§6.4), ama full audit Faz 7'de.

---

# §5 — FAZ ROADMAP (Sprint-Sprint)

Her sprint üç satırla özetlenir:
- **Kapsam:** ne yapılır (tek cümle)
- **Dahil değil:** kapsam kilidi (bu sprintte yapılmaz, sonra)
- **Mimari disiplin:** felsefi katman (bug/feature'ı konumlandırma)

Architect agent bu üç satırı doğrudan spec'e girer. 3 ölçüt kalite kontrolü için bu üç alan zorunlu.

## 5.1 Faz 2C — Tasarla Tam

**12 sprint, 4 parti, tahmini 6-8 hafta**

### Sprint 2.10 — Parametre Edit (Inspector)

- **Kapsam:** Inspector'daki değer alanları editable. Enter veya blur'da commit. SI prefix parsing ("1k", "10n", "4.7µ", "1e-6"). Validation (negatif direnç yasak, sıfır uyarı). Undo entegrasyonu (her commit ayrı undo snapshot).
- **Dahil değil:** Inline canvas çift-tık edit (Sprint 2.12), unit conversion UI, otomatik formatting (kullanıcı "1000" yazarsa "1k"a çevirme), bulk edit (çoklu seçimde tek değer değişimi), ifade dili (`"R1*2"` gibi).
- **Mimari disiplin:** "Değer değişimi circuit mutation. Inspector UI-state snapshot commit eder, solver tetiklenir, 4-state matrix'te ok/error ayrımı değerin geçerli olup olmadığını belirler. Inspector Sprint 0.6'daki yapıya değer editable'ı ekler; solver protokol Sprint 1.3 revize (2.7) disiplini korunur — fail durumunda eski değeri tutma, error state."

### Sprint 2.11 — Waypoint Wire

- **Kapsam:** Tel çekerken boş alana tıklama waypoint ekler. İkinci, üçüncü vb. waypoint desteklenir. Son tıklama terminal olursa tel tamamlanır. Escape tüm waypoint'leri siler. Mevcut otomatik router waypoint'ler arasındaki segmentleri hesaplar (orthogonal routing).
- **Dahil değil:** Waypoint sürükleme (tamamlanmış tel üzerinde), non-orthogonal segment (45° yasak, sadece yatay/dikey), magnetic snap waypoint'lere (diğer tel veya bileşen), waypoint sil UI (sadece Escape toplu iptal).
- **Mimari disiplin:** "Şef'in sözü: 'kablom ilk düzlemde sabitlenmeli ve istersem ikinci hatta üçüncü düzlemler için de uygulayabilmeliyim.' Bu tam alıntı spec'e girer. Wire FSM Sprint 1.4'ten genişler: idle → armed → started → waypoint(n) → completed. `layout.wires[].via` array zaten Sprint 1.4'te tasarlandı, waypoint bu yapıya yazılır — veri modeli değişmez, sadece doldurma yolu değişir."

### Sprint 2.12 — Inline Canvas Value Edit

- **Kapsam:** Canvas'taki bileşen değerine çift-tıklama → yerinde mini-popup editör. Aynı SI parsing (Sprint 2.10'dan). Enter commit, Escape iptal. Tek seferde tek popup.
- **Dahil değil:** Drag-to-change (slider davranışı — Sprint 6.5 What-if), çoklu popup, formül editörü.
- **Mimari disiplin:** "UI-state mini-popup bir overlay component. Aynı parametre edit commit pipeline'ı (Sprint 2.10). Bu sadece alternatif giriş yolu, underlying mutation mantığı aynı. DRY ilkesi: aynı validator, aynı parser, aynı undo entegrasyonu."

### Sprint 2.13 — GND Yerleştirme

- **Kapsam:** Sidebar GND ikon → palette mode. Canvas tıklama → GND yerleştirilir. Sprint 1.3 ghost-preview pattern. İzole GND seçilebilir/silinebilir (Sprint 1.1'deki "ground locked" kısıtı kaldırılır).
- **Dahil değil:** Multiple ground types (analog/digital/chassis), ground routing optimization (otomatik kısa yol).
- **Mimari disiplin:** "GND node = 'gnd' rezerve. Yerleştirme = `circuit.components` + `layout.components` ekleme. Sprint 2.6 floating state guard hâlâ aktif — V-GND bağlantısı yoksa dashboard 'floating' kalır."

### Sprint 2.14 — Switch Yerleştirme + Tıklanabilirlik

- **Kapsam:** SPST anahtar. Sidebar'dan yerleştir. Canvas'ta tıklanınca aç/kapa. Açık = sonsuz direnç, kapalı = 0 direnç (effective). Solver yeniden koşar.
- **Dahil değil:** SPDT, DPST, momentary switch, multi-state rotary switch.
- **Mimari disiplin:** "Switch state = `layout.components[i].state` attr ('open' | 'closed'). Solver'a gönderirken effective R hesaplanır (1e12 veya 0). Bu bir 'layout attr circuit behavior değiştirir' pattern — rotation'ın (Sprint 2.9) tersi. Rotation circuit'i değiştirmez, switch değiştirir. Ayrım kritik."

### Sprint 2.15 — Zoom (Viewport Transform)

- **Kapsam:** Mouse wheel (Ctrl+wheel de), buton +/-, klavye +/-, "100% ortala" butonu. Merkez-odaklı (fare konumu). Zoom levelleri: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 400%.
- **Dahil değil:** Smooth continuous zoom, fit-to-content, zoom geçmişi.
- **Mimari disiplin:** "Canvas viewport transform matrisi kurulur. Tüm hit-test, drag, wire çizim koordinatları transform-aware olmak zorunda. Bu bir altyapı sprint — Sprint 2.16 pan bunun üzerine gelir. Transform pipeline Faz 6 canlı fizik render'ı için de temel."

### Sprint 2.16 — Pan (Viewport Translate)

- **Kapsam:** Space+drag (tüm moduslarda), middle-mouse drag, scrollbar yok (klavye kısayolu da). Grid sabit kalır, devre kayar.
- **Dahil değil:** Inertia scrolling, pan boundary limit, overview minimap.
- **Mimari disiplin:** "Pan viewport translate = transform matrisi translation komponenti. Zoom + pan birlikte: `scale(z) translate(x, y)`. Test: pan sonrası hit-test, drag, wire çizim hâlâ doğru. Regresyon matrisi Sprint 2.15 kriterlerinin hepsini pan-under-zoom'la tekrar koşturur."

### Sprint 2.17 — Kaydet/Aç (localStorage)

- **Kapsam:** Ctrl+S → JSON serialize → localStorage ("circuit:autosave" + "circuit:slots:N" N=1..10). Ctrl+O → son 10 devre listesi. "Yeni devre" butonu. İsimlendirme.
- **Dahil değil:** Cloud save, dosya indirme (.vxa formatı Sprint 2.18 ile), export to PNG, collaborative editing.
- **Mimari disiplin:** "Format version v1. Her mutation sonrası autosave (throttled). Forward-compat düşün — Faz 5 LED eklendiğinde format v2'ye geçiş migration gerekecek. Schema: `{ version: 1, circuit: {...}, layout: {...}, metadata: { name, created, modified } }`. Backward compat: v1 → v2 otomatik, v2 → v1 kayıp olabilir."

### Sprint 2.18 — SPICE Export

- **Kapsam:** Ctrl+E → .cir dosyası indirir. Dosya ismi = devre adı + timestamp. v1 parser'ın ters yönü (serialize). Ngspice 46 uyumlu.
- **Dahil değil:** Subcircuit tanımları, model library export, comment preservation (kullanıcı yazdığı comment'leri saklamak).
- **Mimari disiplin:** "Export = v1 import'un tam tersi. v1 parser 20/20 SPICE element destekliyor — export aynı 20'yi yazmalı. Test: export edilen .cir → v1 parser → aynı devre. Bu bir round-trip integrity kontrol."

### Sprint 2.19 — SPICE Import

- **Kapsam:** Drag-drop veya "Aç" butonu → .cir yükle → v1 parser → circuit + otomatik layout. Force-directed layout heuristik (bileşenler çakışmaz, kısa tel).
- **Dahil değil:** Subcircuit expand (`.subckt` import ama iç expand edilmez), library file import, auto-layout quality iyileştirme (kullanıcı manuel düzenler).
- **Mimari disiplin:** "Import circuit'i v1 parser'dan alır, layout'u sıfırdan kurar. Layout = heuristik, 'yaklaşık' kabul edilir. Kullanıcı yerleşimi sonradan düzenler. SPICE dosyasında layout bilgisi yok (LTspice'ın .asc'si ayrı format), bu yüzden auto-layout zorunlu."

### Sprint 2.20 — Klavye Kısayolları

- **Kapsam:** Bileşen palette shortcut'ları (R, C, L, V, A, D, 7, G, W, Q, M, J, O, P — userMemories'te liste). Rotation (`,` ve `.`) zaten var (Sprint 2.9). Space=Play/Pause (transport bar), Ctrl+S/O/E/Z/Y, Delete/Backspace, Escape. Yardım overlay (? tuşu).
- **Dahil değil:** Kullanıcı customization UI (kısayol değiştirme), shortcut çakışma uyarısı, vi-mode / Emacs-mode.
- **Mimari disiplin:** "Global keydown handler canvas-focused context. Text input'ta disabled (Sprint 2.10 Inspector edit'te kısayol tetiklenmez). Help overlay Sprint 7.1 Ayarlar'da genişletilir, burada sadece modal."

### Sprint 2.21 — Faz 2C QA Sprinti

- **Kapsam:** Zenco puppeteer tam regresyon (2.1-2.20 her sprint testi). Mimar görsel inceleme. Şef 10 dakika gerçek kullanım. CHANGELOG.md kuruluş. Release notu (v12.0.0-alpha.X).
- **Dahil değil:** Yeni özellik YOK. Sadece doğrulama + dokümantasyon.
- **Mimari disiplin:** "Faz kapanış protokolü. Sprint 2.5 QA şablonu uygulanır. 3-aşamalı test: Zenco otomatik + Mimar görsel + Şef manuel. Bulunacak buglar 'fix sprinti' olarak 2.21.1, 2.21.2 gibi açılır (Sprint 2.5-2.8 pattern). Fix'ler bitmeden Faz 5'e geçilmez."

### Parti Bölümü — Faz 2C

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 2** (sırada) | 2.10, 2.11 | Parametre + waypoint — "editör" olma |
| **Parti 3** | 2.12, 2.13, 2.14 | Inline edit + GND + Switch |
| **Parti 4** | 2.15, 2.16 | Zoom + Pan — viewport altyapı |
| **Parti 5** | 2.17, 2.18, 2.19 | Persistence + SPICE I/O |
| **Parti 6** | 2.20, 2.21 | Shortcuts + QA |

Parti 2 için öneri: **3 sprint değil, 2 sprint**. Sprint 2.10 + 2.11. Sprint 2.12 inline canvas edit Sprint 2.10'un doğal uzantısı, Parti 3'te başta kalsın veya 2.10 içine erirsin. Sebep: İlk otomasyon partisinde rahat olmak için 2 sprintlik parti daha güvenli.

## 5.2 Faz 5 — LED + Advanced

**11 sprint, 4 parti, tahmini 5-7 hafta**

### Sprint 5.0 — ngspice Verification Strategy

- **Kapsam:** Protokol dokümanı (`docs/NGSPICE-VERIFICATION.md`). Her non-linear bileşen için: (a) referans devre, (b) tolerans (%0.1 veya %1), (c) test metodolojisi (Zenco puppeteer + ngspice CLI), (d) regresyon saklama (snapshot JSON). Zenco nasıl test eder, adım adım.
- **Dahil değil:** Kod değişikliği YOK. Bu bir doküman sprinti.
- **Mimari disiplin:** "Great Reset dersi (Sprint 98-103 fabrication). Non-linear bileşen sessizce bozuk olamaz. ngspice ground truth — v1 bu dosyayla konuşur, v2 karşılaştırır, %0.1 sapma üstünde BLOCK. Bu doküman tüm Faz 5'in DNA'sı."

### Sprint 5.1 — LED Yerleştirme

- **Kapsam:** LED yerleştirme (Sprint 2.13 GND pattern). V1 D tipi reuse (LED = forward-biased diode, Vf=2V, 20mA tipik). Klasik LED sürücü devresi (V+R+LED) test edilir. ngspice karşılaştırma → %0.1 sapma altında. LED-specific: anode/cathode işareti, renk parametre (kırmızı/yeşil/sarı/mavi — Vf değişir).
- **Dahil değil:** LED strip, 7-segment display, RGB LED.
- **Mimari disiplin:** "Non-linear bileşen ilk yerleştirme. LED STOP kuralı Sprint 5.0 ile kalkar. Her sprint'te ngspice regresyon koşar — Sprint 5.2-5.9 boyunca. Bu Faz 5'in verifier gate'i."

### Sprint 5.2 — Diyot (Generic + Modelled)

- **Kapsam:** 1N4148 (signal), 1N4007 (power), 1N5817 (Schottky), generic ideal. Clipper, half-wave rectifier, voltage reference devreleri test. ngspice karşılaştırma.
- **Dahil değil:** Tunnel diode, Gunn diode, exotic models.
- **Mimari disiplin:** "LED'in genellenmiş hali. Model library kurulumu başlıyor. Her model: Is, N, Vj, Rs parameter set. v1 engine bu parametreleri zaten destekliyor, v2 UI'da exposed."

### Sprint 5.3 — Zener Diyot

- **Kapsam:** 1N4733A (5.1V), 1N4744A (15V), generic. Voltage regulator, overvoltage protection devreleri. Breakdown region non-linear davranış ngspice karşılaştırma.
- **Dahil değil:** TVS (transient voltage suppressor), avalanche diode — ayrı sprint.
- **Mimari disiplin:** "Zener breakdown region Sprint 5.2 forward-bias'ın ötesine geçer. Solver'ın negative bias handling'i kritik. ngspice karşılaştırma özellikle breakdown noktasında (±%0.5 tolerans)."

### Sprint 5.4 — BJT (NPN, PNP)

- **Kapsam:** 2N3904 (NPN), 2N3906 (PNP), generic. Common-emitter amplifier, switch, Darlington. Ebers-Moll model (v1'de mevcut). ngspice karşılaştırma (DC operating point + small signal).
- **Dahil değil:** RF transistors, power BJT'ler (2N3055 vb.), advanced Gummel-Poon.
- **Mimari disiplin:** "Üç-terminal bileşen — TerminalRef (Sprint 1.2) üç terminal destekler. Terminal tipleri: base, collector, emitter — canvas üstünde label görünür. Rotation (Sprint 2.9) üç terminal için test edilir."

### Sprint 5.5 — MOSFET (N-ch, P-ch)

- **Kapsam:** 2N7000 (N-ch logic), IRF540 (N-ch power), BS170 (N-ch small), IRF9540 (P-ch). Switching + linear region. ngspice karşılaştırma.
- **Dahil değil:** HEMT, JFET (ayrı sprint 5.6), LDMOS.
- **Mimari disiplin:** "Four-terminal (gate, drain, source, body). Body genellikle source'a bağlı (automatic). Gate input resistance ideal (∞) — modern SPICE modelleri bunu handle eder, v1 aynı."

### Sprint 5.6 — JFET (N-ch, P-ch)

- **Kapsam:** 2N3819, J310, generic. Depletion-mode davranış. ngspice karşılaştırma.
- **Dahil değil:** Dual-gate JFET.
- **Mimari disiplin:** "MOSFET'in atası, enhancement vs depletion fark kritik. Çoğu student JFET ile karşılaşmaz — simulator öğretici olabilir ('JFET normalde açık, gate ile kaparsın')."

### Sprint 5.7 — Op-amp (Ideal + Realistic)

- **Kapsam:** Generic ideal op-amp (gain=∞, Rin=∞, Rout=0, BW=∞), LM358, TL072, LM741, LF356. Realistic = input bias current, offset voltage, slew rate, GBW. Inverting, non-inverting, difference, integrator, differentiator. ngspice karşılaştırma.
- **Dahil değil:** Rail-to-rail special handling, current feedback amplifiers, instrumentation amp.
- **Mimari disiplin:** "Macro-model yaklaşımı (v1'de mevcut). 5-pin (V+, V-, out, VCC, VEE). VCC/VEE otomatik ±15V default, kullanıcı değiştirebilir. 'İdeal mi gerçekçi mi?' Inspector'da dropdown."

### Sprint 5.8 — Potentiometer (Interactive)

- **Kapsam:** 3-terminal pot (CW, wiper, CCW). Wiper position 0-1.0 slider Inspector'da. Canvas'ta wiper konumu görsel. Real-time resistance değişimi, solver her wiper değişiminde koşar (throttled 60Hz).
- **Dahil değil:** Audio taper (log), trimpot distinct component.
- **Mimari disiplin:** "Interactive bileşen — switch (Sprint 2.14) ile benzer pattern ama continuous. `layout.components[i].wiperPos` state. What-if slider (Sprint 6.5) altyapısının öncüsü."

### Sprint 5.9 — Transformer + Coupled Inductors

- **Kapsam:** Ideal transformer (turns ratio N), real transformer (primary L, secondary L, k coupling). Step-up, step-down test. ngspice karşılaştırma.
- **Dahil değil:** Multi-winding (3+ coils), saturation modeling, core loss.
- **Mimari disiplin:** "K coupling = 0..1. İdeal (k=1) ile gerçek (k=0.98 tipik) arası. İlk 'coupled element' — v1 engine K directive destekliyor."

### Sprint 5.10 — Faz 5 QA + ngspice Batch

- **Kapsam:** Sprint 5.1-5.9 her bileşen için ngspice regresyon matrisi. Tolerans ihlali varsa fix sprinti. Mimar görsel inceleme (her bileşenin sembolü, pin label'ları). Şef manuel test — 8 klasik devre (LED sürücü, common-emitter amp, op-amp integrator, vb.).
- **Dahil değil:** Yeni bileşen. Sadece doğrulama.
- **Mimari disiplin:** "Faz 5 kapanış. ngspice regresyon matrisi `docs/NGSPICE-REGRESSION.md` olarak kaydedilir — gelecekteki bileşen ekleme veya engine refactor için baseline. 71 bileşenin kaçı v2'de şu an çalışıyor? Bu rapor ondan cevap verir."

### Parti Bölümü — Faz 5

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 7** | 5.0 | ngspice strategy (tek sprint, doküman) |
| **Parti 8** | 5.1, 5.2, 5.3 | LED + diyot + zener (non-linear giriş) |
| **Parti 9** | 5.4, 5.5, 5.6 | BJT + MOSFET + JFET (transistor ailesi) |
| **Parti 10** | 5.7, 5.8 | Op-amp + pot |
| **Parti 11** | 5.9, 5.10 | Transformer + QA |

## 5.3 Faz 3 — Keşfet Modu

**8 sprint, 3 parti, tahmini 4-5 hafta**

### Sprint 3.1 — Mode Switcher Altyapı

- **Kapsam:** Topbar'daki Keşfet/Tasarla/Güç butonları gerçek switch. `currentMode` global state. UI shell component (`<vxa-discover-mode>`, `<vxa-design-mode>` zaten var, `<vxa-power-mode>` yeni). Mode değişince state (circuit, layout, undo history) korunur, sadece shell render değişir. Animasyon 200ms fade.
- **Dahil değil:** Keşfet veya Güç içeriği (sonraki sprintler). Mod-specific shortcut setleri.
- **Mimari disiplin:** "Kritik altyapı. Shell swap mantığı: state single source of truth, mod shell state'i tüketir. Sprint 0.7 tek kaynak disiplini modlar arası korunur. Test: Tasarla'da devre kur → Keşfet'e geç → Tasarla'ya dön → devre aynı."

### Sprint 3.2 — Keşfet UI Shell (Sidebar + Inspector)

- **Kapsam:** Keşfet moda özel sidebar (8 bileşen filtresi: direnç, kapasitör, pil, LED, anahtar, toprak, lamba, motor). Büyük ikonlar (Tasarla'nın 1.5x). Basit inspector — sadece "bileşen adı + bir parametre + büyük buton".
- **Dahil değil:** "Bu ne yapıyor?" kartları (Sprint 3.3). Galeri. Dersler.
- **Mimari disiplin:** "Keşfet = Tasarla'nın sadeleştirilmesi. Shell aynı state'i tüketir, farklı subset gösterir. Sidebar filter = component-type whitelist. Inspector simplify = parametre allowlist."

### Sprint 3.3 — "Bu Ne Yapıyor?" Kartları

- **Kapsam:** Keşfet modunda bileşen seçilince Inspector'ın altında büyük bir kart: "Direnç nedir? Elektriği yavaşlatan su musluğu gibi." Her 8 bileşen için Türkçe kart. İkon + başlık + 2-3 cümle + "Nasıl kullanılır?" linki (Sprint 3.7 dersler).
- **Dahil değil:** Interaktif kart (animasyon, etkileşim — Faz 6 altyapısı).
- **Mimari disiplin:** "Öğretici içerik. 12 yaşındaki çocuğa anlaşılır Türkçe. Metin kısa (mobilde okunur). Kart = pure content, kod'tan ayrı (`src/content/discover-cards.ts`). Gelecekte başka dillere çevrilir."

### Sprint 3.4 — Deney Başlığı Sistemi

- **Kapsam:** Canvas üstündeki "DENEY · [isim] · [formül]" badge editable. Çift-tık → input. `circuit.metadata.name` kaydedilir. "Formül" otomatik tespit edilmeye çalışılır (RC bulunursa fc hesaplanır), kullanıcı override edebilir.
- **Dahil değil:** Auto-detect ötesinde deney tanımlama, LaTeX formül render.
- **Mimari disiplin:** "Her devre bir 'deney' olma fikri — çocuk için 'bilimsel' hissiyat. Metadata Sprint 2.17 Kaydet/Aç şemasına eklenir."

### Sprint 3.5 — Hazır Devre Galerisi

- **Kapsam:** "Galeri" butonu Keşfet modunda üstte. Tıkla → 20 hazır devre (RC filtre, LED sürücü, gerilim bölücü, RLC rezonans, flip-flop, astable multivibrator, vb.). Küçük önizleme + isim + zorluk (kolay/orta/zor). Tıkla → yükle.
- **Dahil değil:** Kullanıcı kendi devresini galeriye ekleme, cloud galeri, paylaşım.
- **Mimari disiplin:** "Galeri = Sprint 2.17 Kaydet/Aç'ın read-only önceden yüklenmiş versiyonu. Her devre = JSON dosya (`public/gallery/rc-filter.json`). Yükle = localStorage slot'a kopyala → aç."

### Sprint 3.6 — Ders Altyapısı (Step-by-Step Engine)

- **Kapsam:** Side panel tutorial component. Adım listesi (JSON). "Şu bileşeni al, şuraya koy" talimatı. Adım tamamlanınca check. İlerle/geri butonu. Şu an olan adımın vurgusu (canvas'ta highlight).
- **Dahil değil:** Ders içeriği (Sprint 3.7). Interaktif doğrulama (kullanıcı doğru yere koyduysa).
- **Mimari disiplin:** "Engine ile content ayrı. Engine = generic stepper, content = Türkçe ders dosyaları. Üçüncü-taraf ders eklemeye açık yapı (gelecekte topluluk katkısı)."

### Sprint 3.7 — İlk 10 Türkçe Ders

- **Kapsam:** (1) "LED yakalım!" (2) "Gerilim bölücü" (3) "RC filtre" (4) "Kapasitör ne yapar?" (5) "Anahtarla LED kontrol" (6) "Parallel LEDler" (7) "Seri LEDler" (8) "Motor hız kontrolü" (9) "RLC rezonans" (10) "Bilgisayarın kalbi: flip-flop". Her ders 5-10 adım, 3-5 dakika.
- **Dahil değil:** Video, ses. Sadece metin + canvas aksiyon.
- **Mimari disiplin:** "Türkçe pedagoji — çocuk odaklı dil. Her ders bir hazır galeri devresi ile eşleşir (Sprint 3.5). Ders tamamlandığında kullanıcı o devrenin üzerinde değişiklik yapmayı deneyebilir."

### Sprint 3.8 — Faz 3 QA + Kullanıcı Testi

- **Kapsam:** Zenco otomatik regresyon. Mimar görsel inceleme. Şef 5 çocuk bulup test (12-16 yaş, elektronik sıfır). Her çocuk "Ders 1: LED yakalım" yapacak, süre + engeller + memnuniyet kaydedilir. Bulgular fix sprintlerine çevrilir (3.8.1, 3.8.2).
- **Dahil değil:** Büyük içerik değişikliği, 11+ ders.
- **Mimari disiplin:** "Gerçek kullanıcı testi zorunlu. Keşfet modunun 'Tinkercad'den iyi' iddiası ancak 12 yaşındaki bir çocuk 2 dakikada LED yakabilirse doğrulanır. Sayılar: 5 çocuktan 4'ü 2 dakika altında LED yakarsa geçer."

### Parti Bölümü — Faz 3

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 12** | 3.1 | Mode switcher altyapı (kritik, tek sprint) |
| **Parti 13** | 3.2, 3.3, 3.4 | Keşfet shell + kartlar + başlık |
| **Parti 14** | 3.5, 3.6 | Galeri + ders engine |
| **Parti 15** | 3.7, 3.8 | 10 ders + QA/çocuk test |

## 5.4 Faz 4 — Güç Modu

**7 sprint, 3 parti, tahmini 4-5 hafta**

### Sprint 4.1 — Güç UI Shell

- **Kapsam:** `<vxa-power-mode>` shell. Sağ kenarda SPICE EDITOR panel (Inspector yerine veya yanında). Canvas üstünde node numaraları (SPICE geleneği, sarı). Topbar'da 4 yeni buton (Run, Stop, Save Sim, Export Plot).
- **Dahil değil:** Editör kodu (Sprint 4.2). .step / .meas / Monte Carlo panels.
- **Mimari disiplin:** "Güç = Tasarla + ek panel. Shell swap altyapısı (Sprint 3.1) üzerine gelir. Node numaraları canvas render katmanı — voltage gradient (Sprint 6.2) öncüsü."

### Sprint 4.2 — SPICE Directive Editör (Monaco)

- **Kapsam:** Monaco editor lazy-load (Güç moduna girince indirilir, diğer modlarda bundle'a girmez). SPICE syntax highlight (custom language). `.tran`, `.ac`, `.dc`, `.op`, `.meas`, `.param`, `.step`, `.include`, `.model` komutları. Auto-complete (v1 parser'ın bildiği directive listesi).
- **Dahil değil:** Multi-file, git integration, remote save.
- **Mimari disiplin:** "Lazy-load zorunlu — Monaco 500+ KB. Monaco chunk'ı sadece Güç moduna girince fetch. Dynamic import + Promise-based mount. Bundle impact: Güç'e girmeyen kullanıcı için 0 KB."

### Sprint 4.3 — `.step` Parametric Sweep

- **Kapsam:** `.step R1 100 10k decade 10` syntax → UI'da slider + param listesi. Her step değeri için ayrı solver run. Dashboard'da 11 eğri overlay (renk gradient). Slider ile aktif step değiştirilir → canvas üstündeki değerler o step'e döner.
- **Dahil değil:** Multi-parameter sweep (`.step R1 × .step C1`), corner analysis.
- **Mimari disiplin:** "Sweep = N×solver. Worker parallelism (v1 engine Worker'da). Her run ayrı `solveResult`, dashboard üstüste render. Bu altyapı What-if slider (Sprint 6.5) için de kullanılır — same mechanism, different UI."

### Sprint 4.4 — `.meas` Measurements

- **Kapsam:** `.meas tran vmax MAX V(out)` syntax. Solver run sonrası measurement hesaplanır. Panel'de listelenir. MAX, MIN, AVG, RMS, PP, AT, WHEN operatörleri.
- **Dahil değil:** Complex expression (`.meas tran vmax FIND V(out) WHEN time > 5ms`), derivative/integral.
- **Mimari disiplin:** "Post-processing v1 engine'de mevcut. UI = measurement panel component. Measurement bir 'görev' — transient sonuçları üzerinde query."

### Sprint 4.5 — Monte Carlo Panel

- **Kapsam:** Monte Carlo configuration (n=1000 default, σ=±5% default, dağılım gauss/uniform). Run → 1000 solver run (Worker pool). Histogram + yield (% devre spec'i karşılayan). Export CSV.
- **Dahil değil:** Monte Carlo için correlation analysis, sensitivity analysis.
- **Mimari disiplin:** "Heavy computation — 1000 run = ~30 saniye tipik. Progress bar + cancel. Worker pool Sprint 4.3 sweep altyapısını extend eder."

### Sprint 4.6 — 4-Slot Dashboard

- **Kapsam:** Dashboard layout Güç modunda 4 slot (2x2 grid): V(t), Bode magnitude, Bode phase, .step overlay. Her slot resize, rearrange, fullscreen. Cursor (X-Y readout).
- **Dahil değil:** Daha fazla slot (6, 8), grafik özelleştirme UI (renk, line style).
- **Mimari disiplin:** "Dashboard shell Sprint 0.4'ten genişler. Her slot bağımsız chart component. Bode = log-log scale (Sprint 0.7 transient chart'ından ayrı). Phase = degree scale."

### Sprint 4.7 — Faz 4 QA + Analog Uzman Testi

- **Kapsam:** Zenco otomatik. Mimar görsel. Şef analog tasarımcı arkadaşını çağırıp test — "LTspice'ta yaptığın son analizi burada yap". Bulgular fix sprintlerine.
- **Dahil değil:** Yeni feature.
- **Mimari disiplin:** "LTspice parity ölçütü. Tasarımcı 'buna eksik' diyorsa hangi feature? Faz 4.8 / 4.9 olarak açılır."

### Parti Bölümü — Faz 4

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 16** | 4.1, 4.2 | Güç shell + Monaco editör |
| **Parti 17** | 4.3, 4.4, 4.5 | Sweep + .meas + Monte Carlo |
| **Parti 18** | 4.6, 4.7 | 4-slot + QA |

## 5.5 Faz 6 — Amiral Gemisi

**14 sprint, 5 parti, tahmini 7-10 hafta**

### Sprint 6.1 — Canlı Fizik Altyapı (Render Katman)

- **Kapsam:** Canvas üstünde yeni render katmanı (`physics-layer`). Toggle butonu ("Canlı Fizik: Açık/Kapalı"). Solver sonuçları (voltage, current, power) renderer'a feed edilir.
- **Dahil değil:** Belirli efektler (Sprint 6.2-6.4).
- **Mimari disiplin:** "Render katmanı Canvas 2D üzerine overlay (veya WebGL eğer performans gerekirse). Solver sonuçları stream — transient sırasında animated, steady-state sonrası statik."

### Sprint 6.2 — Voltage Gradient (Tel Parlaklığı)

- **Kapsam:** Tel üzerinde voltaj değerine göre renk/parlaklık. Yüksek voltaj = parlak amber, düşük = soluk. Node → tel arası interpolate. Legend canvas kenarında.
- **Dahil değil:** Current direction arrow (ayrı bir efekt), AC phase color coding.
- **Mimari disiplin:** "Her tel iki node arası. Node voltage farkı = tel üzerinde gradient. Sprint 6.1 altyapısı. Pattern: 'data to visual' Faz 6'nın temel fikri."

### Sprint 6.3 — Heat Map (Direnç Glow)

- **Kapsam:** Direnç (ve diğer dissipative) bileşenlerde güç (P = V×I) değerine göre kırmızı glow. Threshold altında görünmez, üstünde orantılı intense.
- **Dahil değil:** Thermal simulation (gerçek sıcaklık, thermal capacity).
- **Mimari disiplin:** "Görsel geri bildirim, fiziksel değil. 'Dirençten çok güç geçiyor' sezgisel hissiyatı. Uzman için değer sağlar (yanlış değerler göze batar), öğrenci için eğitici."

### Sprint 6.4 — Manyetik Alan (İndüktör)

- **Kapsam:** İndüktör etrafında dinamik field lines (dalgalı çizgiler, akım yönüne göre). Akım arttıkça field yoğun. Akım sıfırsa field kaybolur.
- **Dahil değil:** Karşılıklı indüksiyon görselleştirme (coupled inductors Sprint 5.9 — bu daha sonra gelecek).
- **Mimari disiplin:** "Field = I × N (amper-tur). Animation frame rate 30fps yeter. Performans: 10+ indüktörlü devrede toplu render."

### Sprint 6.5 — What-if Slider Altyapı

- **Kapsam:** Inspector'daki (veya canvas'taki — Sprint 2.12) değere long-press veya Shift+drag → slider görünür. Slider hareket ettikçe solver re-run, UI real-time update.
- **Dahil değil:** Multi-parameter slider (ikisini aynı anda), slider persistent UI.
- **Mimari disiplin:** "Sprint 4.3 sweep altyapısı temel. Sweep sınırlı N run (N=10 tipik), what-if continuous (throttled 30Hz). Solver tekrar run = 50-100ms tipik, user experience için 'instant'."

### Sprint 6.6 — What-if Real-time (Graph Update)

- **Kapsam:** Slider hareket ederken dashboard grafiği anlık güncellenir. Eski eğri gölge olarak kalır (karşılaştırma için). Toggle "İzi tut".
- **Dahil değil:** Scrub-back (önceki slider pozisyonlarına dönme).
- **Mimari disiplin:** "Sprint 6.5 extend. Chart rendering incremental update (clear + redraw değil, diff update). Performans kritik — slider drag sırasında 30fps hedef."

### Sprint 6.7 — Zaman Makinesi Altyapı

- **Kapsam:** Transient simülasyon sonuçları sample sample saklanır (memory — büyük devrede 10MB+). Timeline component dashboard altında. Scrub için event.
- **Dahil değil:** Zaman makinesi UI (Sprint 6.8). Sample reduction (downsampling — eğer bellek problemiyse).
- **Mimari disiplin:** "Solver output buffer'ını saklı tut (şu an 'final' snapshot alınıyor, 'trace' full history olacak). Bellek: 1000 sample × 50 node × 8 byte = 400 KB tipik, kabul edilir."

### Sprint 6.8 — Zaman Makinesi UI (Scrub)

- **Kapsam:** Timeline scrub bar. Scrub → canvas üstündeki node voltajları o t anındaki değere döner. Play butonu → real-time playback (1x, 0.5x, 0.1x).
- **Dahil değil:** Frame-by-frame export (animated GIF).
- **Mimari disiplin:** "Zaman = yeni boyut. Kullanıcı transient sonucunu 'hissedebilir'. LTspice'ta yok. Piyasada benzeri yok — amiral gemisi özellik."

### Sprint 6.9 — AI Altyapı (API Entegrasyon)

- **Kapsam:** Claude API (Anthropic) entegrasyon. API key kullanıcı settings'te. Prompt template altyapısı. Rate limiting.
- **Dahil değil:** Specific AI features (Sprint 6.10+).
- **Mimari disiplin:** "AI = harici servis. Kullanıcı kendi API key'ini getirir (BYOK). VoltXAmpere key dağıtmaz (maliyet). Hata durumunda graceful — AI yoksa UI çalışmaya devam eder."

### Sprint 6.10 — AI Diyagnoz v1

- **Kapsam:** "Neden?" butonu Inspector'da. Seçili bileşen + simülasyon sonuçları → LLM prompt → Türkçe açıklama. Örnek: "V_out neden 3V? Çünkü R1 ve R2 bir gerilim bölücü oluşturur, V_out = V_in × R2/(R1+R2) = 5V × 3kΩ/(2kΩ+3kΩ) = 3V."
- **Dahil değil:** Multi-turn conversation (Sprint 6.11). Alternatif devre önerisi.
- **Mimari disiplin:** "Tek-shot diyagnoz. Prompt template: `{devre JSON} + {simülasyon sonuç} + {soru}`. Claude Opus 4.7 model. Türkçe çıktı quality check — teknik terminoloji tutarlı."

### Sprint 6.11 — AI Diyagnoz v2 (Türkçe Cilalı + Alternatif Öneri)

- **Kapsam:** "Bu daha iyi olur mu?" follow-up. LLM alternatif değer veya topoloji önerir. Kullanıcı kabul ederse uygulanır, Ctrl+Z ile geri.
- **Dahil değil:** Otomatik uygulama (her zaman kullanıcı onayı).
- **Mimari disiplin:** "Multi-turn prompt. Context preservation. Öneri apply = Sprint 2.10 parameter edit altyapısı — mutation + undo snapshot."

### Sprint 6.12 — NL → Devre v1 (İskelet Generation)

- **Kapsam:** "12V'tan 3.3V LDO yap" prompt → LLM devre iskeleti (JSON) → canvas'a yerleştirilir. Temel topoloji — bileşenler + değerler + bağlantılar.
- **Dahil değil:** Tasarım seçeneği açıklaması (Sprint 6.13). Multi-stage circuits.
- **Mimari disiplin:** "LLM structured output — JSON schema. Hatalı output (geçersiz JSON, yanlış bileşen tipi) retry + fallback. User always sees what LLM generated before apply."

### Sprint 6.13 — NL → Devre v2 (Açıklamalı)

- **Kapsam:** Her bileşen için "Neden bu?" — "LM317 seçildi çünkü tipik LDO, kolay bulunur, %1 hassasiyet yeterli." Değerler için hesaplama gösterilir.
- **Dahil değil:** Alternatif topoloji önerisi ("Bunu switching regulator ile de yapabilirdik").
- **Mimari disiplin:** "Öğretici AI. Sadece devre vermez, nedenini anlatır. Bu 'dünya markası' farkıdır — rakipler LLM ile devre üretir, VoltXAmpere neden o devre olduğunu da anlatır."

### Sprint 6.14 — Faz 6 QA + Kullanıcı Testi

- **Kapsam:** Zenco otomatik. Mimar görsel. Şef farklı kullanıcı tipleriyle test (öğrenci + uzman + çocuk). Her amiral özellik her kullanıcı için faydalı mı?
- **Dahil değil:** Yeni feature.
- **Mimari disiplin:** "Amiral gemisi özellikler hedefe hizmet ediyor mu? Çocuk 'zaman makinesi' ile LED yanışını anlamlandırdı mı? Uzman 'what-if slider' ile sweep yerine bunu kullanır mı? Kullanıcı yanıtı kritik."

### Parti Bölümü — Faz 6

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 19** | 6.1, 6.2 | Fizik altyapı + voltage gradient |
| **Parti 20** | 6.3, 6.4 | Heat map + manyetik alan |
| **Parti 21** | 6.5, 6.6 | What-if slider |
| **Parti 22** | 6.7, 6.8 | Zaman makinesi |
| **Parti 23** | 6.9, 6.10, 6.11 | AI diyagnoz |
| **Parti 24** | 6.12, 6.13, 6.14 | NL → devre + QA |

## 5.6 Faz 7 — Polish + Ticari

**10 sprint, 4 parti, tahmini 5-6 hafta**

### Sprint 7.1 — Ayarlar Menüsü
- **Kapsam:** Gear ikon topbar'da → modal. Dil (TR/EN), tema (karanlık/aydınlık), kısayol listesi, performans seçenekleri (FPS limit, background worker count), API key ayarları (Sprint 6.9 AI için).
- **Dahil değil:** Kısayol customization (sadece göster, henüz değiştirilemez).
- **Mimari disiplin:** "Settings = kullanıcı state, localStorage'da. Uygulama başlangıcında yüklenir, global provider pattern."

### Sprint 7.2 — Onboarding (3-adım tur)
- **Kapsam:** İlk açılışta "Hoş geldin" → "İşte Tasarla modu" → "Keşfet ve Güç modlarını dene" → bitti. Tooltip bubble'lar canvas üstünde.
- **Dahil değil:** Detaylı tutorial (Faz 3 dersleri ayrı).
- **Mimari disiplin:** "One-time. `localStorage.onboarded = true`. Skip butonu. Açık kapalı toggle Settings'te."

### Sprint 7.3 — Landing Page Redesign
- **Kapsam:** voltxampere.com ana sayfa yeniden tasarım. "Dünyanın en iyi devre simülatörü" iddia + 3-mod tanıtım + 30-saniye demo video + "Şimdi Dene" CTA.
- **Dahil değil:** Blog, community.
- **Mimari disiplin:** "Marketing site. Ayrı repo veya aynı repo/farklı route? Karar: aynı repo, `/` = landing, `/app` = uygulama, `/legacy` = v1."

### Sprint 7.4 — Responsive Layout (Tablet)
- **Kapsam:** iPad, Android tablet. Sidebar collapse, inspector bottom-sheet. Canvas dokunmatik (Sprint 7.6 ayrı). CSS media query breakpoint'ler.
- **Dahil değil:** Mobil phone (Sprint 7.5).
- **Mimari disiplin:** "Tablet = tam fonksiyonalite, daraltılmış layout. 768px-1024px breakpoint."

### Sprint 7.5 — Responsive Layout (Mobil)
- **Kapsam:** Phone (<768px). Canvas tam ekran. Sidebar hamburger menu. Inspector tıkla → modal. Basit Keşfet modu öncelikli.
- **Dahil değil:** Landscape optimization detaylı. Native app (Capacitor / ionic).
- **Mimari disiplin:** "Mobil = Keşfet mode öncelikli. Tasarla/Güç mobile olmaz, 'Geniş ekranda daha iyi' mesajı."

### Sprint 7.6 — Dokunmatik Input
- **Kapsam:** Pinch zoom, iki-parmak pan, uzun-basma seçim, tek-parmak drag. Sprint 2.15-2.16 viewport zoom/pan pinch ile entegre.
- **Dahil değil:** Haptic feedback.
- **Mimari disiplin:** "Touch events pointer events API (modern browser). Mouse ile aynı hit-test pipeline, sadece event kaynak farklı."

### Sprint 7.7 — Kalem Input (iPad Pencil)
- **Kapsam:** Wire çizimi kalemle özellikle hassas. Pressure-sensitive değişken line width (aesthetic). Palm rejection (touch ignore when pencil active).
- **Dahil değil:** Handwriting recognition (kalem ile metin yazma).
- **Mimari disiplin:** "Pointer events pressure property. iPad Pencil specific detect."

### Sprint 7.8 — Türkçe Audit + Terminoloji Standardizasyon
- **Kapsam:** Tüm UI metinleri Türkçe audit. Terminoloji listesi (`docs/TURKISH-GLOSSARY.md`): kondansatör veya kapasitör? bobin veya endüktör? tutarlılık. Hata mesajları, tooltip'ler, dersler, AI çıktıları hepsi kontrol.
- **Dahil değil:** Başka dil (EN ayrı sprint değil, zaten paralel sürüyor).
- **Mimari disiplin:** "Tek kaynaklı i18n. `messages.tr.json` + `messages.en.json`. Inline string yasak. Glossary version-controlled."

### Sprint 7.9 — v1 → v2 Path Swap
- **Kapsam:** voltxampere.com = v2, voltxampere.com/legacy = v1. Analytics ile geçiş izle. Eski v2 URL'i (/v2) redirect.
- **Dahil değil:** v1 kapatma (Sprint 7.10).
- **Mimari disiplin:** "Veri migrasyon: v1 localStorage formatı → v2 formatı (Sprint 2.17 şema). Otomatik upgrade. Backward compat 6 ay."

### Sprint 7.10 — v1 Sunset Kararı (6 ay sonra)
- **Kapsam:** Analytics verisi — v1 kullanımı %5 altına düştüyse sunset. Sunset = redirect kaldır, v1 kodu arşiv (silinmez, sadece dağıtımdan kalkar).
- **Dahil değil:** v1 kod silme (arşivde kalır).
- **Mimari disiplin:** "Veriye dayalı karar. %5 eşik. Üstündeyse ertelenir. Altındaysa 1 ay önceden duyuru + legacy warning banner."

### Parti Bölümü — Faz 7

| Parti | Sprintler | Hedef |
|---|---|---|
| **Parti 25** | 7.1, 7.2 | Ayarlar + onboarding |
| **Parti 26** | 7.3 | Landing page (tek sprint ama büyük) |
| **Parti 27** | 7.4, 7.5 | Responsive tablet + mobil |
| **Parti 28** | 7.6, 7.7 | Touch + Pencil |
| **Parti 29** | 7.8 | Türkçe audit |
| **Parti 30** | 7.9, 7.10 | v1 → v2 swap + sunset |

---

# §6 — DİSİPLİN PRENSİPLERİ

Bu prensipler sprint spec'lerine girmez ama her spec'in arkasında durur. Architect agent bu prensiplere aykırı spec üretmemelidir; üretirse verifier block eder.

## 6.1 Tek Kaynak Disiplini (Sprint 0.7 kökeni)

Dashboard, probe, grafik, AI diyagnoz, her şey **tek `solveResult` snapshot'undan beslenir**. Farklı kaynaklardan besleme = tutarsızlık garantisi. Sprint 2.7 hatası (V=0 ama I=33.94µA stale) bu disiplinin aşınmasından doğdu.

Kontrol: Herhangi bir sayısal değeri UI'da gördüğünde bu değerin tek bir solver run'dan geldiğini garanti edebilir misin?

## 6.2 Başarısızlık Kendi Durumudur (Sprint 1.3 → 2.7 revizyonu)

Solver başarısızsa **eski sonucu koruma.** `solveResult = null`, kind = 'error', UI "—" gösterir. Stale değer > UI flicker değil, **stale değer < UI flicker** — değer güveni kalıcı kayıp.

4-state matrix (ok / empty / floating / error) bu prensibin kristalleşmiş hali. Yeni bir "aralıkta" durum bulursan, matris genişler, ama içinden değer sızdırmaz.

## 6.3 Layout vs Circuit Ayrımı (Sprint 2.9 rotation kökeni)

Rotation, zoom, pan, switch state, wiper pozisyonu — bunlardan hangisi **circuit'i değiştirir**, hangisi **layout'ı**? Ayrım net olmalı.

- Rotation = layout only (circuit topology aynı)
- Switch = circuit (açık/kapalı = topology değişir)
- Wiper = circuit (direnç değeri değişir)
- Zoom/pan = view only (circuit + layout aynı)

Yeni özellik eklerken ilk soru: "Bu circuit mutation mu, layout mutation mu, view-only mi?" Solver çağrısı bu cevaba bağlı.

## 6.4 Türkçe Birinci Sınıf

- Her UI metni Türkçe
- Teknik terminoloji tutarlı (glossary ile — Sprint 7.8)
- Hata mesajları Türkçe
- AI çıktıları Türkçe (prompt Türkçe instruction)
- Yorumlar Türkçe (kod yorumları)
- Commit mesajları EN (git ekosistem uyumluluğu)

Audit her faz sonu (küçük), Faz 7.8'de tam audit.

## 6.5 LED STOP — ngspice Ground Truth

**Tetikleyici kelimeler** (architect görürse durur): LED, diode, zener, diyot, BJT, MOSFET, JFET, transistor, transistör, non-linear, nonlinear, solver değişikliği, MNA, Newton-Raphson, fixed-point, iteratif çözüm.

Tek istisna: Sprint 5.0 (ngspice verification strategy). Bu sprint yazılmadan 5.1+ yazılamaz.

Sebep: v2'de ground truth yok. v1 ngspice 46 KLU solver ile kalibre. v2 aynı engine'i Worker'da kullanıyor ama bileşen-bazlı doğrulama yapılmadı. Non-linear bileşen sessizce bozuk = Great Reset (Sprint 98-103 fabrication dersi).

## 6.6 Üç Kalite Ölçütü (Her Spec İçin)

Her sprint spec'i verifier agent tarafından **üç ölçüt** üzerinden kontrol edilir:

**A) "Dahil Değil" bölümü gerçek mi?**
Şablonik değil, spesifik. "Waypoint silme UI YOK" spesifik, "gelişmiş özellikler YOK" şablonik.

**B) Önceki sprint referansları isimsel mi?**
"Sprint 1.2 TerminalRef format" spesifik, "önceki sprint'lere uygun" şablonik.

**C) Mimari disiplin katmanı var mı?**
Bug/feature'ı **felsefi** konumlandırma. "Rotation = layout-only transform" disiplin, "R tuşu döndürür" sadece açıklama.

Üçünden biri eksikse verifier BLOCK. Architect agent spec revize eder. 3 iterasyon sonra hala eksikse → mimar'a kapı açık.

## 6.7 Parti Kapanış Protokolü

Her parti sonunda zorunlu:

1. Tüm sprint'ler commit + push
2. Bundle rapor (toplam Δ)
3. Zenco otomatik regresyon (önceki sprint'ler)
4. Mimar görsel inceleme
5. Şef manuel smoke test (5-10 dakika)
6. Parti sonrası doküman: Sprint sayısı, süre, bulunan buglar, bir sonraki parti kapsamı

Bu protokol olmadan parti "bitmez". Yeni parti başlamaz.

## 6.8 Kapı Açık Politikası

Otomasyon **her zaman değiştirilebilir**:

- İlk iki parti kalite ölçütleri tutmazsa → mimar'a geri dön
- LED STOP tetikleniyorsa → dur, Şef'i çağır
- Eşik ihlali (bundle) → parti durdur
- Şef "durdur" derse → her durumda durdurur

Otomasyon araç, amaç değil.

---

# §7 — RİSKLER VE AZALTMA

## R1 — LED Sessiz Bozukluk (YÜKSEK)

Non-linear bileşen v2'de hiç test edilmedi. LED yerleştirmenin sessizce yanlış davranması = Great Reset tekrarı.

**Azaltma:**
- Sprint 5.0 ngspice verification strategy **zorunlu**, atlamaz
- LED STOP kuralı (§6.5)
- Her non-linear sprint'te ngspice regresyon
- Faz 5.10 QA sprintinde batch doğrulama

**Erken uyarı:** Zenco "bileşen çalışıyor" diyor ama ngspice karşılaştırması yok = RED flag. Sprint 2.5-2.8 deneyimi.

## R2 — Mode Switching State Loss (ORTA)

Keşfet → Tasarla → Güç geçişlerinde circuit state kaybolabilir. Özellikle Undo history, seçim, hover.

**Azaltma:**
- Sprint 3.1 altyapı sprinti ayrı — yalnız shell swap, içerik yok
- Test matrisi: her mod çifti (6 kombinasyon) × state koruma
- State = global store (tek yerde), shell yalnızca tüketici

**Erken uyarı:** Sprint 3.1 sonrası "state kayboluyor" bug → fix sprinti 3.1.1.

## R3 — Bundle Şişmesi (ORTA)

Faz 2B sonu 124.78 KB. Her sprint +5 KB = Faz 7 sonu ~500 KB. Monaco editor tek başına 500+ KB ekleyebilir.

**Azaltma:**
- Sprint 4.2 Monaco **lazy-load** zorunlu (Güç moduna girince indirilir)
- Faz 6 AI = API-based, bundle etkisi yok (prompt + response)
- Her parti sonu bundle raporu
- Tree-shake lucide-react icons (Faz 5)
- Hedef: Faz 7 sonu < 200 KB gzip (Monaco hariç, Monaco lazy)

**Erken uyarı:** Sprint başına +5 KB aşımı otomatik BLOCK.

## R4 — Pipeline Kalite Drift (DÜŞÜK-ORTA)

Otomasyon parti sayısı arttıkça spec kalitesi düşebilir — şablonik prompt üretimi.

**Azaltma:**
- İlk iki parti Şef + mimar spec review
- Her 5 parti'de bir mimar bağımsız audit
- Kalite drift görülürse kapı açık (§6.8)
- 3 ölçüt kontrolü (§6.6) ihlali = BLOCK

**Erken uyarı:** "Dahil Değil" bölümü genel şeyler içermeye başlıyor ("ileri özellikler yok", "refactor yok"). Bu şablonik → drift.

## R5 — AI Integration Dependency (ORTA)

Faz 6.9-6.13 Claude API'sine bağlı. API değişirse, maliyet değişirse, kesintide ürün yarı işlemez.

**Azaltma:**
- AI = opsiyonel feature, ana UX değil
- Hata durumunda graceful (AI yok → UI çalışmaya devam eder)
- BYOK (kullanıcı kendi key'i) = cost sorumluluğu kullanıcıda
- API version pinning (`claude-opus-4-7` spesifik)

**Erken uyarı:** API hata oranı > %5 = feature flag kapat.

## R6 — v1 → v2 Swap Acele (DÜŞÜK)

Faz 7.9'da v2 ana path'e geçer. v2 henüz doğrulanmamışsa kullanıcı kaybı.

**Azaltma:**
- v1 /legacy altında 6 ay (§7.10 sunset kararı analytics ile)
- Swap öncesi %10 canary rollout
- Swap sonrası rollback planı (DNS bir saatte geri)

**Erken uyarı:** Swap sonrası 24 saat hata oranı > v1 → otomatik rollback.

## R7 — Kullanıcı Testi Kalitesi (ORTA)

Sprint 3.8 (5 çocuk testi), Sprint 4.7 (analog uzman testi) — doğru insanları bulmak zor.

**Azaltma:**
- Şef lokal çevre (Marmara öğrenci grubu, 360 Studio network)
- Minimum sayılar: 5 çocuk, 3 EE öğrencisi, 2 analog uzman
- Test protokolü önceden (task list, metric)
- Olumsuz sonuç = fix sprinti, olumlu sonuç = faz kapanış

**Erken uyarı:** Test sonucu "vasat" (ne iyi ne kötü) → muğlak bırakma, fix sprinti aç.

---

# §8 — ŞİMDİ NE YAPILIR

## 8.1 Bu Doküman Nereye Konur

1. `/home/claude/V2-ROADMAP.md` (bu dosya)
2. Proje reposuna: `VoltXAmpere/docs/V2-ROADMAP.md`
3. Git commit: `docs: add V2-ROADMAP — 78 sprint plan`
4. Her parti kapanışında §5 tablosu güncellenir (tamamlanan sprintler işaretli, bir sonrakinin detayı genişletilir)

## 8.2 Bu Doküman Nasıl Okunur

- **Şef:** §1, §2, §4, §8 + karar anlarında §5 ilgili sprint tablosu
- **Mimar (yeni oturum):** §3, §5, §6 + §7 (her sprint öncesi)
- **Architect agent:** §5'in üç satırlık sprint tanımı + §6.6 üç ölçüt

## 8.3 Sonraki Adımlar (Sıra)

1. **Şef doküman kabul etti** ✅ (21 Nisan 2026)
2. Parti 2 başlatma (Sprint 2.10 + 2.11). Architect agent §5.1 Sprint 2.10 satırından spec yazar.
3. Spec Şef + mimar review (ilk parti özel disiplini).
4. Review geçerse: Implementer → Verifier → commit+push.
5. Parti 2 sonu: Bu doküman §2 ve §5.1 tablosu güncellenir.

## 8.4 Canlı Doküman Güncelleme Kuralı

Bu doküman **donmuş değil**. Güncelleme tetikleyicileri:

- **Her parti sonu (zorunlu):** §2 durum tablosu, §5 ilgili sprint tablosu
- **Her faz sonu (zorunlu):** Yapılan iş özeti, sonraki faz detaylarının genişletilmesi
- **Kapsam değişikliği (Şef kararı):** İlgili bölüm revize, değişiklik notu
- **Risk materyalize olursa:** §7'de "olay" notu, azaltma planı güncellemesi
- **Otomasyon kalite drift:** §6.6 ölçüt sonuçları eklenir, gerekiyorsa mimar müdahale

Versiyon izleme: Git history yeterli. Büyük değişikliklerde (roadmap yeniden yazım) versiyon bump: V2-ROADMAP v2, v3 vb.

---

# §9 — ÖLÇÜ TABLOSU (Gidişat Sayısal Takibi)

Her parti sonu bu tablonun satırı doldurulur. Trend izleme:

| Parti | Sprintler | Süre (gün) | Bundle Δ | Kümülatif Bundle | Bug | Fix Sprint | Kalite Ölçütü | Notlar |
|---|---|---|---|---|---|---|---|---|
| Parti 1 | 2.9 | 1 | +1.14 KB | 124.78 KB | 0 | 0 | 3/3 | Rotation, pipeline test |
| Parti 2 | 2.10, 2.11 | ? | ? | ? | ? | ? | ?/3 | Parametre + waypoint |
| Parti 3 | 2.12, 2.13, 2.14 | ? | ? | ? | ? | ? | ?/3 | Inline edit + GND + switch |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Yaşayan metrikler:**
- **Hız:** Parti başına ortalama gün (hedef: 7-10 gün)
- **Bundle trend:** Her 5 partide trend (hedef: düzgün artış, sıçrama yok)
- **Kalite:** 3/3 ölçüt geçme oranı (hedef: %100, tolerans %90)
- **Bug trend:** Parti başına bug sayısı (hedef: düşen trend, Faz 5+'ta sıfıra yakın)

Bu metrikler gerçek zamanlı "roadmap sağlıklı mı?" cevabı verir.

---

# §10 — SON SÖZ

VoltXAmpere'ın 78 sprintlik yolu çizildi. 8-9 ay, 30 parti, 6 faz.

Bu doküman "mükemmel" değil — mükemmel doküman yoktur. Ama **yeterince iyi**: Şef karar verebilir, mimar sprint yazabilir, architect agent spec üretebilir, verifier kalite denetleyebilir.

Yol uzun. Ama her parti sonunda biraz daha yakına geliyoruz. İlk parti (Sprint 2.9) bitti — rotation yerinde, otomasyon kanıtlandı. Şimdi Parti 2: parametre düzenleme + waypoint wire.

VoltXAmpere dünyanın en iyi devre simülatörü olacak. 78 sprint uzakta.

---

**EKLENTİ — Doküman Bakım Kuralları**

Bu doküman yaşayan bir belgedir. Aşağıdakileri ihlal etmeyin:

1. **Sprint numarası çakışmaz.** 2.10 ayrıdır, 2.10.1 ayrıdır (fix), 2.10 asla silinmez.
2. **§5 tabloları tamamlanan sprint'ler için check-mark ekler,** satırı silmez.
3. **Kapsam kilidi korunur.** "Dahil değil" listesi sonraki sprint'e taşınır, yok olmaz.
4. **Risk bölümü güncellenir,** silinmez. Materyalize olan risk "olay notu" ekler.
5. **Versiyon bump büyük revizyonlarda.** Küçük güncellemeler git commit, büyük revizyonlar versiyon numarası.

Bu kurallar ihlal edilirse doküman çöpe döner.

---

*Doküman kapanış: 21 Nisan 2026, Sprint 2.9 sonrası. Şef onayı: kabul.*
