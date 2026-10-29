import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from 'three';
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
  const uv = g.attributes.uv;
  const size = [w, h, d];
  // 每一面內的 u、v 對應哪一軸（BoxGeometry 面順序 +X、−X、+Y、−Y、+Z、−Z）
  const AX: [number, number][] = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];
  const per = pos.count / 6;
  const p0 = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p0.fromBufferAttribute(pos, i);
    p.set(warp(pos.getX(i), w / 2), warp(pos.getY(i), h / 2), warp(pos.getZ(i), d / 2));
    c.set(cl(p.x, hw), cl(p.y, hh), cl(p.z, hd));
    n.subVectors(p, c);
    if (n.lengthSq() < 1e-10) n.fromBufferAttribute(nor, i);
    else n.normalize();
    p.copy(c).addScaledVector(n, r);
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
    // UV 依最終位置線性分配：平面佔大部分貼圖，靠邊作畫不會被壓到圓角上
    const [au, av] = AX[Math.min(5, Math.floor(i / per))];
    const remap = (old: number, axis: number) => {
      const o = p0.getComponent(axis) / size[axis];
      const dir = Math.abs(o) < 1e-6 ? 1 : Math.sign((old - 0.5) * o) || 1;
      return 0.5 + dir * (p.getComponent(axis) / size[axis]);
    };
    uv.setXY(i, remap(uv.getX(i), au), remap(uv.getY(i), av));
  }
  uv.needsUpdate = true;
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

/**
 * 可彩繪的圓角圓柱（積木人的頭）：側面依方向分成四格（正面 +Z、右 +X、背面 −Z、左 −X），
 * 頂面、底面各一格，沿用方塊的 3×2 圖集。上下邊緣是圓角。
 * 四段側面各自有頂點，接縫處不會把相鄰格的貼圖混在一起。
 */
export function roundedCylinderAtlas(R: number, H: number, r: number, arcSeg = 10, filletSeg = 4, straightSeg = 4, capRings = 3): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const half = H / 2;
  // 側面輪廓：從底部圓角內緣，經直立段，到頂部圓角內緣
  const profile: { rho: number; y: number; nr: number; ny: number }[] = [];
  for (let i = 0; i <= filletSeg; i++) {
    const a = -Math.PI / 2 + (i / filletSeg) * (Math.PI / 2);
    profile.push({ rho: R - r + Math.cos(a) * r, y: -half + r + Math.sin(a) * r, nr: Math.cos(a), ny: Math.sin(a) });
  }
  for (let i = 1; i < straightSeg; i++) profile.push({ rho: R, y: -half + r + (i / straightSeg) * (H - 2 * r), nr: 1, ny: 0 });
  for (let i = 0; i <= filletSeg; i++) {
    const a = (i / filletSeg) * (Math.PI / 2);
    profile.push({ rho: R - r + Math.cos(a) * r, y: half - r + Math.sin(a) * r, nr: Math.cos(a), ny: Math.sin(a) });
  }
  // 側面四格：θ 從 +Z 往 +X 量
  const SIDES: [number, number][] = [[4, -Math.PI / 4], [0, Math.PI / 4], [5, (3 * Math.PI) / 4], [1, (5 * Math.PI) / 4]];
  for (const [face, start] of SIDES) {
    const base = pos.length / 3;
    for (let j = 0; j < profile.length; j++) {
      const p = profile[j];
      for (let i = 0; i <= arcSeg; i++) {
        const t = i / arcSeg;
        const th = start + t * (Math.PI / 2);
        const sx = Math.sin(th);
        const cz = Math.cos(th);
        pos.push(p.rho * sx, p.y, p.rho * cz);
        nor.push(p.nr * sx, p.ny, p.nr * cz);
        const [u, v] = atlasUV(face, t, (p.y + half) / H);
        uv.push(u, v);
      }
    }
    const row = arcSeg + 1;
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < arcSeg; i++) {
        const a = base + j * row + i;
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
      }
  }
  // 頂面、底面：圓盤，平面對應到該格
  const ring = 4 * arcSeg;
  for (const top of [true, false]) {
    const face = top ? 2 : 3;
    const y = top ? half : -half;
    const ny = top ? 1 : -1;
    const center = pos.length / 3;
    pos.push(0, y, 0);
    nor.push(0, ny, 0);
    uv.push(...atlasUV(face, 0.5, 0.5));
    for (let k = 1; k <= capRings; k++) {
      const rr = ((R - r) * k) / capRings;
      for (let i = 0; i < ring; i++) {
        const th = (i / ring) * Math.PI * 2;
        const x = rr * Math.sin(th);
        const z = rr * Math.cos(th);
        pos.push(x, y, z);
        nor.push(0, ny, 0);
        const a = (x + R) / (2 * R);
        const b = top ? (R - z) / (2 * R) : (z + R) / (2 * R);
        uv.push(...atlasUV(face, a, b));
      }
    }
    for (let k = 0; k < capRings; k++)
      for (let i = 0; i < ring; i++) {
        const i2 = (i + 1) % ring;
        if (k === 0) {
          const a = center + 1 + i;
          const b = center + 1 + i2;
          if (top) idx.push(center, a, b);
          else idx.push(center, b, a);
        } else {
          const inner = center + 1 + (k - 1) * ring;
          const outer = center + 1 + k * ring;
          const q = [inner + i, outer + i, outer + i2, inner + i2];
          if (top) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
          else idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
        }
      }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
