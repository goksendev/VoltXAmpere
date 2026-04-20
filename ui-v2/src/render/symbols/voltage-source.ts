// VoltXAmpere v2 — voltaj kaynağı (pil) sembolü (Sprint 0.5).
//
// Daire içinde "+" simgesi + terminal leadleri. Local coord (rotation 0):
// daire merkezde (0,0), pin1 sol (-35, 0), pin2 sağ (+35, 0). pin2 pozitif
// terminal (+) tarafı.
//
// Neden daire 34 px çap? Yeterince ayrımlı ama "büyük top" değil — devre
// şemasında kaynak ikinci derece aksesuardır, direnç ve kapasitör kadar
// büyük olmamalı. 34 px = 2·17 yarıçap, deriverenin çalışma sınırı.
// + simgesi 6 px — daire içinde görünür ama daireyi ezmez.
import type { Point, RenderColors } from '../helpers.ts';
import { drawText } from '../helpers.ts';

const RADIUS = 17;
const LEAD = 18;
const BODY_STROKE = 1.8;
const PLUS_SIZE = 6;         // + işaret yarı uzunluğu (toplam 12 px çizgi)
const PLUS_STROKE = 1.6;
const LABEL_GAP = 14;

// Total yatay uzantı (rotation 0): LEAD + RADIUS + 0 + RADIUS + LEAD = 70.
// Pin'ler (-35, 0), (+35, 0).

export function drawVoltageSource(
  ctx: CanvasRenderingContext2D,
  colors: RenderColors,
  isSelected = false,
  isHovered = false,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Sprint 1.1: hover stroke --fg; selected > hovered > default.
  const bodyColor = isSelected ? colors.accent : isHovered ? colors.fg : colors.wire;
  // Lead telleri — pin'den daire kenarına. 1.5 stroke (wire).
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-RADIUS - LEAD, 0);
  ctx.lineTo(-RADIUS, 0);
  ctx.moveTo(RADIUS, 0);
  ctx.lineTo(RADIUS + LEAD, 0);
  ctx.stroke();

  // Daire — iç dolgu canvas rengi (zemin hissi), dış kenar wire/accent.
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = colors.canvasBg;
  ctx.fill();
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = BODY_STROKE;
  ctx.stroke();

  // + işareti — pozitif terminal (pin2, rotation 0'da sağda). Merkez kaydırması
  // için sağa 6 px offset uygulayalım ki + işareti daire merkezinden belli
  // bir tarafta olsun — kullanıcı "+ nerede?" ipucu alır.
  const plusCx = 5;        // daire merkezinden 5 px sağa (rotation 0)
  ctx.strokeStyle = colors.vPos;
  ctx.lineWidth = PLUS_STROKE;
  ctx.beginPath();
  ctx.moveTo(plusCx - PLUS_SIZE / 2, 0);
  ctx.lineTo(plusCx + PLUS_SIZE / 2, 0);
  ctx.moveTo(plusCx, -PLUS_SIZE / 2);
  ctx.lineTo(plusCx, PLUS_SIZE / 2);
  ctx.stroke();
}

export function drawVoltageSourceLabels(
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
  let align: CanvasTextAlign = 'right';
  let baseline: CanvasTextBaseline = 'middle';

  if (rotation === 0 || rotation === 180) {
    // yatay: üstte id, altta value
    idPos = { x: center.x, y: center.y - (RADIUS + LABEL_GAP) };
    valPos = { x: center.x, y: center.y + (RADIUS + LABEL_GAP + 6) };
    align = 'center';
  } else {
    // dikey (rotation 90): solda id ve value (üstte id, altta value)
    idPos = { x: center.x - (RADIUS + LABEL_GAP), y: center.y - 7 };
    valPos = { x: center.x - (RADIUS + LABEL_GAP), y: center.y + 8 };
    align = 'right';
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

/** Rotation 0 pin konumları (local). Pin1 sol (-), pin2 sağ (+). */
export const VSRC_PINS_LOCAL: readonly [Point, Point] = [
  { x: -(RADIUS + LEAD), y: 0 },
  { x: RADIUS + LEAD, y: 0 },
];
