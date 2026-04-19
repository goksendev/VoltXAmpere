// VoltXAmpere v2 — <vxa-sidebar> (Sprint 0.11).
//
// 6 temel bileşen ikonu — Faz 1 kapanışı. Her ikon kare buton, üstte SVG,
// altta Türkçe etiket. Tıklama [TODO] log bırakır ve tool-select event
// emit eder (design-mode Sprint 0.x'te dinlemiyor; Faz 2'de dinleyecek).
//
// `activeTool` prop'u set edildiğinde o buton .active sınıfını alır —
// amber kenar + amber-dim zemin. Şu an design-mode null gönderiyor
// (hiç aktif araç yok); manuel set ile Sprint 0.11 raporu için test edilir.
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BASIC_TOOLS, type ToolDef } from './catalog.ts';

@customElement('vxa-sidebar')
export class VxaSidebar extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      padding: var(--sp-3) var(--sp-2);
      overflow-y: auto;
      box-sizing: border-box;
    }

    .chip-btn {
      width: 100%;
      aspect-ratio: 1;
      background: var(--bg-2);
      border: 1px solid var(--line);
      border-radius: var(--r-4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      color: var(--fg-2);
      margin-bottom: var(--sp-2);
      padding: 0;
      font: inherit;
      transition: border-color 120ms, color 120ms, background 120ms;
    }
    .chip-btn:last-child {
      margin-bottom: 0;
    }
    .chip-btn:hover {
      border-color: var(--accent);
      color: var(--fg);
    }
    /* Aktif durum — Sprint 0.11'de manuel test için, Faz 2'de canvas click
       veya araç seçimiyle bağlanacak. rgba(255,184,77,0.14) = --accent-dim
       adayı (Sprint 1.x --accent-dim token). */
    .chip-btn.active {
      border-color: var(--accent);
      background: rgba(255, 184, 77, 0.14);
      color: var(--fg);
    }
    .chip-btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* Her SVG elementine stroke:currentColor + fill:none uygulanır.
       stroke-width CSS'te VERİLMEZ — SVG inline stroke-width attribute'u
       böylece çalışır (CSS stroke-width SVG presentation attribute'unu
       ezer; kapasitör 1.6 ve toprak 1.4 custom genişlikleri için kritik). */
    .chip-btn svg {
      width: 28px;
      height: 28px;
      display: block;
    }
    .chip-btn svg * {
      stroke: currentColor;
      fill: none;
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .chip-label {
      font-size: var(--fs-xs);
      font-family: var(--sans);
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 1;
      color: inherit;
    }
  `;

  /** Aktif araç id'si. null → hiçbir buton aktif değil. Faz 2'de canvas ve
   * toolbar etkileşimiyle güncellenecek. */
  @property() activeTool: string | null = null;

  private onClick(id: string): void {
    // Sprint 0.11: tıklama yalnızca log + event emit. Faz 2'de canvas bileşen
    // yerleştirme akışı bu event'i dinleyecek.
    console.log(`[TODO] ${id} aracı seçildi · Sprint 1.x+ (araç sistemi)`);
    this.dispatchEvent(
      new CustomEvent('tool-select', {
        detail: { id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderTool(tool: ToolDef) {
    const isActive = this.activeTool === tool.id;
    return html`
      <button
        type="button"
        class="chip-btn ${isActive ? 'active' : ''}"
        data-tool=${tool.id}
        aria-pressed=${isActive ? 'true' : 'false'}
        @click=${() => this.onClick(tool.id)}
      >
        ${unsafeHTML(tool.iconSvg)}
        <span class="chip-label">${tool.label}</span>
      </button>
    `;
  }

  override render() {
    return html`${BASIC_TOOLS.map((t) => this.renderTool(t))}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-sidebar': VxaSidebar;
  }
}
