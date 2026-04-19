// VoltXAmpere v2 — direnç sembolü (Sprint 0.5).
//
// IEEE stili zigzag direnç. Local coord (rotation 0): pin1 sol (-40, 0),
// pin2 sağ (+40, 0). Toplam genişlik 80 px, 10 px kenar leadleri,
// ortada 60 px'te 6 diş (±10 px amplitud).
//
// Neden 80 px? Grid 16 px, 5×16 = 80 tam grid'e oturuyor.
// Neden 1.8 stroke? Bileşen gövdesi wire'dan belirgin şekilde kalın
// görünsün ama fazla "kiremit" hissi vermesin — 1.5 tel, 1.8 gövde.
// Neden ±10 amplitud? 60 px inner'a oranı ~1/3, göz için hoş denge.
import type { Point, RenderColors } from '../helpers.ts';
import { drawText } from '../helpers.ts';

const WIDTH = 80;
const LEAD = 10;
const TEETH = 6;
const AMP = 10;
const BODY_STROKE = 1.8;

// Label ofsetleri (rotation 0 referans). rotation 90 için label'ler ayrı
// hesaplanır, sembol ters dönmeden kalsın.
const LABEL_GAP = 14;   // bileşen gövdesinden etiket uzaklığı

export function drawResistor(
  ctx: CanvasRenderingContext2D,
  colors: RenderColors,
): void {
  ctx.strokeStyle = colors.wire;
  ctx.lineWidth = BODY_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const innerW = WIDTH - 2 * LEAD;
  const toothW = innerW / TEETH;
  const startX = -WIDTH / 2 + LEAD;

  ctx.beginPath();
  ctx.moveTo(-WIDTH / 2, 0);         // pin1
  ctx.lineTo(-WIDTH / 2 + LEAD, 0);  // düz lead
  for (let i = 0; i < TEETH; i++) {
    const x = startX + (i + 0.5) * toothW;
    const y = i % 2 === 0 ? -AMP : AMP;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WIDTH / 2 - LEAD, 0);   // düz lead
  ctx.lineTo(WIDTH / 2, 0);          // pin2
  ctx.stroke();
}

/** Direnç etiketleri (world coord). Rotation'a göre pozisyon:
 * - rotation 0 (yatay): üstte "R1", altta değer ("1 kΩ")
 * - rotation 90 (dikey): sağda "R1" + altında değer
 * Label çizimleri rotation UYGULAMADAN yapılır — kullanıcı her zaman düz okur.
 */
export function drawResistorLabels(
  ctx: CanvasRenderingContext2D,
  center: Point,
  rotation: number,
  id: string,
  value: string,
  colors: RenderColors,
): void {
  let idPos: Point;
  let valPos: Point;
  let align: CanvasTextAlign = 'center';
  let baseline: CanvasTextBaseline = 'middle';

  if (rotation === 0 || rotation === 180) {
    // yatay: üstte id, altta value
    idPos = { x: center.x, y: center.y - (AMP + LABEL_GAP) };
    valPos = { x: center.x, y: center.y + (AMP + LABEL_GAP + 6) };
    align = 'center';
    baseline = 'middle';
  } else {
    // dikey: sağda id, sağ altında value
    idPos = { x: center.x + (AMP + LABEL_GAP), y: center.y - 7 };
    valPos = { x: center.x + (AMP + LABEL_GAP), y: center.y + 8 };
    align = 'left';
    baseline = 'middle';
  }

  drawText(ctx, id, idPos.x, idPos.y, {
    family: 'mono',
    sizePx: 11, // --fs-sm
    color: colors.fg,
    align,
    baseline,
    weight: 500,
  });
  drawText(ctx, value, valPos.x, valPos.y, {
    family: 'mono',
    sizePx: 10, // --fs-xs
    color: colors.fg2,
    align,
    baseline,
    weight: 400,
  });
}

/** Rotation 0'da pin konumları (local). Renderer ihtiyaç duyarsa kullanır. */
export const RESISTOR_PINS_LOCAL: readonly [Point, Point] = [
  { x: -WIDTH / 2, y: 0 },
  { x: WIDTH / 2, y: 0 },
];
