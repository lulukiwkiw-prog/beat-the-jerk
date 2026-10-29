import { faceDims, type Face } from './faces';

export const PAINT_PARTS = [
  'head', 'torso', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'thighL', 'thighR', 'shinL', 'shinR',
] as const;
export type PaintPartId = (typeof PAINT_PARTS)[number];
export type FixedPartId = 'handL' | 'handR' | 'shoeL' | 'shoeR' | 'neck';

export interface PartDef {
  label: string;
  /** 寬、高、深（場景單位）；圓柱為外接方塊 */
  size: [number, number, number];
  radius: number;
  /** 圓角圓柱（頭）；預設圓角方塊 */
  shape?: 'box' | 'cylinder';
}

/** 十個可彩繪部位。站立身高（含頭頂凸點）＝4.8；大頭、短脖子、短粗腿的玩具比例。 */
export const PART_DEFS: Record<PaintPartId, PartDef> = {
  head: { label: '頭', size: [1.44, 1.25, 1.44], radius: 0.2, shape: 'cylinder' },
  torso: { label: '軀幹', size: [1.7, 1.5, 1.0], radius: 0.16 },
  upperArmL: { label: '左上臂', size: [0.5, 0.76, 0.55], radius: 0.12 },
  upperArmR: { label: '右上臂', size: [0.5, 0.76, 0.55], radius: 0.12 },
  foreArmL: { label: '左前臂', size: [0.46, 0.7, 0.5], radius: 0.12 },
  foreArmR: { label: '右前臂', size: [0.46, 0.7, 0.5], radius: 0.12 },
  thighL: { label: '左大腿', size: [0.76, 0.8, 0.84], radius: 0.13 },
  thighR: { label: '右大腿', size: [0.76, 0.8, 0.84], radius: 0.13 },
  shinL: { label: '左小腿', size: [0.72, 0.76, 0.8], radius: 0.13 },
  shinR: { label: '右小腿', size: [0.72, 0.76, 0.8], radius: 0.13 },
};

/**
 * 骨架位置（場景單位）。關節相對父關節，部位 mesh 相對所屬關節。
 * 地面 0 → 鞋底；骨盆 1.8；軀幹 1.8～3.3；脖子；頭 3.46～4.71；頭頂凸點到 4.8。
 */
export const SKELETON = {
  pelvisY: 1.8,
  torsoY: 0.75,
  neckJointY: 1.5,
  neck: { y: 0.09, radius: 0.3, height: 0.2 },
  headY: 0.785,
  shoulder: { x: 1.13, y: 1.35 },
  upperArmY: -0.38,
  elbowY: -0.78,
  foreArmY: -0.35,
  handY: -0.9,
  hipX: 0.43,
  thighY: -0.41,
  kneeY: -0.84,
  shinY: -0.38,
  shoe: { y: -0.86, z: 0.15 },
} as const;

/** 範例彩繪的設計尺寸（先以這個尺寸畫，再縮放到實際部位），改比例時範例不用重畫。 */
export const DESIGN_SIZES: Record<PaintPartId, [number, number, number]> = {
  head: [1.22, 1.1, 1.1],
  torso: [1.7, 1.5, 1.0],
  upperArmL: [0.5, 0.8, 0.55],
  upperArmR: [0.5, 0.8, 0.55],
  foreArmL: [0.46, 0.75, 0.5],
  foreArmR: [0.46, 0.75, 0.5],
  thighL: [0.72, 0.95, 0.8],
  thighR: [0.72, 0.95, 0.8],
  shinL: [0.68, 0.95, 0.76],
  shinR: [0.68, 0.95, 0.76],
};

export const FACE_LABELS: Record<Face, string> = {
  0: '右側', 1: '左側', 2: '頂面', 3: '底面', 4: '正面', 5: '背面',
};

/** 某部位某一面的實際尺寸（寬、高）。圓柱側面每格是四分之一圓周的弧長。 */
export function partFaceDims(part: PaintPartId, f: Face): [number, number] {
  const def = PART_DEFS[part];
  if (def.shape === 'cylinder') {
    const R = def.size[0] / 2;
    return f === 2 || f === 3 ? [2 * R, 2 * R] : [(Math.PI * R) / 2, def.size[1]];
  }
  return faceDims(def.size, f);
}

/** 頭部中心離地高度（站直時） */
export const headCenterY = () => SKELETON.pelvisY + SKELETON.neckJointY + SKELETON.headY;
