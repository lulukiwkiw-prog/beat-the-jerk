import { BoxGeometry, BufferGeometry, CylinderGeometry, Vector3 } from 'three';
import { atlasUV } from '../puppet/faces';

const SEG = 8;

/**
 * 圓角方塊：把方塊格點往邊緣集中，再推到圓角上，做出塑膠玩具的圓潤邊。
 * 保留 BoxGeometry 的面群組順序（+X、−X、+Y、−Y、+Z、−Z）與每面的 UV 格點。
 */
export function roundedBox(w: number, h: number, d: number, r: number, seg = SEG): BoxGeometry {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const g = new BoxGeometry(w, h, d, seg, seg, seg);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const warp = (x: number, a: number) => {
    const t = Math.abs(x) / a;
    const hi = a - r;
    return Math.sign(x) * (t <= 0.4 ? (hi * t) / 0.4 : hi + (r * (t - 0.4)) / 0.6);
  };
  const p = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const hd = d / 2 - r;
  const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  for (let i = 0; i < pos.count; i++) {
    p.set(warp(pos.getX(i), w / 2), warp(pos.getY(i), h / 2), warp(pos.getZ(i), d / 2));
    c.set(cl(p.x, hw), cl(p.y, hh), cl(p.z, hd));
    n.subVectors(p, c);
    if (n.lengthSq() < 1e-10) n.fromBufferAttribute(nor, i);
    else n.normalize();
    p.copy(c).addScaledVector(n, r);
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return g;
}

/**
 * 可彩繪的圓角方塊：重新對應 UV，讓每一面只取用 3×2 圖集中自己那一格。
 */
export function atlasBox(w: number, h: number, d: number, r: number): BoxGeometry {
  const g = roundedBox(w, h, d, r);
  const uv = g.attributes.uv;
  // BoxGeometry 依面群組依序建立頂點，用群組範圍找到每個頂點屬於哪一面
  for (let f = 0; f < g.groups.length; f++) {
    const grp = g.groups[f];
    const idx = g.index!;
    const seen = new Set<number>();
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const v = idx.getX(i);
      if (seen.has(v)) continue;
      seen.add(v);
      const [u2, v2] = atlasUV(f, uv.getX(v), uv.getY(v));
      uv.setXY(v, u2, v2);
    }
  }
  uv.needsUpdate = true;
  return g;
}

const cache = new Map<string, BufferGeometry>();
/** 依尺寸快取圓角方塊幾何，同尺寸共用。 */
export function cachedRoundedBox(w: number, h: number, d: number, r: number): BufferGeometry {
  const key = [w, h, d, r].map((x) => x.toFixed(3)).join(',');
  let g = cache.get(key);
  if (!g) {
    g = roundedBox(w, h, d, r);
    cache.set(key, g);
  }
  return g;
}

/** 積木凸點（共用幾何）。 */
export const STUD_RADIUS = 0.13;
export const STUD_HEIGHT = 0.11;
let studGeo: CylinderGeometry | null = null;
export function studGeometry(): CylinderGeometry {
  if (!studGeo) studGeo = new CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 18);
  return studGeo;
}
