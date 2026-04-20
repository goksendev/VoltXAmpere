// VoltXAmpere v2 — <vxa-inspector> (Sprint 0.6).
//
// Seçili bileşenin bilgilerini üç section halinde gösterir:
//   ELEKTRİKSEL · KONUM · CANLI
//
// Sprint 0.6'da tüm alanlar READONLY. Input değişimi Sprint 0.7+.
// Pure render: prop'tan gelen (selection, circuit, layout, solveResult) ile
// tam içerik hesaplanır; internal state yok.
import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  CircuitDef,
  ComponentDef,
  ComponentType,
  SolveResult,
} from '../bridge/engine.ts';
import type { CircuitLayout } from '../render/circuit-renderer.ts';
import type { Selection } from '../state/selection.ts';
import {
  COMPONENT_DEFAULTS,
  type ComponentDefaults,
} from '../state/component-defaults.ts';
import {
  formatCapacitance,
  formatCurrent,
  formatEnergy,
  formatInductance,
  formatPower,
  formatResistance,
  formatVoltage,
} from '../util/format.ts';

interface Field {
  label: string;
  value: string;
}

// ─── Tip → Türkçe ad ─────────────────────────────────────────────────────────
const KIND_LABEL: Readonly<Record<ComponentType, string>> = {
  V: 'voltaj kaynağı',
  I: 'akım kaynağı',
  R: 'direnç',
  C: 'kapasitör',
  L: 'endüktör',
  D: 'diyot',
  Z: 'zener diyot',
  BJT: 'BJT transistör',
  MOS: 'MOSFET',
  OA: 'op-amp',
};

// ─── Tip → Değer formatlayıcı (bileşen value alanı) ──────────────────────────
function formatComponentValue(comp: ComponentDef): string {
  switch (comp.type) {
    case 'R': return formatResistance(comp.value);
    case 'C': return formatCapacitance(comp.value);
    case 'L': return formatInductance(comp.value);
    case 'V': return formatVoltage(comp.value);
    case 'I': return formatCurrent(comp.value);
    default:  return String(comp.value);
  }
}

// ─── Section üreticileri ─────────────────────────────────────────────────────
function electricalFields(
  comp: ComponentDef,
  defaults: ComponentDefaults,
): Field[] {
  const fields: Field[] = [{ label: 'Değer', value: formatComponentValue(comp) }];
  if (comp.type === 'R' && defaults.powerRating !== undefined) {
    fields.push({ label: 'Güç', value: formatPower(defaults.powerRating) });
  }
  if (comp.type === 'C' && defaults.voltageRating !== undefined) {
    fields.push({ label: 'V sınıfı', value: formatVoltage(defaults.voltageRating) });
  }
  if ((comp.type === 'L' || comp.type === 'D' || comp.type === 'Z') && defaults.currentRating !== undefined) {
    fields.push({ label: 'I sınıfı', value: formatCurrent(defaults.currentRating) });
  }
  if (comp.type === 'V') {
    fields.push({ label: 'Mod', value: 'DC' });
  }
  return fields;
}

function positionFields(
  comp: ComponentDef,
  layout: CircuitLayout | undefined,
): Field[] {
  const placement = layout?.components.find((p) => p.id === comp.id);
  if (!placement) return [];
  return [
    { label: 'X, Y', value: `${placement.x}, ${placement.y}` },
    { label: 'Açı', value: `${placement.rotation}°` },
  ];
}

function liveFields(
  comp: ComponentDef,
  nodeVoltages: Record<string, number>,
  branchCurrents: Record<string, number>,
): Field[] {
  switch (comp.type) {
    case 'R': {
      const v1 = nodeVoltages[comp.nodes[0]] ?? 0;
      const v2 = nodeVoltages[comp.nodes[1]] ?? 0;
      const vDrop = v1 - v2;
      const i = vDrop / comp.value;
      const p = vDrop * i;
      return [
        { label: 'V düş.', value: formatVoltage(vDrop) },
        { label: 'I', value: formatCurrent(i) },
        { label: 'P', value: formatPower(p) },
      ];
    }
    case 'V': {
      const i = branchCurrents[comp.id] ?? 0;
      return [
        { label: 'V', value: formatVoltage(comp.value) },
        { label: 'I', value: formatCurrent(i) },
      ];
    }
    case 'C': {
      const v1 = nodeVoltages[comp.nodes[0]] ?? 0;
      const v2 = nodeVoltages[comp.nodes[1]] ?? 0;
      const v = v1 - v2;
      const i = branchCurrents[comp.id] ?? 0;
      const energy = 0.5 * comp.value * v * v;
      return [
        { label: 'V', value: formatVoltage(v) },
        { label: 'I', value: formatCurrent(i) },
        { label: 'E', value: formatEnergy(energy) },
      ];
    }
    default:
      return [];
  }
}

// ─── Büyük isim: "R" + subscript "1" ─────────────────────────────────────────
function renderBigName(id: string): TemplateResult {
  // İlk harf ana sembol, geri kalanı subscript. "R1" → R + ₁.
  const main = id.charAt(0);
  const sub = id.slice(1);
  return html`${main}${sub ? html`<span class="name-sub">${sub}</span>` : nothing}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
@customElement('vxa-inspector')
export class VxaInspector extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      background: var(--bg-1);
      color: var(--fg);
      overflow-y: auto;
      padding: var(--sp-4);
      box-sizing: border-box;
    }

    /* Boş / yok durumları */
    .empty {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.12em;
      text-transform: lowercase;
      padding: var(--sp-4);
    }

    /* ─── Üst başlık bloğu ────────────────────────────────────────── */
    .kicker {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: var(--sp-3);
    }

    .name {
      font-family: var(--sans);
      font-size: var(--fs-2xl);
      font-weight: 400;
      color: var(--fg);
      line-height: 1;
      letter-spacing: -0.01em;
    }

    /* "R₁" subscript — CSS sub ile. */
    .name-sub {
      font-size: 55%;
      vertical-align: sub;
      margin-left: 1px;
      color: var(--fg-2);
    }

    .kind {
      font-family: var(--sans);
      font-size: var(--fs-sm);
      color: var(--fg-2);
      font-style: italic;
      margin-top: 2px;
    }

    /* ─── Section ─────────────────────────────────────────────────── */
    .section {
      padding-top: var(--sp-3);
      margin-top: var(--sp-3);
      border-top: 1px solid var(--line);
    }
    /* İlk section kicker bloğundan ayrı görünsün — ek boşluk. */
    .section.first {
      margin-top: var(--sp-4);
    }

    .section-title {
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: var(--sp-3);
    }

    .field {
      display: grid;
      grid-template-columns: 68px 1fr;
      align-items: baseline;
      gap: var(--sp-2);
      padding: 4px 0;
    }

    .field-label {
      font-family: var(--sans);
      font-size: var(--fs-sm);
      color: var(--fg-2);
    }

    .field-value {
      font-family: var(--mono);
      font-size: var(--fs-sm);
      color: var(--fg);
      font-variant-numeric: tabular-nums;
      text-align: right;
      word-break: break-word;
    }

    /* Hata durumu */
    .err-box {
      margin-top: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--err);
      border-radius: var(--r-2);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--err);
    }

    /* Sprint 1.5 — tel seçimi için ipucu kutusu. --fg-3 donuk metin,
       kenarlık yok, sadece hint görünümü. */
    .hint-box {
      padding: var(--sp-2) 0;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--fg-3);
      line-height: 1.5;
    }
  `;

  @property({ attribute: false }) selection?: Selection;
  @property({ attribute: false }) circuit?: CircuitDef;
  @property({ attribute: false }) layout?: CircuitLayout;
  @property({ attribute: false }) solveResult?: SolveResult | null;

  override render() {
    if (!this.selection || this.selection.type === 'none') {
      return html`<div class="empty">bir bileşen veya tel seç</div>`;
    }
    if (this.selection.type === 'wire') {
      return this.renderWire(this.selection.index);
    }
    if (this.selection.type === 'multi') {
      return this.renderMulti(this.selection.componentIds);
    }
    return this.renderComponent(this.selection.id);
  }

  /** Sprint 2.2: çoklu seçim paneli. Kaç bileşen + tip dökümü + Delete ipucu.
   *  Canlı değerler yok — farklı bileşenlerin değerleri karışır. */
  private renderMulti(ids: readonly string[]): TemplateResult {
    const typeCounts = new Map<string, number>();
    for (const id of ids) {
      const comp = this.circuit?.components.find((c) => c.id === id);
      if (!comp) continue;
      typeCounts.set(comp.type, (typeCounts.get(comp.type) ?? 0) + 1);
    }
    const typeLabel = (t: string): string => {
      const map: Record<string, string> = {
        V: 'voltaj kaynağı',
        I: 'akım kaynağı',
        R: 'direnç',
        C: 'kapasitör',
        L: 'endüktör',
        D: 'diyot',
        Z: 'zener',
        BJT: 'BJT',
        MOS: 'MOSFET',
        OA: 'op-amp',
      };
      return map[t] ?? t;
    };

    return html`
      <div class="kicker">seçim · çoklu</div>
      <div class="name">${ids.length}<span class="name-sub"> bileşen</span></div>
      <div class="kind">çoklu seçim</div>

      <section class="section first">
        <div class="section-title">içerik</div>
        ${Array.from(typeCounts.entries()).map(
          ([type, n]) => html`
            <div class="field">
              <span class="field-label">${typeLabel(type)}</span>
              <span class="field-value">${n}</span>
            </div>
          `,
        )}
      </section>

      <section class="section">
        <div class="section-title">ipucu</div>
        <div class="hint-box">Delete tuşuyla hepsini birden silebilirsin.</div>
      </section>
    `;
  }

  /** Sprint 1.5: seçili telin uçlarını göster + Delete ipucu. */
  private renderWire(index: number): TemplateResult {
    const wire = this.layout?.wires[index];
    if (!wire) {
      return html`<div class="empty">tel bulunamadı (#${index})</div>`;
    }
    const fromLabel = wire.from.kind === 'terminal'
      ? `${wire.from.componentId}.${wire.from.terminal}`
      : `(${wire.from.x}, ${wire.from.y})`;
    const toLabel = wire.to.kind === 'terminal'
      ? `${wire.to.componentId}.${wire.to.terminal}`
      : `(${wire.to.x}, ${wire.to.y})`;

    return html`
      <div class="kicker">tel · #${index}</div>
      <div class="name">—</div>
      <div class="kind">bağlantı</div>

      <section class="section first">
        <div class="section-title">uçlar</div>
        <div class="field">
          <span class="field-label">Kaynak</span>
          <span class="field-value">${fromLabel}</span>
        </div>
        <div class="field">
          <span class="field-label">Hedef</span>
          <span class="field-value">${toLabel}</span>
        </div>
      </section>

      <section class="section">
        <div class="section-title">ipucu</div>
        <div class="hint-box">Delete tuşuyla telyi silebilirsin.</div>
      </section>
    `;
  }

  /** Seçili bileşen için detay paneli (Sprint 0.6). */
  private renderComponent(id: string): TemplateResult {
    const comp = this.circuit?.components.find((c) => c.id === id);
    if (!comp) {
      return html`<div class="empty">bileşen bulunamadı: ${id}</div>`;
    }

    const defaults = COMPONENT_DEFAULTS[comp.type];
    const elec = electricalFields(comp, defaults);
    const pos = positionFields(comp, this.layout);
    const solveOk = this.solveResult?.success === true;

    return html`
      <div class="kicker">bileşen · ${comp.id}</div>
      <div class="name">${renderBigName(comp.id)}</div>
      <div class="kind">${KIND_LABEL[comp.type]}</div>

      <section class="section first">
        <div class="section-title">elektriksel</div>
        ${elec.map(
          (f) => html`
            <div class="field">
              <span class="field-label">${f.label}</span>
              <span class="field-value">${f.value}</span>
            </div>
          `,
        )}
      </section>

      ${pos.length > 0
        ? html`
            <section class="section">
              <div class="section-title">konum</div>
              ${pos.map(
                (f) => html`
                  <div class="field">
                    <span class="field-label">${f.label}</span>
                    <span class="field-value">${f.value}</span>
                  </div>
                `,
              )}
            </section>
          `
        : nothing}

      <section class="section">
        <div class="section-title">canlı</div>
        ${solveOk
          ? liveFields(
              comp,
              this.solveResult!.nodeVoltages,
              this.solveResult!.branchCurrents,
            ).map(
              (f) => html`
                <div class="field">
                  <span class="field-label">${f.label}</span>
                  <span class="field-value">${f.value}</span>
                </div>
              `,
            )
          : html`<div class="err-box">solver hatası — değerler alınamadı</div>`}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vxa-inspector': VxaInspector;
  }
}
