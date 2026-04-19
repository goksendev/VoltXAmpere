// VoltXAmpere v2 — <vxa-canvas> (Sprint 0.3).
// Tek sorumluluğu: HTMLCanvasElement mount etmek, Canvas 2D context açmak,
// üzerine statik noktalı grid çizmek. Pan, zoom, etkileşim YOK — sonraki sprintler.
//
// Kritik teknik nokta: DPI scaling. Retina ekranlarda canvas'ın iç çözünürlüğünü
// devicePixelRatio ile çarpıyor, CSS boyutunu host'u dolduracak şekilde tutuyor
// ve context'i DPR ile ölçekliyoruz. Yanlış yapılırsa noktalar bulanık çıkar.
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

// ─── Grid sabitleri ──────────────────────────────────────────────────────────
// Küçük grid adımı: 16 CSS piksel. Devre bacakları ve wire snap için ideal bir
// denge — 8px fazla yoğun (görsel gürültü), 20px fazla seyrek (hassasiyet kaybı).
// Falstad / EveryCircuit de benzer 16-20px bandını kullanır.
const MINOR_STEP = 16;

// Büyük grid adımı: her 5 küçük grid'de bir majör nokta (efektif 5 × 16 = 80 CSS
// piksel aralık). Göz tarama sırasında "burası neresi" referans noktası veriyor.
// Sabit 80'i ayrıca tanımlamıyoruz çünkü MINOR_STEP × MAJOR_STEP_RATIO yeterli —
// aynı değerin iki kaynağı divergence riskidir.
const MAJOR_STEP_RATIO = 5;

// Nokta boyutları (CSS piksel).
// Küçük: 1px tam piksel → keskin doldurulur (fillRect 1x1, integer koordinat).
// Büyük: 1.4px → minör ile açık ayırt edilecek kadar iri ama "blok" olmayan
// yumuşak anti-aliased nokta. 2px yapmak kocaman görünüyor.
const MINOR_DOT = 1;
const MAJOR_DOT = 1.4;

@customElement('vxa-canvas')
export class VxaCanvas extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* Debug etiketi: canvas CSS boyutu + DPR. Sprint 0.5-0.6 civarı kaldırılır
       veya dev-mode-only olur. Şimdilik doğrulama için sağ alt köşede. */
    .debug-label {
      position: absolute;
      bottom: var(--sp-2);
      right: var(--sp-2);
      padding: var(--sp-1) var(--sp-2);
      background: rgba(0, 0, 0, 0.4);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-4);
      border-radius: var(--r-1);
      pointer-events: none;
      letter-spacing: 0.05em;
    }
  `;

  // Canvas DOM elementine Lit ref ile ulaşıyoruz. querySelector shadow DOM'da
  // da çalışır ama ref daha tipli ve yaşam döngüsü güvenli.
  private readonly canvasRef: Ref<HTMLCanvasElement> = createRef();

  // Host boyut değişimini izleyen ResizeObserver. Window resize değil — host
  // element (canvas zone) herhangi bir sebeple boyutlanırsa (ör. gelecekte
  // inspector collapse) tetiklenir.
  private resizeObserver: ResizeObserver | null = null;

  // Art arda gelen resize olaylarını rAF ile tek frame'e birleştirir.
  private rafHandle: number | null = null;

  // Debug etiketi için reactive state — canvas CSS boyutu ve DPR her çizimde
  // güncellenir.
  @state() private cssW = 0;
  @state() private cssH = 0;
  @state() private dpr = 1;

  override firstUpdated(): void {
    const canvas = this.canvasRef.value;
    if (!canvas) {
      throw new Error('vxa-canvas: canvas referansı alınamadı');
    }
    // getContext null dönebilir (çok eski tarayıcı / disabled). Fallback yok —
    // plan gereği sert hata fırlat.
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('vxa-canvas: Canvas 2D context alınamadı');
    }

    // Host boyutunu gözle. İlk çizimi de observer ilk callback'i tetikleyecek,
    // ama emniyet için bir ilk draw zamanlıyoruz.
    this.resizeObserver = new ResizeObserver(() => this.scheduleDraw());
    this.resizeObserver.observe(this);
    this.scheduleDraw();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private scheduleDraw(): void {
    // Birden fazla resize callback'i aynı frame içinde tek bir draw'a dönüşsün.
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
    }
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.draw();
    });
  }

  private draw(): void {
    const canvas = this.canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ─── DPI scaling ──────────────────────────────────────────────────────
    // devicePixelRatio: 1 (standart), 2 (Retina), 3 (Samsung AMOLED vb.).
    // Multi-monitor'da pencere taşınınca değişebilir — her draw'da taze oku.
    const dpr = window.devicePixelRatio || 1;
    // clientWidth/Height: canvas'ın CSS (layout) boyutu — host 100% doldurur.
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;

    // 0×0 host'ta draw yapma — RAF sırası öncesi henüz layout yoksa atla.
    if (cssW === 0 || cssH === 0) return;

    // Canvas'ın iç (piksel) çözünürlüğü = CSS boyut × DPR. Bu fiziksel piksel
    // sayısı. Aksi halde Retina'da 1 CSS piksel = 4 fiziksel piksel "boyanır".
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // CSS boyutu host'u doldurmaya devam etsin (layout bozulmasın).
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    // Önceki transform'u sıfırla, sonra DPR kadar ölçekle. Artık CSS
    // koordinatlarında çizim yaparız, browser fiziksel pikselle haritalar.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // ─── Arka plan ────────────────────────────────────────────────────────
    // Canvas zone'unun --canvas rengi zaten host arkasında — transparent
    // bırakmak yerine explicit temizlik yap (transform reset sonrası kalıntı
    // olmasın).
    ctx.clearRect(0, 0, cssW, cssH);

    // ─── Renk tokenlerini oku ─────────────────────────────────────────────
    // CSS custom property string formatında. Canvas 2D fillStyle direkt CSS
    // color string kabul eder ("rgba(200, 210, 230, 0.22)" gibi).
    const styles = getComputedStyle(this);
    const minorColor = styles.getPropertyValue('--canvas-dot').trim();
    const majorColor = styles.getPropertyValue('--canvas-dot-maj').trim();

    // ─── Merkez-odaklı grid hesabı ────────────────────────────────────────
    // Canvas'ın görsel merkezi grid origin'i — merkezde her zaman bir majör
    // nokta olsun istiyoruz. (i, j) = (0, 0) orada.
    const centerX = cssW / 2;
    const centerY = cssH / 2;

    // Merkezden dışa tarama: i, j integer index'leri. Canvas sınırları dışını
    // hesaplama.
    const startI = -Math.ceil(centerX / MINOR_STEP);
    const endI = Math.ceil((cssW - centerX) / MINOR_STEP);
    const startJ = -Math.ceil(centerY / MINOR_STEP);
    const endJ = Math.ceil((cssH - centerY) / MINOR_STEP);

    // ─── Çizim ────────────────────────────────────────────────────────────
    // Minör ve majör noktaları iki ayrı geçişte çiz — fillStyle değişikliği
    // sadece iki kez. Nokta başına fillStyle ayarlamak state machine
    // maliyeti doğurur.
    //
    // Half-pixel bulanıklığını engellemek için koordinatları Math.round ile
    // integer pikseline oturtuyoruz. fillRect(x, y, 1, 1) böylece tam bir CSS
    // pikselini doldurur.
    ctx.fillStyle = minorColor;
    for (let i = startI; i <= endI; i++) {
      // i veya j majör çizgide ise bu noktayı ikinci geçişte çizeceğiz.
      const iMajor = i % MAJOR_STEP_RATIO === 0;
      const x = Math.round(centerX + i * MINOR_STEP);
      for (let j = startJ; j <= endJ; j++) {
        if (iMajor && j % MAJOR_STEP_RATIO === 0) continue; // bunu majör'de çiziyoruz
        const y = Math.round(centerY + j * MINOR_STEP);
        ctx.fillRect(x, y, MINOR_DOT, MINOR_DOT);
      }
    }

    ctx.fillStyle = majorColor;
    // Majör noktalar yalnızca MAJOR_STEP aralıklarında (her 5 küçük gridde bir).
    // MAJOR_DOT 1.4 olduğu için kenarda anti-aliasing var — bu kasıtlı, minör
    // nokta ile kalınlık farkını belli etmek için.
    const majHalf = MAJOR_DOT / 2;
    const startIM = Math.ceil(startI / MAJOR_STEP_RATIO) * MAJOR_STEP_RATIO;
    const startJM = Math.ceil(startJ / MAJOR_STEP_RATIO) * MAJOR_STEP_RATIO;
    for (let i = startIM; i <= endI; i += MAJOR_STEP_RATIO) {
      const x = Math.round(centerX + i * MINOR_STEP);
      for (let j = startJM; j <= endJ; j += MAJOR_STEP_RATIO) {
        const y = Math.round(centerY + j * MINOR_STEP);
        ctx.fillRect(x - majHalf, y - majHalf, MAJOR_DOT, MAJOR_DOT);
      }
    }

    // ─── Debug state güncelle ─────────────────────────────────────────────
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
  }

  override render() {
    return html`
      <canvas ${ref(this.canvasRef)} aria-label="devre canvas"></canvas>
      <div class="debug-label" aria-hidden="true">
        canvas: ${this.cssW} × ${this.cssH} · DPR: ${this.dpr}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-canvas': VxaCanvas;
  }
}
