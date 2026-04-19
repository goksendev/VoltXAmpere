// VoltXAmpere v2 — <vxa-topbar> (Sprint 0.8).
//
// Topbar görsel iskelet: logo (Volt&Ampere serif) + mod switch (Keşfet /
// Tasarla / Güç segmented control) + ana aksiyonlar (Kaydet, Aç, SPICE, BOM,
// Dışa aktar) + sağda yardımcılar (Galeri, Dersler).
//
// Bu sprintte HİÇBİR BUTON FONKSİYONEL DEĞİL. Tıklama sadece
//   - Ana butonlar → `console.log('[TODO] {id} butonu — Sprint 1.x+')`
//   - Mod butonları → kesfet/guc için console.warn, tasarla için event emit
// Gerçek aksiyonlar Sprint 1.x+ sürecinde gelecek. Event interface şimdi
// kurulsun ki Sprint 0.10+'da design-mode listener bağlayabilsin.
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type ModeName = 'kesfet' | 'tasarla' | 'guc';

interface ActionDef {
  id: string;
  label: string;
}

// Ana aksiyonlar iki gruba ayrılır — arada separator. Plan'a birebir uyum.
const PRIMARY_ACTIONS_LEFT: ActionDef[] = [
  { id: 'save', label: 'Kaydet' },
  { id: 'open', label: 'Aç' },
];
const PRIMARY_ACTIONS_RIGHT: ActionDef[] = [
  { id: 'spice', label: 'SPICE' },
  { id: 'bom', label: 'BOM' },
  { id: 'export', label: 'Dışa aktar' },
];
const HELPER_ACTIONS: ActionDef[] = [
  { id: 'gallery', label: 'Galeri' },
  { id: 'lessons', label: 'Dersler' },
];

const MODE_LABELS: Readonly<Record<ModeName, string>> = {
  kesfet: 'Keşfet',
  tasarla: 'Tasarla',
  guc: 'Güç',
};

@customElement('vxa-topbar')
export class VxaTopbar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      height: 100%;
      width: 100%;
      padding: 0 var(--sp-3);
      background: var(--bg-1);
      color: var(--fg);
      gap: var(--sp-2);
      box-sizing: border-box;
      overflow: hidden;
    }

    /* ─── Logo ─────────────────────────────────────────────────────────────
       "Volt<em>&</em>Ampere". Serif ampersand amber italic, diğer harfler
       sans serif degildir — hepsi serif. Yalnızca & amber. */
    .logo {
      font-family: var(--serif);
      font-size: var(--fs-md);
      font-weight: 400;
      letter-spacing: -0.005em;
      color: var(--fg);
      user-select: none;
      padding: 0 var(--sp-2) 0 var(--sp-2);
      /* Font-display delay — @font-face yüklenene kadar fallback (Times).
         Boyut orantılı, layout shift minimum. */
    }
    .logo em {
      font-style: italic;
      color: var(--accent);
      font-weight: 400;
      margin: 0 1px;
    }

    /* İnce dikey separator (logo/mod/action grupları arası). */
    .sep {
      flex: 0 0 auto;
      width: 1px;
      height: 16px;
      background: var(--line-str);
      margin: 0 var(--sp-2);
    }

    /* ─── Mod switch ──────────────────────────────────────────────────────
       Segmented control. Aktif tab amber zemin, diğerleri soluk. Sprint 0.8
       sadece Tasarla aktif; Keşfet/Güç tıklanırsa console.warn. */
    .mode-switch {
      display: inline-flex;
      background: var(--bg-2);
      border: 1px solid var(--line-str);
      border-radius: var(--r-3);
      padding: 2px;
      gap: 1px;
    }
    .mode-switch button {
      padding: 3px 10px;
      background: transparent;
      border: 0;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      letter-spacing: 0.1em;
      color: var(--fg-3);
      cursor: pointer;
      border-radius: var(--r-2);
      text-transform: uppercase;
      transition: color 120ms, background 120ms;
    }
    .mode-switch button:hover:not([aria-current='true']) {
      color: var(--fg-2);
    }
    .mode-switch button[aria-current='true'] {
      background: var(--accent);
      /* Amber üstünde koyu metin — token'a çevirme adayı (Sprint 1.x --on-accent). */
      color: #0A0A0B;
      font-weight: 600;
    }
    /* Tasarla dışındaki modlar henüz hazır değil — cursor not-allowed ile ipucu. */
    .mode-switch button.is-disabled {
      cursor: not-allowed;
    }

    /* ─── Ana aksiyon butonları ───────────────────────────────────────── */
    .actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .action-btn {
      padding: 4px 9px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--r-2);
      font-family: var(--sans);
      font-size: var(--fs-sm);
      color: var(--fg-2);
      cursor: pointer;
      transition: background 120ms, color 120ms, border-color 120ms;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .action-btn:hover {
      background: var(--bg-3);
      color: var(--fg);
    }
    .action-btn:active {
      background: var(--bg-4);
    }
    .action-btn svg {
      width: 11px;
      height: 11px;
    }

    /* Esnek dolgu — ana aksiyonları sola, yardımcıları sağa itmek için. */
    .spacer {
      flex: 1 1 auto;
    }

    .helpers {
      display: flex;
      align-items: center;
      gap: 2px;
    }
  `;

  @property() activeMode: ModeName = 'tasarla';

  private onAction(id: string): void {
    // Sprint 0.8: her ana buton yalnızca placeholder log. Gerçek handler
    // Sprint 1.x+'da bağlanacak. bubbles+composed ki design-mode dinleyebilsin.
    console.log(`[TODO] ${id} butonu — Sprint 1.x+`);
    this.dispatchEvent(
      new CustomEvent('action', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private onModeClick(mode: ModeName): void {
    if (mode === this.activeMode) return;
    if (mode !== 'tasarla') {
      console.warn(`Mod değiştirme Faz 3+'da gelecek — istek: ${mode}`);
      return;
    }
    this.dispatchEvent(
      new CustomEvent('mode-change', {
        detail: { mode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderMode(mode: ModeName) {
    const isActive = mode === this.activeMode;
    const isDisabled = mode !== 'tasarla';
    return html`
      <button
        type="button"
        data-mode=${mode}
        class=${isDisabled && !isActive ? 'is-disabled' : ''}
        aria-current=${isActive ? 'true' : 'false'}
        @click=${() => this.onModeClick(mode)}
      >
        ${MODE_LABELS[mode]}
      </button>
    `;
  }

  private renderAction(a: ActionDef) {
    return html`
      <button
        type="button"
        class="action-btn"
        data-action=${a.id}
        @click=${() => this.onAction(a.id)}
      >
        ${a.label}
      </button>
    `;
  }

  private renderHelperAction(a: ActionDef) {
    // Galeri butonu 4 hücreli grid ikonuyla. Diğerleri düz metin.
    if (a.id === 'gallery') {
      return html`
        <button
          type="button"
          class="action-btn"
          data-action=${a.id}
          @click=${() => this.onAction(a.id)}
        >
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none" aria-hidden="true">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"></path>
          </svg>
          <span>${a.label}</span>
        </button>
      `;
    }
    return this.renderAction(a);
  }

  override render() {
    return html`
      <span class="logo" aria-label="VoltXAmpere">Volt<em>&amp;</em>Ampere</span>

      <span class="sep" aria-hidden="true"></span>

      <nav class="mode-switch" aria-label="mod seçimi">
        ${this.renderMode('kesfet')}
        ${this.renderMode('tasarla')}
        ${this.renderMode('guc')}
      </nav>

      <span class="sep" aria-hidden="true"></span>

      <div class="actions" aria-label="ana aksiyonlar">
        ${PRIMARY_ACTIONS_LEFT.map((a) => this.renderAction(a))}
        <span class="sep" aria-hidden="true"></span>
        ${PRIMARY_ACTIONS_RIGHT.map((a) => this.renderAction(a))}
      </div>

      <span class="spacer"></span>

      <div class="helpers" aria-label="yardımcı aksiyonlar">
        ${HELPER_ACTIONS.map((a) => this.renderHelperAction(a))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-topbar': VxaTopbar;
  }
}
