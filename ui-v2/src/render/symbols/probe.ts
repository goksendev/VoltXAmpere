// VoltXAmpere v2 — probe etiketi (Sprint 0.5).
//
// Bir düğümün canlı voltajını canvas üstünde gösteren yarı saydam kutu +
// ölçme noktasına giden ince kılçık çizgi. Renderer world coord'da çağırır
// (rotate/translate YOK) — etiket her zaman düz okunabilir.
//
// Tasarım:
//  - Kutu: --bg-1 %88 opak + --line-str 1px border + --r-2 radius
//  - İki satır: üstte etiket (probe rengi), altta değer (--fg)
//  - Kılçık: pin noktasından kutu kenarına, --line-str %70 opak
//  - Junction dot: pin konumunda probe renginde 5px dolu daire
import type { Point, RenderColors } from '../helpers.ts';
import { drawText, dot, roundRectPath } from '../helpers.ts';

export type ProbeTone = 'fg' | 'accent' | 'current';

export interface ProbeDrawSpec {
  pin: Point;        // devre üzerindeki ölçme noktası (world)
  box: Point;        // etiket kutusu merkezi (world)
  label: string;     // "V_GİRİŞ" / "V_ÇIKIŞ" / ...
  value: string;     // "5.00 V" — solver sonucundan format edilmiş
  tone: ProbeTone;
}

const BOX_W = 108;
const BOX_H = 40;
const BOX_PAD_X = 10;
const BOX_PAD_Y = 6;
const BOX_RADIUS = 4;
const BOX_BORDER = 1;
const PIN_DOT = 5;
const HAIRLINE_STROKE = 0.8;   // plan: zayıf çizgi

export function drawProbe(
  ctx: CanvasRenderingContext2D,
  spec: ProbeDrawSpec,
  colors: RenderColors,
): void {
  const toneColor =
    spec.tone === 'accent'  ? colors.accent
    : spec.tone === 'current' ? colors.current
    : colors.fg;

  // 1) Kutu sol-üst köşesi (center → bounds)
  const x = spec.box.x - BOX_W / 2;
  const y = spec.box.y - BOX_H / 2;

  // 2) Kılçık çizgi: pin → kutunun pin'e en yakın kenarı. Basit yaklaşım:
  //    kutu merkezine doğru çiz, kutu border'ında clip'lenir. Round endpoints.
  ctx.strokeStyle = colors.lineStr;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = HAIRLINE_STROKE;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(spec.pin.x, spec.pin.y);
  // Kutu'nun alt-orta noktasına gelelim (pin yukarıdaysa) — basit her durum için
  // box merkezine doğru, clip gerekirse border path'i gizler.
  ctx.lineTo(spec.box.x, spec.box.y + BOX_H / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 3) Pin'de junction dot — probe renginde
  dot(ctx, spec.pin.x, spec.pin.y, PIN_DOT, toneColor);

  // 4) Kutu arkası (opak, border, radius)
  roundRectPath(ctx, x, y, BOX_W, BOX_H, BOX_RADIUS);
  ctx.fillStyle = colors.bg1;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = BOX_BORDER;
  ctx.strokeStyle = colors.lineStr;
  ctx.stroke();

  // 5) Üst satır — label (probe rengi, mono --fs-xs)
  drawText(ctx, spec.label, x + BOX_PAD_X, y + BOX_PAD_Y + 8, {
    family: 'mono',
    sizePx: 10,
    color: toneColor,
    align: 'left',
    baseline: 'alphabetic',
    weight: 600,
  });

  // 6) Alt satır — değer (mono --fs-sm, --fg)
  drawText(ctx, spec.value, x + BOX_PAD_X, y + BOX_H - BOX_PAD_Y, {
    family: 'mono',
    sizePx: 13,
    color: colors.fg,
    align: 'left',
    baseline: 'alphabetic',
    weight: 500,
  });
}
