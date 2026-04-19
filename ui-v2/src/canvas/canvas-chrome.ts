// VoltXAmpere v2 — <vxa-canvas-chrome> (Sprint 0.10).
//
// Canvas'ın üzerinde yüzen overlay katmanı: sol üst deney başlığı badge'i,
// sağ altta transport bar + zoom panel (canvas-ctrl wrapper'ı). Tüm butonlar
// GÖRSEL — fonksiyonel değil. Tıklama `[TODO]` log'u bırakır. Gerçek play/
// zoom/timeline davranışı Sprint 1.x+'da bağlanacak.
//
// Neden ayrı component? Shadow DOM içinde overlay'ler canvas'ın draw'ına
// dokunmaz; props Lit reactive ile otomatik yansır; ileride chrome'u
// <vxa-canvas>'tan taşımak veya gizlemek tek satır değişiklikle olur.
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('vxa-canvas-chrome')
export class VxaCanvasChrome extends LitElement {
  static override styles = css`
    :host {
      /* Canvas'ın host'una göre overlay. pointer-events:none → canvas'a
         gelen tıklamalar buradan geçer; sadece butonlar pointer-events:auto. */
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    /* ─── Sol üst: Deney başlığı badge ───────────────────────────────────
       rgba(13, 15, 19, ...) = --bg-1 opaklık azaltılmış hâli. Token sistemi
       backdrop-filter ile uyumsuz olduğundan Sprint 0.10'da literal tutuldu;
       Sprint 1.x'te --overlay-bg-xx gibi token'lar eklenecek. */
    .chapter-badge {
      position: absolute;
      top: var(--sp-3);
      left: var(--sp-3);
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3);
      background: rgba(13, 15, 19, 0.75);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid var(--line);
      border-radius: var(--r-2);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-2);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .chapter-badge .amber {
      color: var(--accent);
      font-weight: 600;
    }

    /* ─── Sağ alt: transport + zoom wrapper ──────────────────────────────
       Tek position:absolute; iç öğeler dikey stack. Wrapper ardışık
       yükseklik değişimlerini kendi toparlıyor. */
    .canvas-ctrl {
      position: absolute;
      bottom: var(--sp-3);
      right: var(--sp-3);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--sp-2);
      pointer-events: auto;
    }

    /* ─── Transport bar ──────────────────────────────────────────────── */
    .transport-bar {
      display: inline-flex;
      align-items: center;
      background: rgba(13, 15, 19, 0.9);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--line-str);
      border-radius: var(--r-3);
      padding: 3px;
      gap: 1px;
      /* Kayan-kart hissi — koyu zemin altında transport öne çıksın. */
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    }

    .tr-btn {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0;
      color: var(--fg-2);
      cursor: pointer;
      border-radius: var(--r-2);
      transition: background 120ms, color 120ms;
    }
    .tr-btn:hover {
      background: var(--bg-3);
      color: var(--fg);
    }
    .tr-btn.play {
      background: var(--accent);
      color: #0A0A0B; /* --on-accent adayı (Sprint 1.x token) */
      /* rgba(255, 184, 77, 0.45) = --accent glow adayı (Sprint 1.x token). */
      box-shadow: 0 0 14px rgba(255, 184, 77, 0.45);
    }
    .tr-btn.play:hover {
      background: var(--accent);
      color: #0A0A0B;
    }
    .tr-btn svg {
      width: 14px;
      height: 14px;
    }

    .tr-time {
      padding: 0 var(--sp-3);
      margin-left: 3px;
      border-left: 1px solid var(--line-str);
      font-family: var(--mono);
      font-size: var(--fs-sm);
      font-weight: 500;
      color: var(--fg);
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 92px;
      box-sizing: border-box;
    }

    .tr-status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 6px var(--ok);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .tr-status-dot.is-stopped {
      background: var(--fg-3);
      box-shadow: none;
      animation: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.5; }
    }

    /* ─── Zoom paneli ────────────────────────────────────────────────── */
    .zoom-panel {
      display: inline-flex;
      align-items: center;
      gap: 1px;
      background: rgba(13, 15, 19, 0.88);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid var(--line-str);
      border-radius: var(--r-3);
      padding: 2px;
    }

    .zoom-btn {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0;
      color: var(--fg-2);
      cursor: pointer;
      border-radius: var(--r-2);
      transition: background 120ms, color 120ms;
    }
    .zoom-btn:hover {
      background: var(--bg-3);
      color: var(--fg);
    }
    .zoom-btn svg {
      width: 12px;
      height: 12px;
    }

    .zoom-val {
      padding: 0 var(--sp-2);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg);
      font-weight: 500;
      min-width: 40px;
      text-align: center;
    }
  `;

  // NOT: HTMLElement.title ile çakışmasın diye 'expTitle'. Attribute adı
  // default olarak 'exptitle' — bu sprint'te attribute kullanılmıyor (design-
  // mode .expTitle=${...} property binding).
  @property() expTitle = 'DENEY';
  @property() subtitle = '';
  @property({ type: Boolean }) isPlaying = false;
  @property() simTime = '—';
  @property({ type: Number }) zoom = 100;

  // ─── Click handler'lar — Sprint 0.10 hepsi [TODO] log. ────────────────
  private onZoomClick(dir: 'in' | 'out'): void {
    console.log(`[TODO] zoom-${dir} · Sprint 1.x+`);
  }

  private onPlayClick(): void {
    console.log(`[TODO] play/pause toggle · Sprint 1.x+`);
  }

  private onTimelineClick(dir: 'prev' | 'next'): void {
    console.log(`[TODO] timeline ${dir} · Sprint 1.x+`);
  }

  /** Subtitle'ı "·" ile böl, son parça amber meta olarak render edilir.
   * "Alçak Geçiren RC Süzgeç · f_c ≈ 15.9 kHz" → main + meta. */
  private splitSubtitle(): { main: string; meta: string } {
    const parts = this.subtitle.split('·').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return { main: '', meta: '' };
    if (parts.length === 1) return { main: parts[0]!, meta: '' };
    return {
      main: parts.slice(0, -1).join(' · '),
      meta: parts[parts.length - 1]!,
    };
  }

  override render() {
    const { main, meta } = this.splitSubtitle();
    const statusText = this.isPlaying ? 'Çalışıyor' : 'Duraklatıldı';
    const timeText = this.isPlaying ? this.simTime : '—';

    return html`
      <div class="chapter-badge" aria-label="deney başlığı">
        <span class="amber">${this.expTitle}</span>
        ${main ? html`<span>${main}</span>` : ''}
        ${meta ? html`<span class="amber">${meta}</span>` : ''}
      </div>

      <div class="canvas-ctrl">
        <div class="transport-bar" role="toolbar" aria-label="transport">
          <button
            type="button"
            class="tr-btn"
            aria-label="önceki"
            @click=${() => this.onTimelineClick('prev')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="19,20 9,12 19,4"></polygon>
              <rect x="5" y="4" width="2" height="16"></rect>
            </svg>
          </button>
          <button
            type="button"
            class="tr-btn play"
            aria-label=${this.isPlaying ? 'duraklat' : 'oynat'}
            @click=${this.onPlayClick}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="7,4 20,12 7,20"></polygon>
            </svg>
          </button>
          <button
            type="button"
            class="tr-btn"
            aria-label="sonraki"
            @click=${() => this.onTimelineClick('next')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5,4 15,12 5,20"></polygon>
              <rect x="17" y="4" width="2" height="16"></rect>
            </svg>
          </button>
          <div class="tr-time" aria-live="polite">
            <span
              class="tr-status-dot ${this.isPlaying ? '' : 'is-stopped'}"
              aria-hidden="true"
            ></span>
            <span>${statusText} · ${timeText}</span>
          </div>
        </div>

        <div class="zoom-panel" role="toolbar" aria-label="zoom">
          <button
            type="button"
            class="zoom-btn"
            aria-label="uzaklaştır"
            @click=${() => this.onZoomClick('out')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <span class="zoom-val">${this.zoom}%</span>
          <button
            type="button"
            class="zoom-btn"
            aria-label="yakınlaştır"
            @click=${() => this.onZoomClick('in')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <line x1="12" y1="5" x2="12" y2="19"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-canvas-chrome': VxaCanvasChrome;
  }
}
