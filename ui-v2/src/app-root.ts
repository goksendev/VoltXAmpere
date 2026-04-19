// VoltXAmpere v2 — <vxa-app-root> Sprint 0.1 kanıt bileşeni.
// Amaç: "iskelet ayakta" mesajını koyu zemin + Geist/JetBrains Mono ile göstermek.
// Canvas, registry, backend bağı YOK — sonraki sprintlere ait.
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('vxa-app-root')
export class VxaAppRoot extends LitElement {
  // Build/anlık render zamanı — sayfanın "taze" olduğunu gözle doğrulamak için.
  // Module scope'ta tutuyoruz ki her yeniden mount'ta değişmesin; anlık render
  // zamanı isteyen sprint'ler kendi state'iyle ekleyecek.
  private readonly renderedAt = new Date().toISOString();

  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--bg-0);
      color: var(--fg);
      font-family: var(--sans);
    }

    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 12vh 24px 64px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    h1 {
      font-family: var(--sans);
      font-weight: 700;
      font-size: clamp(32px, 5vw, 48px);
      line-height: 1.1;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .accent {
      color: var(--accent);
    }

    .subtitle {
      font-family: var(--sans);
      font-weight: 500;
      font-size: 18px;
      color: var(--fg-2);
      margin: 0;
    }

    .meta {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--fg-2);
      margin: 0;
    }

    pre.codeblock {
      font-family: var(--mono);
      font-size: 13px;
      background: var(--bg-1);
      color: var(--current);
      padding: 16px 20px;
      border-radius: 8px;
      margin: 0;
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 8px 0;
    }
  `;

  override render() {
    return html`
      <div class="wrap">
        <h1>
          VoltXAmpere <span class="accent">v2</span>
        </h1>
        <p class="subtitle">Sprint 0.1 · iskelet çalışıyor</p>

        <div class="divider"></div>

        <p class="meta">build zamanı: ${this.renderedAt}</p>

        <pre
          class="codeblock"
        ><code>Lit 3 + Vite + TypeScript · paralel klasör</code></pre>
      </div>
    `;
  }
}

// TypeScript'e custom element ismini bildir (HTML template auto-completion için).
declare global {
  interface HTMLElementTagNameMap {
    'vxa-app-root': VxaAppRoot;
  }
}
