import { PAINT } from '../../config/paint.config';

/**
 * 方塊六面在 3×2 圖集中的位置（與 BoxGeometry 面群組順序一致）：
 *   0:+X 1:−X 2:+Y 3:−Y 4:+Z(正面) 5:−Z(背面)
 * 格位：col = f % 3、row = floor(f / 3)，row 0 在 UV 下方（畫布下半部）。
 * 每格四周留 gutter，取樣時不會滲到相鄰面。
 */
export type Face = 0 | 1 | 2 | 3 | 4 | 5;
export const FACES: readonly Face[] = [0, 1, 2, 3, 4, 5];
export const FACE_FRONT: Face = 4;

export interface AtlasLayout {
  cell: number;
  gutter: number;
}
export const DEFAULT_LAYOUT: AtlasLayout = { cell: PAINT.cell, gutter: PAINT.gutter };

export const slot = (L: AtlasLayout) => L.cell + 2 * L.gutter;
export const atlasWidth = (L: AtlasLayout = DEFAULT_LAYOUT) => 3 * slot(L);
export const atlasHeight = (L: AtlasLayout = DEFAULT_LAYOUT) => 2 * slot(L);

const colOf = (f: Face) => f % 3;
const rowOf = (f: Face) => Math.floor(f / 3);

/** 面內 (a,b)∈[0,1]（b 向上）→ 圖集 UV。 */
export function atlasUV(f: number, a: number, b: number, L: AtlasLayout = DEFAULT_LAYOUT): [number, number] {
  const face = f as Face;
  const s = slot(L);
  const u = (colOf(face) * s + L.gutter + a * L.cell) / atlasWidth(L);
  const v = (rowOf(face) * s + L.gutter + b * L.cell) / atlasHeight(L);
  return [u, v];
}

/** 由 UV 落在哪一格判斷是哪一面（不依賴 materialIndex）。 */
export function faceFromUV(u: number, v: number, L: AtlasLayout = DEFAULT_LAYOUT): Face {
  const s = slot(L);
  const col = Math.max(0, Math.min(2, Math.floor((u * atlasWidth(L)) / s)));
  const row = Math.max(0, Math.min(1, Math.floor((v * atlasHeight(L)) / s)));
  return (row * 3 + col) as Face;
}

/** 某面的實際尺寸（寬、高，場景單位）。±X→(d,h)、±Y→(w,d)、±Z→(w,h)。 */
export function faceDims(size: readonly [number, number, number], f: Face): [number, number] {
  const [w, h, d] = size;
  if (f < 2) return [d, h];
  if (f < 4) return [w, d];
  return [w, h];
}

/** 該面格子在畫布上的左上角（px，畫布 y 向下）。 */
export function cellOrigin(f: Face, L: AtlasLayout = DEFAULT_LAYOUT): { x: number; y: number } {
  const s = slot(L);
  return { x: colOf(f) * s + L.gutter, y: (1 - rowOf(f)) * s + L.gutter };
}

export interface FacePoint {
  /** 面座標（場景單位），原點在該面左上，y 向下 */
  x: number;
  y: number;
}

/** UV → 該面上的實際座標（場景單位）。 */
export function uvToFacePoint(
  u: number,
  v: number,
  f: Face,
  size: readonly [number, number, number],
  L: AtlasLayout = DEFAULT_LAYOUT,
): FacePoint {
  const s = slot(L);
  const a = (u * atlasWidth(L) - colOf(f) * s - L.gutter) / L.cell;
  const b = (v * atlasHeight(L) - rowOf(f) * s - L.gutter) / L.cell;
  const [fw, fh] = faceDims(size, f);
  const cl = (x: number) => Math.max(0, Math.min(1, x));
  return { x: cl(a) * fw, y: (1 - cl(b)) * fh };
}
