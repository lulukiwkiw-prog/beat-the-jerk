import { PUPPET } from '../config/puppet.config';
import type { AccessoryId } from '../game/puppet/looks/accessories';
import type { LookPreset } from '../game/puppet/looks/presets';
import { DESIGN_SIZES, PART_DEFS, SKELETON as SK, type PaintPartId } from '../game/puppet/parts';

/** 正面圖中各部位的中心與大小（場景單位，y 向上），由骨架位置算出。 */
const P = PART_DEFS;
const torsoBase = SK.pelvisY;
const shY = torsoBase + SK.shoulder.y;
const LAYOUT: Record<string, [number, number, number, number]> = {
  neck: [0, torsoBase + SK.neckJointY + SK.neck.y, SK.neck.radius * 2, SK.neck.height],
  head: [0, torsoBase + SK.neckJointY + SK.headY, P.head.size[0], P.head.size[1]],
  torso: [0, torsoBase + SK.torsoY, P.torso.size[0], P.torso.size[1]],
  upperArmL: [-SK.shoulder.x, shY + SK.upperArmY, P.upperArmL.size[0], P.upperArmL.size[1]],
  upperArmR: [SK.shoulder.x, shY + SK.upperArmY, P.upperArmR.size[0], P.upperArmR.size[1]],
  foreArmL: [-SK.shoulder.x, shY + SK.elbowY + SK.foreArmY, P.foreArmL.size[0], P.foreArmL.size[1]],
  foreArmR: [SK.shoulder.x, shY + SK.elbowY + SK.foreArmY, P.foreArmR.size[0], P.foreArmR.size[1]],
  handL: [-SK.shoulder.x, shY + SK.elbowY + SK.handY, 0.5, 0.48],
  handR: [SK.shoulder.x, shY + SK.elbowY + SK.handY, 0.5, 0.48],
  thighL: [-SK.hipX, torsoBase + SK.thighY, P.thighL.size[0], P.thighL.size[1]],
  thighR: [SK.hipX, torsoBase + SK.thighY, P.thighR.size[0], P.thighR.size[1]],
  shinL: [-SK.hipX, torsoBase + SK.kneeY + SK.shinY, P.shinL.size[0], P.shinL.size[1]],
  shinR: [SK.hipX, torsoBase + SK.kneeY + SK.shinY, P.shinR.size[0], P.shinR.size[1]],
  shoeL: [-SK.hipX, torsoBase + SK.kneeY + SK.shoe.y, 0.74, 0.28],
  shoeR: [SK.hipX, torsoBase + SK.kneeY + SK.shoe.y, 0.74, 0.28],
};
const HEAD_ACC: AccessoryId[] = ['pigHead', 'teruteru', 'chickenHead', 'dinoHead', 'longHair', 'shortHair', 'ponytail', 'swoop', 'slick', 'buzz'];

type View = { cx: number; cy: number; span: number };
const VIEWS: Record<'head' | 'body', View> = {
  head: { cx: 0, cy: LAYOUT.head[1] + 0.12, span: 2.3 },
  body: { cx: 0, cy: 2.35, span: 5.2 },
};

/** 3D 配件在正面圖上的簡化輪廓（場景座標） */
function overlay(c: CanvasRenderingContext2D, id: AccessoryId) {
  // 輪廓以舊的設計比例畫：頭部配件對到新頭的位置與大小，身體配件對到新軀幹
  c.save();
  if (HEAD_ACC.includes(id)) {
    const [, hy, hw, hh] = LAYOUT.head;
    c.translate(0, hy);
    c.scale(hw / 1.22, hh / 1.1);
    c.translate(0, -4.15);
  } else c.translate(0, LAYOUT.torso[1] - 2.9);
  overlayDesign(c, id);
  c.restore();
}

function overlayDesign(c: CanvasRenderingContext2D, id: AccessoryId) {
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
  const e = (color: string, x: number, y: number, rx: number, ry: number) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  switch (id) {
    case 'pigHead':
      poly('#EE8FA6', [[-0.7, top - 0.05], [-0.3, top + 0.05], [-0.62, top + 0.4]]);
      poly('#EE8FA6', [[0.7, top - 0.05], [0.3, top + 0.05], [0.62, top + 0.4]]);
      e('#EE8FA6', 0, 4.05, 0.28, 0.27);
      e('#8E4A5A', -0.1, 4.05, 0.05, 0.07);
      e('#8E4A5A', 0.1, 4.05, 0.05, 0.07);
      break;
    case 'teruteru':
      poly('#FFFFFF', [[-0.5, 3.62], [0.5, 3.62], [1.15, 2.7], [-1.15, 2.7]]);
      r('#E53935', 0, 3.62, 1.0, 0.08);
      break;
    case 'chickenHead':
      e('#FFD23F', 0, top - 0.05, 0.62, 0.3);
      poly('#E8452C', [[-0.2, top + 0.1], [0.25, top + 0.1], [0.15, top + 0.75], [-0.05, top + 0.55]]);
      for (const x of [-0.3, 0.3]) {
        e('#FFFFFF', x, 4.35, 0.2, 0.2);
        e('#1E1E1E', x + (x < 0 ? 0.02 : -0.02), 4.44, 0.075, 0.075);
      }
      e('#F57C00', 0, 3.93, 0.27, 0.38);
      e('#5A1414', 0, 3.93, 0.19, 0.29);
      e('#E8452C', -0.11, 3.6, 0.13, 0.16);
      e('#E8452C', 0.11, 3.6, 0.13, 0.16);
      break;
    case 'dinoHead':
      for (const x of [-0.3, 0, 0.3]) poly('#F28C28', [[x - 0.15, top], [x + 0.15, top], [x, top + 0.4]]);
      r('#5FAE4E', 0, 3.93, 1.0, 0.5);
      for (let i = 0; i < 6; i++) poly('#FFFFFF', [[-0.38 + i * 0.15 - 0.06, 3.68], [-0.38 + i * 0.15 + 0.06, 3.68], [-0.38 + i * 0.15, 3.56]]);
      e('#2E5A26', -0.18, 4.1, 0.05, 0.05);
      e('#2E5A26', 0.18, 4.1, 0.05, 0.05);
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
      e('#FFE680', 0, 2.85, 0.6, 0.6);
      for (const x of [-1.45, 1.45]) r('#FFD23F', x, 2.7, 0.16, 1.5);
      for (const x of [-0.43, 0.43]) for (const d of [-0.2, 0, 0.2]) r('#FB8C00', x + d, 0.15, 0.08, 0.3);
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
      e('#F8C8D4', 0, 2.85, 0.6, 0.6);
      for (const x of [-1.13, 1.13]) r('#9C5466', x, 1.9, 0.56, 0.3);
      for (const x of [-0.43, 0.43]) r('#9C5466', x, 0.45, 0.8, 0.32);
      break;
    case 'dinoSuit':
      e('#F7E27A', 0, 2.85, 0.6, 0.6);
      poly('#5FAE4E', [[0.8, 2.4], [1.9, 1.4], [2.3, 0.8], [1.6, 1.1], [0.8, 1.9]]);
      for (const [x, y] of [[1.3, 2.05], [1.85, 1.55]]) poly('#F28C28', [[x - 0.12, y], [x + 0.12, y], [x, y + 0.3]]);
      for (const x of [-1.13, 1.13]) for (const d of [-0.14, 0, 0.14]) poly('#FFFFFF', [[x + d - 0.05, 1.75], [x + d + 0.05, 1.75], [x + d, 1.55]]);
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
    const fixed = part.startsWith('hand') || part.startsWith('shoe') || part === 'neck';
    c.fillStyle = part.startsWith('hand') ? PUPPET.handColor : part.startsWith('shoe') ? PUPPET.shoeColor : PUPPET.baseColor;
    // 頭是圓角圓柱，正面看是圓角長方形
    const shape = () => {
      c.beginPath();
      if (part === 'head') c.roundRect(x - w / 2, y - h / 2, w, h, 0.2);
      else c.rect(x - w / 2, y - h / 2, w, h);
    };
    shape();
    c.fill();
    const draw = !fixed && look.paint[part as PaintPartId]?.[4];
    if (draw) {
      const [pw, ph] = DESIGN_SIZES[part as PaintPartId];
      c.save();
      shape();
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
