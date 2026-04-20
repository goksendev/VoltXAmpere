// VoltXAmpere v2 — bileşen terminal pozisyonları (Sprint 1.2).
//
// Her bileşen tipi için rotation=0 varsayımında terminal offset'leri (bileşen
// merkezine göre CSS piksel). Değerler Sprint 0.5 sembol çizim dosyalarından
// (resistor.ts, capacitor.ts, voltage-source.ts) türedi:
//
//   V (voltage-source): RADIUS=17 + LEAD=18 → ±35 yatay; pin2 (+35) pos (+),
//     pin1 (-35) neg (-). ComponentDef.nodes[0]='in/+' → pos terminal.
//   R (resistor):       WIDTH=80 → pinler ±40 yatay. t1 sol (-40) = nodes[0],
//     t2 sağ (+40) = nodes[1].
//   C (capacitor):      LEAD=20 + GAP=8 → ±24 yatay. t1 sol = nodes[0].
//
// Rotation (0/90/180/270) uygulanınca offset döndürülür. Canvas rotation CW
// convention: (x,y) → 90° = (-y, x), 180° = (-x, -y), 270° = (y, -x).

export interface Point {
  x: number;
  y: number;
}

/** Sprint 1.4 — bir bileşenin bir terminal'ini işaret eden referans. */
export interface TerminalRef {
  componentId: string;
  terminal: string;
}

interface TerminalMap {
  [terminal: string]: Point;
}

export const COMPONENT_TERMINALS: Readonly<Record<string, TerminalMap>> = {
  V: {
    pos: { x: 35, y: 0 }, // nodes[0] — pil sağ (+) terminali
    neg: { x: -35, y: 0 }, // nodes[1] — pil sol (-) terminali
  },
  R: {
    t1: { x: -40, y: 0 }, // nodes[0] — sol uç
    t2: { x: 40, y: 0 }, // nodes[1] — sağ uç
  },
  C: {
    t1: { x: -24, y: 0 }, // nodes[0] — sol plaka
    t2: { x: 24, y: 0 }, // nodes[1] — sağ plaka
  },
};

/** Sprint 1.4 — her bileşen tipinde terminal adlarının nodes[] sırasına
 * karşılığı. TerminalRef.terminal → nodes[index] çevirmek için. */
export const TERMINAL_ORDER: Readonly<Record<string, readonly string[]>> = {
  V: ['pos', 'neg'], // nodes[0] = pos, nodes[1] = neg
  R: ['t1', 't2'],
  C: ['t1', 't2'],
};

export type Rotation = 0 | 90 | 180 | 270;

/** 2D noktayı canvas CW rotation konvansiyonuna göre döndür. */
export function rotatePointCW(p: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return { x: p.x, y: p.y };
    case 90:
      return { x: -p.y, y: p.x };
    case 180:
      return { x: -p.x, y: -p.y };
    case 270:
      return { x: p.y, y: -p.x };
  }
}

/** Bileşenin layout-merkez-relative pozisyonunda bir terminalin noktası.
 *  World'e çevirmek için caller centerX/centerY ekler. */
export function resolveTerminalLocal(
  placement: { x: number; y: number; rotation: Rotation },
  componentType: string,
  terminal: string,
): Point {
  const terminals = COMPONENT_TERMINALS[componentType];
  if (!terminals) {
    throw new Error(
      `[terminals] bilinmeyen bileşen tipi: ${componentType}`,
    );
  }
  const raw = terminals[terminal];
  if (!raw) {
    throw new Error(
      `[terminals] ${componentType} için tanımsız terminal: ${terminal}`,
    );
  }
  const rotated = rotatePointCW(raw, placement.rotation);
  return {
    x: placement.x + rotated.x,
    y: placement.y + rotated.y,
  };
}
