// VoltXAmpere v2 — canvas render ortak araçları (Sprint 0.5).
//
// Her sembol dosyası bu helper'ları kullanır. Değer tokenlerini canvas 2D
// context'e direkt vermek zordur (context CSS variable bilmez) — `<vxa-canvas>`
// `getComputedStyle` ile okuyup renderer'a `RenderColors` olarak geçirir.

export interface Point {
  x: number;
  y: number;
}

/** tokens.css'ten okunan renkler. fillStyle/strokeStyle olarak kullanılır. */
export interface RenderColors {
  // Devre renkleri
  wire: string;       // bileşen gövdesi ve teller — --wire
  ground: string;     // toprak sembolü — --ground
  vPos: string;       // + işaretli terminal — --v-pos (== --accent)
  // Metin renkleri
  fg: string;         // --fg
  fg2: string;        // --fg-2
  fg3: string;        // --fg-3
  fg4: string;        // --fg-4
  accent: string;     // --accent
  current: string;    // --current
  // Arka plan / yüzey
  canvasBg: string;   // --canvas (kapalı şekil fill'i için)
  bg1: string;        // --bg-1 (probe kutusu için)
  line: string;       // --line
  lineStr: string;    // --line-str
}

export function readColors(host: HTMLElement): RenderColors {
  const s = getComputedStyle(host);
  const get = (name: string) => s.getPropertyValue(name).trim();
  return {
    wire: get('--wire'),
    ground: get('--ground'),
    vPos: get('--v-pos'),
    fg: get('--fg'),
    fg2: get('--fg-2'),
    fg3: get('--fg-3'),
    fg4: get('--fg-4'),
    accent: get('--accent'),
    current: get('--current'),
    canvasBg: get('--canvas'),
    bg1: get('--bg-1'),
    line: get('--line'),
    lineStr: get('--line-str'),
  };
}

/** İki nokta arası basit line segment. Caller strokeStyle/lineWidth'u kurar. */
export function lineSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Metin çizimi. Mono/sans + boyut + renk + align + baseline tek imzada. */
export interface TextOpts {
  family: 'mono' | 'sans';
  sizePx: number;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number | string;
  letterSpacingEm?: number;  // Canvas 2D'de native letter-spacing yok; approx.
}

const FONT_STACK_MONO = "'JetBrains Mono', monospace";
const FONT_STACK_SANS = "'Geist', system-ui, sans-serif";

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOpts,
): void {
  const stack = opts.family === 'mono' ? FONT_STACK_MONO : FONT_STACK_SANS;
  const weight = opts.weight ?? 500;
  ctx.font = `${weight} ${opts.sizePx}px ${stack}`;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'alphabetic';
  ctx.fillText(text, x, y);
}

/** Dolgulu daire (junction indicator, pin noktası). */
export function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  diameterPx: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, diameterPx / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** (x, y) noktasını merkez olarak alıp rotation (derece) uygulayan 2D transform.
 * Canvas rotate() convention: pozitif açı = saat yönü (Y-axis aşağı olduğu için). */
export function rotatePointCW(p: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  };
}

/** Round-rect çizici (Canvas roundRect tarayıcı desteği sağlam ama bazı testlerde
 * olmayabilir — basit path manuel). */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
