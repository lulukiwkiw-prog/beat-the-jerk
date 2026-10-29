import type { Face } from './faces';

export const PAINT_PARTS = [
  'head', 'torso', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'thighL', 'thighR', 'shinL', 'shinR',
] as const;
export type PaintPartId = (typeof PAINT_PARTS)[number];
export type FixedPartId = 'handL' | 'handR' | 'shoeL' | 'shoeR';

export interface PartDef {
  label: string;
  /** 寬、高、深（場景單位） */
  size: [number, number, number];
  radius: number;
}

/** 十個可彩繪部位。站立身高（含頭頂凸點）＝4.8。 */
export const PART_DEFS: Record<PaintPartId, PartDef> = {
  head: { label: '頭', size: [1.22, 1.1, 1.1], radius: 0.24 },
  torso: { label: '軀幹', size: [1.7, 1.5, 1.0], radius: 0.16 },
  upperArmL: { label: '左上臂', size: [0.5, 0.8, 0.55], radius: 0.12 },
  upperArmR: { label: '右上臂', size: [0.5, 0.8, 0.55], radius: 0.12 },
  foreArmL: { label: '左前臂', size: [0.46, 0.75, 0.5], radius: 0.12 },
  foreArmR: { label: '右前臂', size: [0.46, 0.75, 0.5], radius: 0.12 },
  thighL: { label: '左大腿', size: [0.72, 0.95, 0.8], radius: 0.12 },
  thighR: { label: '右大腿', size: [0.72, 0.95, 0.8], radius: 0.12 },
  shinL: { label: '左小腿', size: [0.68, 0.95, 0.76], radius: 0.12 },
  shinR: { label: '右小腿', size: [0.68, 0.95, 0.76], radius: 0.12 },
};

export const FACE_LABELS: Record<Face, string> = {
  0: '右側', 1: '左側', 2: '頂面', 3: '底面', 4: '正面', 5: '背面',
};
