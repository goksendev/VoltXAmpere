// VoltXAmpere v2 — kapasitör sembolü (Sprint 0.5).
//
// İki paralel plaka. Local coord (rotation 0): pin1 sol, pin2 sağ, plakalar
// dikey çizgi olarak aralıklı. Rotation 90 uygulandığında plakalar yatay,
// pin'ler üst-alt olur.
//
// Plakalar neden 2.6 stroke? Teller 1.5, gövde 1.8 standardında; kapasitör
// plakaları daha belirgin olmalı — elektrot hissi. 2.6 kendi "ağırlığı"
// olan bir yüzey izlenimi veriyor. 3+ olursa blok gibi durur.
// GAP 8 — plakalar yeterince ayrık, ama devre merkezine yayılmayacak kadar
// kompakt. Plaka uzunluğu 24 — bileşen tanınabilir kalsın diye.
import type { Point, RenderColors } from '../helpers.ts';
import { drawText } from '../helpers.ts';

const PLATE_LEN = 24;
const GAP = 8;
const LEAD = 20;
const PLATE_STROKE = 2.6;
const WIRE_STROKE = 1.5;
const LABEL_GAP = 16;

// Toplam sembol uzunluğu: LEAD + GAP/2 + 0 + GAP/2 + LEAD = 2·LEAD + GAP = 48.
// Pin1 (-24, 0), pin2 (+24, 0) rotation 0'da.

export function drawCapacitor(
  ctx: CanvasRenderingContext2D,
  colors: RenderColors,
  isSelected = false,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = isSelected ? colors.accent : colors.wire;

  // Teller (ince) — pin'lerden plakalara
  ctx.lineWidth = WIRE_STROKE;
  ctx.beginPath();
  ctx.moveTo(-LEAD - GAP / 2, 0);
  ctx.lineTo(-GAP / 2, 0);
  ctx.moveTo(GAP / 2, 0);
  ctx.lineTo(LEAD + GAP / 2, 0);
  ctx.stroke();

  // Plakalar (kalın) — dikey çizgiler
  ctx.lineWidth = PLATE_STROKE;
  ctx.beginPath();
  ctx.moveTo(-GAP / 2, -PLATE_LEN / 2);
  ctx.lineTo(-GAP / 2, PLATE_LEN / 2);
  ctx.moveTo(GAP / 2, -PLATE_LEN / 2);
  ctx.lineTo(GAP / 2, PLATE_LEN / 2);
  ctx.stroke();
}

export function drawCapacitorLabels(
  ctx: CanvasRenderingContext2D,
  center: Point,
  rotation: number,
  id: string,
  value: string,
  colors: RenderColors,
  isSelected = false,
): void {
  let idPos: Point;
  let valPos: Point;
  let align: CanvasTextAlign = 'left';
  let baseline: CanvasTextBaseline = 'middle';

  if (rotation === 0 || rotation === 180) {
    // yatay: üstte id + değer (id merkez, value altında)
    idPos = { x: center.x, y: center.y - (PLATE_LEN / 2 + LABEL_GAP) };
    valPos = { x: center.x, y: center.y + (PLATE_LEN / 2 + LABEL_GAP + 6) };
    align = 'center';
  } else {
    // dikey: sağda id, altında value
    idPos = { x: center.x + (PLATE_LEN / 2 + LABEL_GAP), y: center.y - 7 };
    valPos = { x: center.x + (PLATE_LEN / 2 + LABEL_GAP), y: center.y + 8 };
    align = 'left';
  }

  drawText(ctx, id, idPos.x, idPos.y, {
    family: 'mono',
    sizePx: 11,
    color: isSelected ? colors.accent : colors.fg,
    align,
    baseline,
    weight: 500,
  });
  drawText(ctx, value, valPos.x, valPos.y, {
    family: 'mono',
    sizePx: 10,
    color: isSelected ? colors.accent : colors.fg2,
    align,
    baseline,
    weight: 400,
  });
}

/** Rotation 0'da pin konumları (local). */
export const CAPACITOR_PINS_LOCAL: readonly [Point, Point] = [
  { x: -(LEAD + GAP / 2), y: 0 },
  { x: LEAD + GAP / 2, y: 0 },
];
