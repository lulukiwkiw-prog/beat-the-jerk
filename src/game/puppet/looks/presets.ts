import type { Face } from '../faces';
import type { PaintPartId } from '../parts';
import type { AccessoryId } from './accessories';
import {
  all, blush, dot, ellipse, eyeWhite, fill, fillBottom, fillTop, INK, lashes, rect, stroke, WHITE, type Draw,
} from './draw';

export type LookKind = 'face' | 'hair' | 'costume';
export type PaintPlan = Partial<Record<PaintPartId, Partial<Record<Face, Draw>>>>;

export interface LookPreset {
  id: string;
  kind: LookKind;
  label: string;
  /** 畫進彩繪貼圖的內容（疊在原本的畫上） */
  paint: PaintPlan;
  /** 3D 凸出配件；null＝這一類不放配件 */
  accessory: AccessoryId | null;
}

const F = { PX: 0, NX: 1, PY: 2, NY: 3, PZ: 4, NZ: 5 } as const;
const SIX = [0, 1, 2, 3, 4, 5] as const;

/** 部位六面都填同一色，front 額外疊畫正面。 */
function whole(color: string, front?: Draw): Partial<Record<Face, Draw>> {
  const o: Partial<Record<Face, Draw>> = {};
  for (const f of SIX) o[f] = fill(color);
  if (front) o[F.PZ] = all(fill(color), front);
  return o;
}

// ---------- 臉部 ----------
const crossEyed: Draw = (c, w) => {
  const ex = [w * 0.3, w * 0.7];
  for (const x of ex) eyeWhite(c, x, 0.44, 0.15);
  dot(c, ex[0] + 0.07, 0.47, 0.065, INK);
  dot(c, ex[1] - 0.07, 0.47, 0.065, INK);
  stroke(c, 0.045);
  c.beginPath();
  c.moveTo(w * 0.3, 0.76);
  c.quadraticCurveTo(w * 0.5, 0.86, w * 0.7, 0.76);
  c.stroke();
  for (const x of [w * 0.5 - 0.12, w * 0.5]) {
    rect(c, x, 0.81, 0.12, 0.16, WHITE);
    stroke(c, 0.03);
    c.strokeRect(x, 0.81, 0.12, 0.16);
  }
};

const smirk: Draw = (c, w) => {
  stroke(c, 0.055);
  c.beginPath();
  c.moveTo(0.16, 0.32);
  c.quadraticCurveTo(0.3, 0.14, 0.48, 0.26);
  c.moveTo(w - 0.46, 0.38);
  c.lineTo(w - 0.16, 0.35);
  c.stroke();
  dot(c, 0.33, 0.47, 0.065, INK);
  dot(c, w - 0.31, 0.49, 0.065, INK);
  stroke(c, 0.04);
  c.beginPath();
  c.moveTo(w - 0.44, 0.45);
  c.lineTo(w - 0.18, 0.45);
  c.stroke();
  stroke(c, 0.05);
  c.beginPath();
  c.moveTo(w * 0.32, 0.82);
  c.quadraticCurveTo(w * 0.6, 0.86, w * 0.78, 0.68);
  c.moveTo(w * 0.74, 0.66);
  c.lineTo(w * 0.82, 0.72);
  c.stroke();
  blush(c, w, 0.72);
};

const crying: Draw = (c, w) => {
  stroke(c, 0.05);
  c.beginPath();
  c.moveTo(0.16, 0.36);
  c.lineTo(0.48, 0.26);
  c.moveTo(w - 0.16, 0.36);
  c.lineTo(w - 0.48, 0.26);
  c.stroke();
  for (const x of [0.33, w - 0.33]) {
    c.beginPath();
    c.arc(x, 0.5, 0.09, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }
  for (const x of [0.33, w - 0.33]) {
    stroke(c, 0.08, '#64B5F6');
    c.beginPath();
    c.moveTo(x, 0.52);
    c.quadraticCurveTo(x + (x < w / 2 ? -0.05 : 0.05), 0.8, x, 1.1);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(w * 0.36, 0.92);
  c.quadraticCurveTo(w * 0.5, 0.66, w * 0.64, 0.92);
  c.closePath();
  c.fillStyle = '#5A2230';
  c.fill();
  stroke(c, 0.035);
  c.stroke();
  stroke(c, 0.06, '#9CCC65');
  c.beginPath();
  c.moveTo(w * 0.53, 0.6);
  c.quadraticCurveTo(w * 0.56, 0.68, w * 0.54, 0.74);
  c.stroke();
  dot(c, w * 0.55, 0.77, 0.045, '#9CCC65');
  dot(c, w * 0.42, 0.6, 0.05, 'rgba(156,204,101,.55)');
};

const eyeRoll: Draw = (c, w) => {
  for (const x of [w * 0.3, w * 0.7]) {
    eyeWhite(c, x, 0.44, 0.15);
    c.save();
    c.beginPath();
    c.arc(x, 0.44, 0.13, 0, Math.PI * 2);
    c.clip();
    dot(c, x, 0.3, 0.07, INK);
    c.restore();
  }
  stroke(c, 0.045);
  c.beginPath();
  c.moveTo(w * 0.32, 0.76);
  c.lineTo(w * 0.68, 0.76);
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.46, 0.76);
  c.lineTo(w * 0.46, 0.9);
  c.arc(w * 0.53, 0.9, w * 0.07, Math.PI, 0, true);
  c.lineTo(w * 0.6, 0.76);
  c.closePath();
  c.fillStyle = '#F06A86';
  c.fill();
  stroke(c, 0.03);
  c.stroke();
  stroke(c, 0.02, '#B8405A');
  c.beginPath();
  c.moveTo(w * 0.53, 0.78);
  c.lineTo(w * 0.53, 0.9);
  c.stroke();
};

function redLips(c: CanvasRenderingContext2D, w: number, y: number, color = '#D81B60') {
  c.beginPath();
  c.moveTo(w * 0.36, y);
  c.quadraticCurveTo(w * 0.43, y - 0.08, w * 0.5, y - 0.02);
  c.quadraticCurveTo(w * 0.57, y - 0.08, w * 0.64, y);
  c.quadraticCurveTo(w * 0.5, y + 0.12, w * 0.36, y);
  c.fillStyle = color;
  c.fill();
}

// 女性臉 1：大眼紅唇
const glam: Draw = (c, w) => {
  stroke(c, 0.03);
  c.beginPath();
  c.moveTo(0.18, 0.3);
  c.quadraticCurveTo(0.32, 0.22, 0.46, 0.28);
  c.moveTo(w - 0.18, 0.3);
  c.quadraticCurveTo(w - 0.32, 0.22, w - 0.46, 0.28);
  c.stroke();
  for (const [x, d] of [[0.32, -1], [w - 0.32, 1]] as const) {
    ellipse(c, x, 0.47, 0.12, 0.1, WHITE);
    dot(c, x, 0.48, 0.07, '#4A2C1A');
    dot(c, x + 0.025, 0.455, 0.022, WHITE);
    stroke(c, 0.035);
    c.beginPath();
    c.ellipse(x, 0.47, 0.12, 0.1, 0, Math.PI, Math.PI * 2);
    c.stroke();
    lashes(c, x, 0.47, 0.11, d);
  }
  redLips(c, w, 0.82);
  blush(c, w, 0.68, 'rgba(240,98,146,.55)');
};

// 女性臉 2：眨眼雀斑
const wink: Draw = (c, w) => {
  const lx = 0.33;
  const rx = w - 0.33;
  ellipse(c, lx, 0.46, 0.09, 0.11, INK);
  dot(c, lx + 0.03, 0.42, 0.025, WHITE);
  lashes(c, lx, 0.46, 0.1, -1);
  stroke(c, 0.045);
  c.beginPath();
  c.moveTo(rx - 0.11, 0.48);
  c.quadraticCurveTo(rx, 0.38, rx + 0.11, 0.48);
  c.stroke();
  lashes(c, rx, 0.47, 0.06, 1);
  for (const [x, y] of [[0.2, 0.62], [0.28, 0.66], [0.22, 0.7], [w - 0.2, 0.62], [w - 0.28, 0.66], [w - 0.22, 0.7]]) dot(c, x, y, 0.016, '#A86B45');
  stroke(c, 0.04, '#E8546A');
  c.beginPath();
  c.moveTo(w * 0.4, 0.78);
  c.quadraticCurveTo(w * 0.52, 0.88, w * 0.62, 0.76);
  c.stroke();
  blush(c, w, 0.66, 'rgba(244,143,177,.7)');
};

const PIG = '#F4A7B9';
const pigFace: Draw = (c, w) => {
  stroke(c, 0.04);
  c.beginPath();
  c.moveTo(0.2, 0.28);
  c.lineTo(0.42, 0.33);
  c.moveTo(w - 0.2, 0.28);
  c.lineTo(w - 0.42, 0.33);
  c.stroke();
  dot(c, 0.33, 0.42, 0.06, INK);
  dot(c, w - 0.33, 0.42, 0.06, INK);
  stroke(c, 0.04);
  c.beginPath();
  c.moveTo(w * 0.38, 0.9);
  c.quadraticCurveTo(w * 0.5, 0.98, w * 0.62, 0.9);
  c.stroke();
  blush(c, w, 0.66, 'rgba(232,84,106,.45)');
};

const teruteru: Draw = (c, w) => {
  dot(c, w * 0.34, 0.46, 0.06, INK);
  dot(c, w * 0.66, 0.46, 0.06, INK);
  stroke(c, 0.04);
  c.beginPath();
  c.arc(w * 0.5, 0.62, 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  blush(c, w, 0.62, 'rgba(244,143,177,.7)');
};

const CHICK = '#FFD23F';
/** 崩潰尖叫的橡膠雞：圓白眼往上看、嘴巴張成直立長橢圓 */
const chickenFace: Draw = (c, w) => {
  for (const x of [w * 0.3, w * 0.7]) {
    eyeWhite(c, x, 0.27, 0.15);
    dot(c, x + (x < w / 2 ? 0.03 : -0.01), 0.2, 0.055, INK);
  }
  // 張到最大的嘴：橘色嘴喙外圈＋深紅嘴裡＋舌頭
  ellipse(c, w * 0.5, 0.74, 0.3, 0.36, '#F57C00');
  stroke(c, 0.035);
  c.beginPath();
  c.ellipse(w * 0.5, 0.74, 0.3, 0.36, 0, 0, Math.PI * 2);
  c.stroke();
  ellipse(c, w * 0.5, 0.77, 0.2, 0.27, '#5A1414');
  c.save();
  c.beginPath();
  c.ellipse(w * 0.5, 0.77, 0.2, 0.27, 0, 0, Math.PI * 2);
  c.clip();
  ellipse(c, w * 0.5, 0.99, 0.15, 0.1, '#E25A4E');
  c.restore();
  ellipse(c, w * 0.36, 0.56, 0.05, 0.03, 'rgba(255,255,255,.55)', -0.6);
};

const DINO = '#6BBF59';
const dinoFace: Draw = (c, w) => {
  for (const x of [w * 0.28, w * 0.72]) {
    ellipse(c, x, 0.38, 0.11, 0.09, '#FFE45C');
    ellipse(c, x, 0.38, 0.025, 0.08, INK);
  }
  dot(c, w * 0.42, 0.58, 0.025, '#2E5A26');
  dot(c, w * 0.58, 0.58, 0.025, '#2E5A26');
  rect(c, w * 0.18, 0.74, w * 0.64, 0.14, '#2E1A16');
  c.fillStyle = WHITE;
  for (let i = 0; i < 6; i++) {
    const x = w * 0.2 + i * w * 0.1;
    c.beginPath();
    c.moveTo(x, 0.74);
    c.lineTo(x + w * 0.05, 0.82);
    c.lineTo(x + w * 0.1, 0.74);
    c.fill();
    c.beginPath();
    c.moveTo(x, 0.88);
    c.lineTo(x + w * 0.05, 0.81);
    c.lineTo(x + w * 0.1, 0.88);
    c.fill();
  }
};

// ---------- 髮型（彩繪部分） ----------
function hairPaint(color: string, opts: { sides: number; back: number; front: Draw }): Partial<Record<Face, Draw>> {
  return { [F.PY]: fill(color), [F.PX]: fillTop(color, opts.sides), [F.NX]: fillTop(color, opts.sides), [F.NZ]: fillTop(color, opts.back), [F.PZ]: opts.front };
}
const fringe = (color: string, depth: number): Draw => (c, w) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-0.05, -0.05);
  c.lineTo(w + 0.05, -0.05);
  c.lineTo(w + 0.05, depth);
  for (let i = 5; i >= 0; i--) c.lineTo((w / 5) * i, i % 2 ? depth * 1.25 : depth * 0.8);
  c.closePath();
  c.fill();
};
const sidePart = (color: string): Draw => (c, w) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-0.05, -0.05);
  c.lineTo(w + 0.05, -0.05);
  c.lineTo(w + 0.05, 0.2);
  c.quadraticCurveTo(w * 0.5, 0.06, w * 0.3, 0.22);
  c.lineTo(-0.05, 0.16);
  c.closePath();
  c.fill();
};
const BROWN = '#5A3A22';
const DARK = '#2B2B33';
const BLOND = '#F2C14E';

const baldTop: Draw = (c, w, h) => {
  ellipse(c, w * 0.62, h * 0.4, w * 0.22, h * 0.12, 'rgba(255,255,255,.75)', -0.4);
};
const baldSide: Draw = (c, w, h) => {
  rect(c, -0.05, h * 0.35, w + 0.1, h * 0.25, '#7A7A80');
};
const baldFront: Draw = (c, w) => {
  ellipse(c, w * 0.7, 0.1, 0.14, 0.05, 'rgba(255,255,255,.8)', -0.3);
};
const buzz = (color: string): Draw => (c, w, h) => {
  rect(c, -0.05, -0.05, w + 0.1, h + 0.1, '#6E6E76');
  for (let i = 0; i < 140; i++) dot(c, ((i * 37) % 100) / 100 * w, ((i * 61) % 100) / 100 * h, 0.012, color);
};

// ---------- 服裝（彩繪部分） ----------
const ARM_PARTS = ['upperArmL', 'upperArmR', 'foreArmL', 'foreArmR'] as const;
const LEG_PARTS = ['thighL', 'thighR', 'shinL', 'shinR'] as const;

function body(colors: { torso: string; arms?: string; legs?: string }, torsoFront?: Draw, extra: PaintPlan = {}): PaintPlan {
  const p: PaintPlan = { torso: whole(colors.torso, torsoFront) };
  if (colors.arms) for (const a of ARM_PARTS) p[a] = whole(colors.arms);
  if (colors.legs) for (const l of LEG_PARTS) p[l] = whole(colors.legs);
  for (const k of Object.keys(extra) as PaintPartId[]) p[k] = { ...(p[k] ?? {}), ...extra[k] };
  return p;
}

const NAVY = '#24304F';
const suitFront: Draw = (c, w) => {
  c.fillStyle = WHITE;
  c.beginPath();
  c.moveTo(w * 0.3, -0.05);
  c.lineTo(w * 0.5, 0.8);
  c.lineTo(w * 0.7, -0.05);
  c.fill();
  c.fillStyle = '#C62828';
  c.beginPath();
  c.moveTo(w * 0.46, 0.04);
  c.lineTo(w * 0.54, 0.04);
  c.lineTo(w * 0.53, 0.14);
  c.lineTo(w * 0.57, 0.62);
  c.lineTo(w * 0.5, 0.72);
  c.lineTo(w * 0.43, 0.62);
  c.lineTo(w * 0.47, 0.14);
  c.closePath();
  c.fill();
  stroke(c, 0.03, '#141B2E');
  c.beginPath();
  c.moveTo(w * 0.3, -0.05);
  c.lineTo(w * 0.38, 0.5);
  c.lineTo(w * 0.5, 0.8);
  c.moveTo(w * 0.7, -0.05);
  c.lineTo(w * 0.62, 0.5);
  c.lineTo(w * 0.5, 0.8);
  c.stroke();
  for (const y of [1.0, 1.25]) dot(c, w * 0.5, y, 0.035, '#141B2E');
  rect(c, w * 0.72, 0.42, 0.18, 0.05, WHITE);
};
const cuff: Draw = (c, w, h) => rect(c, -0.05, h * 0.82, w + 0.1, h * 0.2, WHITE);
const crease: Draw = (c, w, h) => {
  stroke(c, 0.02, '#141B2E');
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w / 2, h);
  c.stroke();
};

const belly = (color: string, lines?: string): Draw => (c, w, h) => {
  ellipse(c, w / 2, h * 0.58, w * 0.32, h * 0.38, color);
  if (lines) {
    stroke(c, 0.03, lines);
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = h * (0.32 + i * 0.14);
      c.moveTo(w * 0.3, y);
      c.lineTo(w * 0.7, y);
    }
    c.stroke();
  }
};
const hoof = (color: string): Draw => fillBottom(color, 0.22);

const dressTop = (trim: string): Draw => (c, w, h) => {
  // 領口與腰帶
  c.fillStyle = '#F2D29B';
  c.beginPath();
  c.moveTo(w * 0.32, -0.05);
  c.quadraticCurveTo(w * 0.5, 0.32, w * 0.68, -0.05);
  c.fill();
  rect(c, -0.05, h * 0.78, w + 0.1, 0.1, trim);
};
const collar: Draw = (c, w) => {
  c.fillStyle = WHITE;
  c.beginPath();
  c.moveTo(w * 0.28, -0.05);
  c.lineTo(w * 0.5, 0.18);
  c.lineTo(w * 0.72, -0.05);
  c.lineTo(w * 0.62, 0.22);
  c.lineTo(w * 0.5, 0.2);
  c.lineTo(w * 0.38, 0.22);
  c.closePath();
  c.fill();
};
const sleeveTop = (color: string): Draw => fillTop(color, 0.45);

export const LOOKS: LookPreset[] = [
  // 臉部
  { id: 'crossEyed', kind: 'face', label: '鬥雞眼暴牙', paint: { head: { [F.PZ]: crossEyed } }, accessory: null },
  { id: 'smirk', kind: 'face', label: '歪嘴挑眉', paint: { head: { [F.PZ]: smirk } }, accessory: null },
  { id: 'crying', kind: 'face', label: '哭哭鼻涕', paint: { head: { [F.PZ]: crying } }, accessory: null },
  { id: 'eyeRoll', kind: 'face', label: '翻白眼吐舌', paint: { head: { [F.PZ]: eyeRoll } }, accessory: null },
  { id: 'glam', kind: 'face', label: '大眼紅唇', paint: { head: { [F.PZ]: glam } }, accessory: null },
  { id: 'wink', kind: 'face', label: '眨眼雀斑', paint: { head: { [F.PZ]: wink } }, accessory: null },
  { id: 'pigHead', kind: 'face', label: '豬頭', paint: { head: whole(PIG, pigFace) }, accessory: 'pigHead' },
  { id: 'teruteru', kind: 'face', label: '晴天娃娃', paint: { head: whole(WHITE, teruteru) }, accessory: 'teruteru' },
  { id: 'chickenHead', kind: 'face', label: '尖叫雞', paint: { head: whole(CHICK, chickenFace) }, accessory: 'chickenHead' },
  { id: 'dinoHead', kind: 'face', label: '恐龍頭', paint: { head: whole(DINO, dinoFace) }, accessory: 'dinoHead' },
  // 髮型
  { id: 'longHair', kind: 'hair', label: '長髮', paint: { head: hairPaint(BROWN, { sides: 1, back: 1, front: fringe(BROWN, 0.28) }) }, accessory: 'longHair' },
  { id: 'shortHair', kind: 'hair', label: '短髮', paint: { head: hairPaint(DARK, { sides: 0.42, back: 0.55, front: fringe(DARK, 0.22) }) }, accessory: 'shortHair' },
  { id: 'bald', kind: 'hair', label: '禿頭', paint: { head: { [F.PY]: baldTop, [F.PX]: baldSide, [F.NX]: baldSide, [F.NZ]: baldSide, [F.PZ]: baldFront } }, accessory: null },
  { id: 'ponytail', kind: 'hair', label: '綁馬尾', paint: { head: hairPaint(BROWN, { sides: 0.45, back: 0.7, front: sidePart(BROWN) }) }, accessory: 'ponytail' },
  { id: 'swoop', kind: 'hair', label: '金色蓬蓬旁分', paint: { head: hairPaint(BLOND, { sides: 0.5, back: 0.55, front: sidePart(BLOND) }) }, accessory: 'swoop' },
  { id: 'slick', kind: 'hair', label: '西裝頭', paint: { head: hairPaint(INK, { sides: 0.35, back: 0.5, front: sidePart(INK) }) }, accessory: 'slick' },
  { id: 'buzz', kind: 'hair', label: '平頭', paint: { head: { [F.PY]: buzz('#2B2B33'), [F.PX]: all(fillTop('#6E6E76', 0.35)), [F.NX]: fillTop('#6E6E76', 0.35), [F.NZ]: fillTop('#6E6E76', 0.4), [F.PZ]: fillTop('#6E6E76', 0.1) } }, accessory: 'buzz' },
  // 服裝
  { id: 'chickenSuit', kind: 'costume', label: '尖叫雞', paint: body({ torso: CHICK, arms: CHICK, legs: CHICK }, belly('#FFE680')), accessory: 'chickenSuit' },
  {
    id: 'suit', kind: 'costume', label: '西裝',
    paint: body({ torso: NAVY, arms: NAVY, legs: NAVY }, suitFront, {
      foreArmL: { [F.PZ]: all(fill(NAVY), cuff), [F.PX]: all(fill(NAVY), cuff), [F.NX]: all(fill(NAVY), cuff), [F.NZ]: all(fill(NAVY), cuff) },
      foreArmR: { [F.PZ]: all(fill(NAVY), cuff), [F.PX]: all(fill(NAVY), cuff), [F.NX]: all(fill(NAVY), cuff), [F.NZ]: all(fill(NAVY), cuff) },
      thighL: { [F.PZ]: all(fill(NAVY), crease) }, thighR: { [F.PZ]: all(fill(NAVY), crease) },
      shinL: { [F.PZ]: all(fill(NAVY), crease) }, shinR: { [F.PZ]: all(fill(NAVY), crease) },
    }),
    accessory: null,
  },
  {
    id: 'longDress', kind: 'costume', label: '長裙',
    paint: body({ torso: '#C2185B', legs: '#C2185B' }, dressTop('#FFC63A'), { upperArmL: { [F.PZ]: sleeveTop('#C2185B'), [F.PX]: sleeveTop('#C2185B'), [F.NX]: sleeveTop('#C2185B'), [F.NZ]: sleeveTop('#C2185B'), [F.PY]: fill('#C2185B') }, upperArmR: { [F.PZ]: sleeveTop('#C2185B'), [F.PX]: sleeveTop('#C2185B'), [F.NX]: sleeveTop('#C2185B'), [F.NZ]: sleeveTop('#C2185B'), [F.PY]: fill('#C2185B') } }),
    accessory: 'longDress',
  },
  {
    id: 'shortDress', kind: 'costume', label: '短裙',
    paint: body({ torso: '#4FC3F7' }, collar, { thighL: { [F.PZ]: fillTop('#4FC3F7', 0.35), [F.PX]: fillTop('#4FC3F7', 0.35), [F.NX]: fillTop('#4FC3F7', 0.35), [F.NZ]: fillTop('#4FC3F7', 0.35) }, thighR: { [F.PZ]: fillTop('#4FC3F7', 0.35), [F.PX]: fillTop('#4FC3F7', 0.35), [F.NX]: fillTop('#4FC3F7', 0.35), [F.NZ]: fillTop('#4FC3F7', 0.35) } }),
    accessory: 'shortDress',
  },
  {
    id: 'pigBody', kind: 'costume', label: '豬身體',
    paint: body({ torso: PIG, arms: PIG, legs: PIG }, belly('#F8C8D4'), {
      foreArmL: { [F.PZ]: all(fill(PIG), hoof('#8E5A66')) }, foreArmR: { [F.PZ]: all(fill(PIG), hoof('#8E5A66')) },
      shinL: { [F.PZ]: all(fill(PIG), hoof('#8E5A66')), [F.PX]: all(fill(PIG), hoof('#8E5A66')), [F.NX]: all(fill(PIG), hoof('#8E5A66')) },
      shinR: { [F.PZ]: all(fill(PIG), hoof('#8E5A66')), [F.PX]: all(fill(PIG), hoof('#8E5A66')), [F.NX]: all(fill(PIG), hoof('#8E5A66')) },
    }),
    accessory: 'pigBody',
  },
  { id: 'dinoSuit', kind: 'costume', label: '恐龍裝', paint: body({ torso: DINO, arms: DINO, legs: DINO }, belly('#F7E27A', '#D9B93A')), accessory: 'dinoSuit' },
];

export const LOOK_KINDS: { kind: LookKind; label: string }[] = [
  { kind: 'face', label: '臉部' },
  { kind: 'hair', label: '髮型' },
  { kind: 'costume', label: '服裝' },
];

export const lookById = (id: string) => LOOKS.find((l) => l.id === id);
export const looksOf = (k: LookKind) => LOOKS.filter((l) => l.kind === k);
