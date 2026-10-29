/** 範例彩繪用的小工具。座標都是該面的實際尺寸（場景單位，原點左上、y 向下）。 */
export type Ctx = CanvasRenderingContext2D;
export type Draw = (c: Ctx, w: number, h: number) => void;

export const INK = '#1E1E1E';
export const WHITE = '#FFFFFF';

export function stroke(c: Ctx, width: number, color = INK) {
  c.lineWidth = width;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

export function dot(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
}

/** 填滿整面（多畫一點點蓋到留白，邊緣才不會露底色）。 */
export const fill = (color: string): Draw => (c, w, h) => rect(c, -0.05, -0.05, w + 0.1, h + 0.1, color);

/** 只填上方一段（例如頭髮蓋到側面的上半部）。 */
export const fillTop = (color: string, frac: number): Draw => (c, w, h) => rect(c, -0.05, -0.05, w + 0.1, h * frac + 0.05, color);
export const fillBottom = (color: string, frac: number): Draw => (c, w, h) => rect(c, -0.05, h * (1 - frac), w + 0.1, h * frac + 0.05, color);

export function eyeWhite(c: Ctx, x: number, y: number, r: number) {
  dot(c, x, y, r, WHITE);
  stroke(c, 0.035);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

export function blush(c: Ctx, w: number, y: number, color = 'rgba(244,143,177,.8)') {
  dot(c, 0.17, y, 0.08, color);
  dot(c, w - 0.17, y, 0.08, color);
}

export function lashes(c: Ctx, x: number, y: number, r: number, dir: 1 | -1) {
  stroke(c, 0.025);
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + dir * (0.35 + i * 0.35);
    c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.lineTo(x + Math.cos(a) * (r + 0.07), y + Math.sin(a) * (r + 0.07));
  }
  c.stroke();
}

/** 合併多個畫法 */
export const all = (...ds: Draw[]): Draw => (c, w, h) => ds.forEach((d) => d(c, w, h));
