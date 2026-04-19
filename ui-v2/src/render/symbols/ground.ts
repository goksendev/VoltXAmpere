// VoltXAmpere v2 — toprak sembolü (Sprint 0.5).
//
// Standart tek-uçlu toprak: tel üstten gelir, altında 3 yatay çizgi
// (merdiven şeklinde, üstten alta doğru daralır). Renk --ground (gri).
// Local koordinat: (0, 0) = pin (üstten gelen telin ucu).
//
// Plan değerleri:
//  - Dikey tel: 20 px aşağı
//  - Çizgi 1 (en geniş): 20 px, y = 20
//  - Çizgi 2:            14 px, y = 26
//  - Çizgi 3 (en dar):    6 px, y = 32
//  - Aralıklar: 6 px
import type { RenderColors } from '../helpers.ts';

const LEAD_LEN = 20;       // Pin'den ilk çizgiye kadar dikey tel uzunluğu
const RAIL_1_WIDTH = 20;   // En üst (geniş) çizgi
const RAIL_2_WIDTH = 14;
const RAIL_3_WIDTH = 6;
const RAIL_SPACING = 6;    // Çizgiler arası dikey boşluk
// Çizgi stroke: teldekiyle aynı olmalı — "toprak telin devamı" hissi. 1.5 px.
const RAIL_STROKE = 1.5;

export function drawGround(
  ctx: CanvasRenderingContext2D,
  colors: RenderColors,
): void {
  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = RAIL_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Dikey tel: pin'den aşağı
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, LEAD_LEN);
  ctx.stroke();

  // Üç yatay çizgi
  const rails: Array<[number, number]> = [
    [RAIL_1_WIDTH, LEAD_LEN],
    [RAIL_2_WIDTH, LEAD_LEN + RAIL_SPACING],
    [RAIL_3_WIDTH, LEAD_LEN + RAIL_SPACING * 2],
  ];
  for (const [w, y] of rails) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.lineTo(w / 2, y);
    ctx.stroke();
  }
}
