// VoltXAmpere v2 — sidebar temel bileşen kataloğu (Sprint 0.11).
//
// 6 temel araç; Faz 1 görsel katalog. Gerçek "bu aracı seç ve yerleştir"
// akışı Faz 2'de. Her ikon inline SVG string — dosyaya çekmek yerine burada
// tutuldu (her biri 100-200 karakter, yönetilebilir).
//
// SVG konvansiyonu:
//   viewBox 0 0 40 40 — sidebar 96px kareye uyumlu
//   root `stroke-width="1.3"` inherit edilen default; inner override edebilir
//   stroke/fill CSS'ten: `.chip-btn svg *` içinde stroke:currentColor, fill:none
//   stroke-linejoin/cap round CSS'te, inline tekrar gerek yok

export interface ToolDef {
  id: string;
  label: string;
  iconSvg: string;
}

export const BASIC_TOOLS: readonly ToolDef[] = [
  {
    id: 'resistor',
    label: 'Direnç',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <path d="M4 20 L10 20 L12 14 L16 26 L20 14 L24 26 L28 14 L30 20 L36 20"/>
      </svg>
    `,
  },
  {
    id: 'capacitor',
    label: 'Kap.',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <line x1="4" y1="20" x2="17" y2="20"/>
        <line x1="17" y1="10" x2="17" y2="30" stroke-width="1.6"/>
        <line x1="23" y1="10" x2="23" y2="30" stroke-width="1.6"/>
        <line x1="23" y1="20" x2="36" y2="20"/>
      </svg>
    `,
  },
  {
    id: 'battery',
    label: 'Pil',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <circle cx="20" cy="20" r="10"/>
        <line x1="16" y1="20" x2="24" y2="20"/>
        <line x1="20" y1="16" x2="20" y2="24"/>
      </svg>
    `,
  },
  {
    id: 'led',
    label: 'LED',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <circle cx="20" cy="20" r="9"/>
        <line x1="20" y1="6"  x2="20" y2="11"/>
        <line x1="20" y1="29" x2="20" y2="34"/>
        <line x1="13" y1="13" x2="16" y2="16"/>
        <line x1="24" y1="24" x2="27" y2="27"/>
        <line x1="13" y1="27" x2="16" y2="24"/>
        <line x1="24" y1="16" x2="27" y2="13"/>
      </svg>
    `,
  },
  {
    id: 'switch',
    label: 'Anah.',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <line x1="6"  y1="20" x2="14" y2="20"/>
        <line x1="14" y1="20" x2="24" y2="12"/>
        <line x1="26" y1="20" x2="34" y2="20"/>
      </svg>
    `,
  },
  {
    id: 'ground',
    label: 'Toprak',
    iconSvg: `
      <svg viewBox="0 0 40 40" stroke-width="1.3">
        <line x1="20" y1="8"  x2="20" y2="20"/>
        <line x1="10" y1="20" x2="30" y2="20" stroke-width="1.4"/>
        <line x1="14" y1="26" x2="26" y2="26" stroke-width="1.4"/>
        <line x1="18" y1="32" x2="22" y2="32" stroke-width="1.4"/>
      </svg>
    `,
  },
];
