import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, TorusGeometry, type BufferGeometry } from 'three';
import { plastic, srgb } from '../three/color';
import { cachedRoundedBox } from '../three/geometry';

/** 武器與投射物外型的顏色（玩具感、無品牌） */
export const WEAPON_COLORS = {
  shoe: '#8B5A2B',
  sole: '#FFFFFF',
  club: '#C98B4B',
  clubGrip: '#5B3A22',
  hammerHead: '#8E97A6',
  hammerHandle: '#6A4A2E',
  bucket: '#3E8EDE',
  bucketRim: '#E9F2FF',
  wood: '#D9A066',
  woodDark: '#A8703C',
  foam: ['#FFB4C6', '#FFE07A', '#9EE6C9', '#A9CBEA', '#FFC79A'],
} as const;

const geoCache = new Map<string, BufferGeometry>();
function geo<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

function add(parent: Group, g: BufferGeometry, color: string | MeshStandardMaterial, x = 0, y = 0, z = 0) {
  const m = new Mesh(g, typeof color === 'string' ? plastic(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** 丟出去的鞋子（3D 物件，共用幾何與材質）。 */
export function buildShoe(): Group {
  const g = new Group();
  const C = WEAPON_COLORS;
  add(g, geo('shoe-a', () => new BoxGeometry(0.9, 0.26, 0.42)), C.shoe);
  add(g, geo('shoe-b', () => new BoxGeometry(0.4, 0.34, 0.42)), C.shoe, -0.25, 0.28);
  add(g, geo('shoe-s', () => new BoxGeometry(0.94, 0.08, 0.46)), C.sole, 0, -0.15).castShadow = false;
  return g;
}

/** 棍棒：握把在原點，棒身往 -Y 延伸（拿在手上時像手臂延長出去）。 */
export function buildClub(): Group {
  const g = new Group();
  const C = WEAPON_COLORS;
  add(g, geo('club-grip', () => new CylinderGeometry(0.11, 0.11, 0.4, 14)), C.clubGrip, 0, -0.05);
  add(g, geo('club-body', () => new CylinderGeometry(0.13, 0.22, 1.25, 16)), C.club, 0, -0.85);
  add(g, geo('club-tip', () => new CylinderGeometry(0.22, 0.2, 0.08, 16)), C.club, 0, -1.5);
  return g;
}

/** 鐵錘：握把往 -Y 延伸，錘頭橫向（沿 Z）；錘頭放在 userData.head 供蓄力放大。 */
export function buildHammer(): Group {
  const g = new Group();
  const C = WEAPON_COLORS;
  add(g, geo('ham-handle', () => new CylinderGeometry(0.1, 0.1, 1.5, 12)), C.hammerHandle, 0, -0.65);
  const head = new Group();
  head.position.y = -1.45;
  g.add(head);
  const h = new Mesh(cachedRoundedBox(0.56, 0.56, 1.0, 0.12), plastic(C.hammerHead));
  h.castShadow = true;
  head.add(h);
  g.userData.head = head;
  return g;
}

let bucketMat: MeshStandardMaterial | null = null;
/** 水桶：開口朝 +Y，桶身略寬口；提把是半圈。 */
export function buildBucket(): Group {
  const g = new Group();
  const C = WEAPON_COLORS;
  bucketMat ??= new MeshStandardMaterial({ color: srgb(C.bucket), roughness: 0.32, metalness: 0, side: DoubleSide });
  add(g, geo('bucket-body', () => new CylinderGeometry(0.56, 0.44, 0.82, 22, 1, true)), bucketMat);
  add(g, geo('bucket-bottom', () => new CylinderGeometry(0.44, 0.44, 0.04, 22)), C.bucket, 0, -0.39);
  const rim = add(g, geo('bucket-rim', () => new TorusGeometry(0.56, 0.045, 8, 26)), C.bucketRim, 0, 0.41);
  rim.rotation.x = Math.PI / 2;
  const handle = add(g, geo('bucket-handle', () => new TorusGeometry(0.5, 0.03, 6, 20, Math.PI)), '#4A4A55', 0, 0.42);
  handle.castShadow = false;
  return g;
}

/** 椅子（玩具木椅）：中心在座面。 */
export function buildChair(): Group {
  const g = new Group();
  const C = WEAPON_COLORS;
  add(g, cachedRoundedBox(1.2, 0.18, 1.1, 0.06), C.wood);
  const leg = geo('chair-leg', () => new BoxGeometry(0.15, 1.0, 0.15));
  for (const x of [-0.48, 0.48]) for (const z of [-0.42, 0.42]) add(g, leg, C.woodDark, x, -0.55, z);
  add(g, cachedRoundedBox(1.2, 1.05, 0.16, 0.06), C.wood, 0, 0.6, -0.48);
  return g;
}

/** 碎裂後的泡棉塊（一律小小軟軟的方塊）。 */
export function buildFoam(i: number): Mesh {
  const C = WEAPON_COLORS.foam;
  const s = 0.22 + (i % 3) * 0.08;
  const m = new Mesh(cachedRoundedBox(s, s * 0.8, s, s * 0.25), plastic(C[i % C.length]));
  m.castShadow = true;
  return m;
}
