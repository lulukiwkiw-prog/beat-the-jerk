import { PUPPET } from '../config/puppet.config';
import type { AccessoryId } from '../game/puppet/looks/accessories';
import type { LookPreset } from '../game/puppet/looks/presets';
import { PART_DEFS, type PaintPartId } from '../game/puppet/parts';

/** 正面圖中各部位的中心（場景單位，y 向上），與骨架位置一致。 */
const LAYOUT: Record<PaintPartId | 'handL' | 'handR' | 'shoeL' | 'shoeR', [number, number, number, number]> = {
  head: [0, 4.15, 1.22, 1.1],
  torso: [0, 2.9, 1.7, 1.5],
  upperArmL: [-1.13, 3.07, 0.5, 0.8],
  upperArmR: [1.13, 3.07, 0.5, 0.8],
  foreArmL: [-1.13, 2.275, 0.46, 0.75],
  foreArmR: [1.13, 2.275, 0.46, 0.75],
  handL: [-1.13, 1.67, 0.5, 0.48],
  handR: [1.13, 1.67, 0.5, 0.48],
  thighL: [-0.43, 1.675, 0.72, 0.95],
  thighR: [0.43, 1.675, 0.72, 0.95],
  shinL: [-0.43, 0.705, 0.68, 0.95],
  shinR: [0.43, 0.705, 0.68, 0.95],
  shoeL: [-0.43, 0.14, 0.74, 0.28],
  shoeR: [0.43, 0.14, 0.74, 0.28],
};

type View = { cx: number; cy: number; span: number };
const VIEWS: Record<'head' | 'body', View> = {
  head: { cx: 0, cy: 4.3, span: 2.2 },
  body: { cx: 0, cy: 2.5, span: 5.4 },
};

/** 3D 配件在正面圖上的簡化輪廓（場景座標） */
function overlay(c: CanvasRenderingContext2D, id: AccessoryId) {
  const poly = (color: string, pts: [number, number][]) => {
    c.fillStyle = color;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  };
  const r = (color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color;
    c.fillRect(x - w / 2, y - h / 2, w, h);
  };
  const top = 4.7;
  switch (id) {
    case 'pigHead':
      poly('#EE8FA6', [[-0.7, top - 0.05], [-0.3, top + 0.05], [-0.55, top + 0.35]]);
      poly('#EE8FA6', [[0.7, top - 0.05], [0.3, top + 0.05], [0.55, top + 0.35]]);
      r('#EE8FA6', 0, 4.07, 0.52, 0.36);
      r('#8E4A5A', -0.1, 4.07, 0.08, 0.1);
      r('#8E4A5A', 0.1, 4.07, 0.08, 0.1);
      break;
    case 'teruteru':
      poly('#FFFFFF', [[-0.5, 3.62], [0.5, 3.62], [1.15, 2.7], [-1.15, 2.7]]);
      r('#E53935', 0, 3.62, 1.0, 0.08);
      break;
    case 'chickenHead':
      poly('#E8452C', [[-0.2, top], [0.25, top], [0.15, top + 0.62], [-0.05, top + 0.45]]);
      r('#F57C00', 0, 4.56, 0.62, 0.1);
      r('#E8452C', -0.11, 3.52, 0.2, 0.26);
      r('#E8452C', 0.11, 3.52, 0.2, 0.26);
      break;
    case 'dinoHead':
      for (const x of [-0.3, 0, 0.3]) poly('#F28C28', [[x - 0.12, top], [x + 0.12, top], [x, top + 0.3]]);
      break;
    case 'longHair':
      r('#5A3A22', 0, top + 0.08, 1.34, 0.22);
      r('#5A3A22', -0.68, 3.85, 0.18, 1.55);
      r('#5A3A22', 0.68, 3.85, 0.18, 1.55);
      break;
    case 'shortHair':
      r('#2B2B33', 0, top + 0.08, 1.32, 0.24);
      break;
    case 'ponytail':
      r('#5A3A22', 0, top + 0.07, 1.32, 0.22);
      poly('#5A3A22', [[0.55, 4.5], [0.95, 4.3], [0.85, 3.6], [0.65, 3.7]]);
      r('#E53935', 0.7, 4.45, 0.16, 0.14);
      break;
    case 'swoop':
      r('#F2C14E', 0.04, top + 0.14, 1.44, 0.4);
      poly('#F5CD64', [[-0.6, top + 0.1], [0.75, top + 0.05], [0.6, top - 0.28], [-0.4, top - 0.15]]);
      break;
    case 'slick':
      r('#1E1E1E', -0.4, top + 0.06, 0.5, 0.16);
      r('#1E1E1E', 0.22, top + 0.1, 0.82, 0.26);
      break;
    case 'buzz':
      r('#3A3A40', 0, top + 0.07, 1.26, 0.14);
      break;
    case 'chickenSuit':
      for (const x of [-1.42, 1.42]) r('#FFD23F', x, 3.07, 0.14, 0.6);
      for (const x of [-0.43, 0.43]) r('#FB8C00', x, 0.03, 0.6, 0.08);
      break;
    case 'longDress':
      poly('#C2185B', [[-0.94, 2.15], [0.94, 2.15], [1.3, 0.2], [-1.3, 0.2]]);
      r('#FFC63A', 0, 0.22, 2.6, 0.08);
      break;
    case 'shortDress':
      poly('#4FC3F7', [[-0.94, 2.15], [0.94, 2.15], [1.18, 1.4], [-1.18, 1.4]]);
      r('#FFFFFF', 0, 1.42, 2.36, 0.07);
      break;
    case 'pigBody':
      c.strokeStyle = '#EE8FA6';
      c.lineWidth = 0.09;
      c.beginPath();
      c.arc(1.05, 2.4, 0.15, 0, Math.PI * 1.6);
      c.stroke();
      break;
    case 'dinoSuit':
      poly('#6BBF59', [[0.8, 2.4], [1.7, 1.6], [2.1, 1.0], [1.5, 1.4], [0.8, 1.9]]);
      for (const y of [3.4, 3.0, 2.6]) poly('#F28C28', [[-0.85, y], [-1.05, y + 0.15], [-0.85, y + 0.3]]);
      break;
  }
}

/** 在畫布上畫出範例的正面預覽（臉部與髮型看頭，服裝看全身）。 */
export function drawLookIcon(cv: HTMLCanvasElement, look: LookPreset) {
  const c = cv.getContext('2d');
  if (!c) return;
  const v = VIEWS[look.kind === 'costume' ? 'body' : 'head'];
  const s = cv.width / v.span;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, -s, cv.width / 2 - v.cx * s, cv.height / 2 + v.cy * s);
  // 立體配件中在身體後面的部分（長髮、裙子）先畫，再畫身體
  const behind: AccessoryId[] = ['longHair', 'ponytail', 'dinoSuit', 'teruteru'];
  if (look.accessory && behind.includes(look.accessory)) overlay(c, look.accessory);
  for (const [part, [x, y, w, h]] of Object.entries(LAYOUT)) {
    const fixed = part.startsWith('hand') || part.startsWith('shoe');
    c.fillStyle = fixed ? (part.startsWith('hand') ? PUPPET.handColor : PUPPET.shoeColor) : PUPPET.baseColor;
    c.fillRect(x - w / 2, y - h / 2, w, h);
    const draw = !fixed && look.paint[part as PaintPartId]?.[4];
    if (draw) {
      const [pw, ph] = PART_DEFS[part as PaintPartId].size;
      c.save();
      c.beginPath();
      c.rect(x - w / 2, y - h / 2, w, h);
      c.clip();
      // 面座標原點在左上、y 向下
      c.transform(1, 0, 0, -1, x - w / 2, y + h / 2);
      c.scale(w / pw, h / ph);
      draw(c, pw, ph);
      c.restore();
    }
  }
  if (look.accessory && !behind.includes(look.accessory)) overlay(c, look.accessory);
  if (look.accessory === 'teruteru') overlay(c, 'teruteru');
}
