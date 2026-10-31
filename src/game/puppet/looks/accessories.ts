import {
  BufferGeometry, CanvasTexture, CircleGeometry, SRGBColorSpace, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry,
} from 'three';
import { plastic, srgb } from '../../three/color';
import { cachedRoundedBox } from '../../three/geometry';
import { atlasUV } from '../faces';
import { DESIGN_SIZES, PART_DEFS, type FixedPartId, type PaintPartId } from '../parts';

/**
 * 3D 凸出配件：掛在積木人的部位 mesh 底下，所以會跟著部位移動、壓扁與噴飛。
 * 座標以該部位 mesh 的中心為原點（頭：寬 1.22、高 1.1、深 1.1；軀幹：1.7 × 1.5 × 1.0）。
 */
export type AccessoryId =
  | 'pigHead' | 'teruteru' | 'chickenHead' | 'dinoHead'
  | 'longHair' | 'shortHair' | 'ponytail' | 'swoop' | 'slick' | 'buzz' | 'perm' | 'afro'
  | 'chickenSuit' | 'longDress' | 'shortDress' | 'pigBody' | 'dinoSuit'
  | 'roundGlasses' | 'sunglasses' | 'partyGlasses'
  | 'redTie' | 'bowTie' | 'stripeTie'
  | 'topHat' | 'cap' | 'partyHat';

export type AccessorySlot = 'face' | 'hair' | 'costume' | 'glasses' | 'tie' | 'hat';
/** 每一類最多戴一個 */
export const ACCESSORY_SLOTS: AccessorySlot[] = ['face', 'hair', 'costume', 'glasses', 'tie', 'hat'];
export type AttachPart = PaintPartId | FixedPartId;

export interface Attachment {
  part: AttachPart;
  object: Object3D;
}

const geoCache = new Map<string, BufferGeometry>();
function geo<T extends BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const doubleCache = new Map<string, MeshStandardMaterial>();
/** 開口的裙子、布要雙面 */
function cloth(hex: string) {
  let m = doubleCache.get(hex);
  if (!m) {
    m = new MeshStandardMaterial({ color: srgb(hex), roughness: 0.45, metalness: 0, side: DoubleSide });
    doubleCache.set(hex, m);
  }
  return m;
}

function box(w: number, h: number, d: number, r: number, color: string, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) {
  const m = new Mesh(cachedRoundedBox(w, h, d, r), plastic(color));
  m.position.set(x, y, z);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}

function cone(r: number, h: number, color: string, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) {
  const m = new Mesh(geo(`cone${r},${h}`, () => new ConeGeometry(r, h, 12)), plastic(color));
  m.position.set(x, y, z);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}

const group = (...children: Object3D[]) => {
  const g = new Group();
  children.forEach((c) => g.add(c));
  return g;
};

const HEAD = { top: 0.55, front: 0.55, back: -0.55, side: 0.61 };
const TORSO = { bottom: -0.75, top: 0.75, back: -0.5, front: 0.5, side: 0.85 };

function ball(r: number, color: string, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1]) {
  const m = new Mesh(geo('ball', () => new SphereGeometry(1, 24, 16)), plastic(color));
  m.scale.set(r * scale[0], r * scale[1], r * scale[2]);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** 晴天娃娃的布（頭部設計座標）：上緣接球頭、下緣剛好蓋過軀幹頂與肩膀 */
const TERU_CLOTH = { topY: -0.53, bottomY: -0.84, topR: 0.66, bottomR: 1.1, waves: 9, waveY: 0.035, waveR: 0.04 } as const;
function teruClothGeometry() {
  const C = TERU_CLOTH;
  const g = new CylinderGeometry(C.topR, C.bottomR, C.topY - C.bottomY, 72, 1, true);
  g.translate(0, (C.topY + C.bottomY) / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - C.bottomY) > 1e-4) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const th = Math.atan2(x, z);
    const w = Math.sin(th * C.waves);
    const k = 1 + C.waveR * w;
    pos.setXYZ(i, x * k, C.bottomY + C.waveY * w, z * k);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

let teruMat: MeshStandardMaterial | null = null;
/** 晴天娃娃的臉：畫在球面貼圖正面（u＝0.25 是 +Z） */
function teruFaceMaterial() {
  if (teruMat) return teruMat;
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext('2d');
  if (!c) {
    teruMat = new MeshStandardMaterial({ color: srgb('#FFFFFF'), roughness: 0.45, metalness: 0 });
    return teruMat;
  }
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, 512, 256);
  const cx = 128;
  c.fillStyle = '#1E1E1E';
  for (const dx of [-22, 22]) {
    c.beginPath();
    c.arc(cx + dx, 112, 7, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = '#1E1E1E';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, 128, 18, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  c.fillStyle = 'rgba(244,143,177,.75)';
  for (const dx of [-40, 40]) {
    c.beginPath();
    c.ellipse(cx + dx, 136, 10, 7, 0, 0, Math.PI * 2);
    c.fill();
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  teruMat = new MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0 });
  return teruMat;
}

/** 貼著圓頭頂的髮蓋（扁圓頂），h 為厚度 */
function dome(color: string, h: number) {
  return ball(1, color, 0, HEAD.top - 0.04, -0.02, [0.64, h, 0.6]);
}

/**
 * 立體肚子：貼在軀幹正面的扁橢圓。UV 投影到軀幹正面那一格，
 * 所以肚子會顯示、也能畫上軀幹正面的彩繪（積木人會把它換成軀幹的材質）。
 */
export const BELLY = { cx: 0, cy: -0.05, rx: 0.6, ry: 0.6, rz: 0.2 } as const;
function belly() {
  const g = geo('bellyPaint', () => {
    const sg = new SphereGeometry(1, 32, 20);
    const pos = sg.attributes.position;
    const uv = sg.attributes.uv;
    const [w, h] = DESIGN_SIZES.torso;
    for (let i = 0; i < pos.count; i++) {
      const x = BELLY.cx + pos.getX(i) * BELLY.rx;
      const y = BELLY.cy + pos.getY(i) * BELLY.ry;
      const [u, v] = atlasUV(4, x / w + 0.5, y / h + 0.5);
      uv.setXY(i, u, v);
    }
    return sg;
  });
  const m = new Mesh(g, plastic('#FFFFFF'));
  m.scale.set(BELLY.rx, BELLY.ry, BELLY.rz);
  m.position.set(BELLY.cx, BELLY.cy, TORSO.front - 0.04);
  m.castShadow = true;
  m.userData.paintPart = 'torso';
  return m;
}

/** 爪子／腳趾：一排小圓錐 */
function claws(color: string, n: number, spread: number, y: number, z: number, len: number, rot: [number, number, number]) {
  return group(...Array.from({ length: n }, (_, i) => cone(0.06, len, color, (i - (n - 1) / 2) * spread, y, z, rot)));
}


/** 眼睛高度（頭部設計座標）、鏡框 */
const EYE_Y = 0.06;
function frameRing(r: number, color: string, x: number) {
  const m = new Mesh(geo(`ring${r}`, () => new TorusGeometry(r, 0.035, 10, 28)), plastic(color));
  m.position.set(x, EYE_Y, HEAD.front + 0.05);
  m.castShadow = true;
  return m;
}
/** 眼鏡腳：從鏡框兩側往後到耳朵 */
const temples = (color: string, y = EYE_Y) => [-1, 1].map((sx) => box(0.05, 0.05, 0.62, 0.02, color, sx * 0.6, y, HEAD.front - 0.26));
/** 領帶從領口往下（軀幹設計座標） */
const TIE_TOP = TORSO.top - 0.06;
function tieBody(color: string, stripes?: string) {
  const knot = box(0.2, 0.16, 0.08, 0.04, color, 0, TIE_TOP - 0.06, TORSO.front + 0.04);
  const blade = box(0.24, 0.92, 0.04, 0.03, color, 0, TIE_TOP - 0.62, TORSO.front + 0.03);
  const tip = cone(0.17, 0.22, color, 0, TIE_TOP - 1.16, TORSO.front + 0.03, [Math.PI, Math.PI / 4, 0]);
  tip.scale.set(1, 1, 0.25);
  const parts: Object3D[] = [knot, blade, tip];
  if (stripes) for (let i = 0; i < 4; i++) parts.push(box(0.25, 0.06, 0.045, 0.01, stripes, 0, TIE_TOP - 0.32 - i * 0.2, TORSO.front + 0.035, [0, 0, 0.5]));
  return group(...parts);
}

const BUILDERS: Record<AccessoryId, () => Attachment[]> = {
  roundGlasses: () => {
    const C = '#2B2B33';
    const bridge = box(0.14, 0.04, 0.04, 0.015, C, 0, EYE_Y + 0.04, HEAD.front + 0.05);
    return [{ part: 'head', object: group(frameRing(0.17, C, -0.23), frameRing(0.17, C, 0.23), bridge, ...temples(C)) }];
  },
  sunglasses: () => {
    const lens = (x: number) => box(0.36, 0.22, 0.05, 0.08, '#1A1A22', x, EYE_Y, HEAD.front + 0.05);
    const bar = box(0.86, 0.06, 0.05, 0.02, '#1A1A22', 0, EYE_Y + 0.1, HEAD.front + 0.05);
    const shine = box(0.1, 0.04, 0.01, 0.01, '#9FB4D0', -0.3, EYE_Y + 0.05, HEAD.front + 0.08, [0, 0, 0.6]);
    return [{ part: 'head', object: group(lens(-0.22), lens(0.22), bar, shine, ...temples('#1A1A22')) }];
  },
  partyGlasses: () => {
    // 派對大眼鏡：粉紅寬框、黃色鏡片，上面兩顆小星星
    const frame = (x: number) => group(box(0.42, 0.32, 0.05, 0.1, '#FF5FA2', x, EYE_Y, HEAD.front + 0.05), box(0.3, 0.2, 0.02, 0.06, '#FFE680', x, EYE_Y, HEAD.front + 0.085));
    const stars = [-1, 1].map((sx) => cone(0.08, 0.18, '#FFC63A', sx * 0.38, EYE_Y + 0.3, HEAD.front + 0.06));
    return [{ part: 'head', object: group(frame(-0.24), frame(0.24), ...stars, ...temples('#FF5FA2')) }];
  },
  redTie: () => [{ part: 'torso', object: tieBody('#D8322A') }],
  stripeTie: () => [{ part: 'torso', object: tieBody('#2F5DA8', '#FFC63A') }],
  bowTie: () => {
    const C = '#7E3FB2';
    const wing = (sx: number) => {
      const c = cone(0.17, 0.32, C, sx * 0.17, TIE_TOP - 0.1, TORSO.front + 0.06, [0, 0, sx * Math.PI / 2]);
      c.scale.set(1, 1, 0.45);
      return c;
    };
    const knot = ball(0.08, '#5E2A8A', 0, TIE_TOP - 0.1, TORSO.front + 0.08);
    return [{ part: 'torso', object: group(wing(-1), wing(1), knot) }];
  },
  topHat: () => {
    const brim = new Mesh(geo('hatBrim', () => new CylinderGeometry(0.8, 0.8, 0.06, 32)), plastic('#1E1E24'));
    brim.position.y = HEAD.top + 0.05;
    const crown = new Mesh(geo('hatCrown', () => new CylinderGeometry(0.5, 0.52, 0.72, 32)), plastic('#1E1E24'));
    crown.position.y = HEAD.top + 0.42;
    const band = new Mesh(geo('hatBand', () => new CylinderGeometry(0.53, 0.53, 0.12, 32)), plastic('#D8322A'));
    band.position.y = HEAD.top + 0.15;
    return [{ part: 'head', object: group(brim, crown, band) }];
  },
  cap: () => {
    const dome = new Mesh(geo('capDome', () => new SphereGeometry(0.66, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), plastic('#2F8F5B'));
    dome.position.y = HEAD.top - 0.04;
    dome.scale.set(1, 0.62, 1);
    const bill = box(0.9, 0.05, 0.5, 0.04, '#2F8F5B', 0, HEAD.top, HEAD.front + 0.18);
    const button = ball(0.07, '#FFFFFF', 0, HEAD.top + 0.38, 0);
    return [{ part: 'head', object: group(dome, bill, button) }];
  },
  partyHat: () => {
    const body = new Mesh(geo('partyCone', () => new ConeGeometry(0.36, 0.9, 24)), plastic('#4FB3FF'));
    body.position.set(0.1, HEAD.top + 0.45, 0);
    body.rotation.z = -0.15;
    const dots = [0.25, 0.5].map((y, i) => ball(0.06, i ? '#FF5FA2' : '#FFC63A', 0.1 - y * 0.12 + 0.02, HEAD.top + y, 0.3 - y * 0.25));
    const pom = ball(0.11, '#FFC63A', 0.24, HEAD.top + 0.92, 0);
    return [{ part: 'head', object: group(body, ...dots, pom) }];
  },
  pigHead: () => {
    const PINK = '#EE8FA6';
    // 大豬鼻：朝前的圓柱＋兩個鼻孔
    const snout = new Mesh(geo('pigSnout', () => new CylinderGeometry(0.27, 0.29, 0.26, 24)), plastic(PINK));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.1, HEAD.front + 0.1);
    snout.castShadow = true;
    for (const x of [-0.1, 0.1]) {
      const n = new Mesh(geo('nostril', () => new CylinderGeometry(0.05, 0.05, 0.04, 12)), plastic('#8E4A5A'));
      n.position.set(x, 0.12, 0);
      snout.add(n);
    }
    // 往前垂的耳朵
    const ears = [-1, 1].map((sx) => cone(0.2, 0.42, PINK, sx * 0.4, HEAD.top + 0.12, 0.08, [0.5, 0, sx * -0.5]));
    return [{ part: 'head', object: group(snout, ...ears) }];
  },
  teruteru: () => {
    // 圓球頭：包住圓柱頭，臉畫在球的正面；抵銷頭部的上下縮放，維持正圓
    const [dw, dh, dd] = DESIGN_SIZES.head;
    const [w, h] = PART_DEFS.head.size;
    const keep = w / ((dw + dd) / 2) / (h / dh);
    const head = new Mesh(geo('teruBall', () => new SphereGeometry(0.82, 40, 24)), teruFaceMaterial());
    head.position.y = 0.04;
    head.scale.set(1, keep, 1);
    head.castShadow = true;
    // 短短的圓錐布、波浪邊：從球頭下方往外斜，剛好蓋住肩膀上緣，布面都在軀幹外側
    const skirt = new Mesh(geo('teruCloth', () => teruClothGeometry()), cloth('#FFFFFF'));
    skirt.castShadow = true;
    const ribbon = new Mesh(geo('teruRibbon3', () => new TorusGeometry(0.66, 0.045, 8, 40)), plastic('#E53935'));
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = TERU_CLOTH.topY + 0.01;
    return [{ part: 'head', object: group(head, skirt, ribbon) }];
  },
  chickenHead: () => {
    const RED = '#E8452C';
    const Y = '#FFD23F';
    // 圓頭：頭頂加一個圓頂
    const dome = ball(1, Y, 0, HEAD.top - 0.12, -0.02, [0.62, 0.42, 0.56]);
    // 凸出來的大白眼珠，眼珠往上看
    const eyes = [-1, 1].map((sx) => {
      const e = ball(0.2, '#FFFFFF', sx * 0.3, 0.2, HEAD.front + 0.02);
      const pupil = ball(0.075, '#1E1E1E', sx * 0.02, 0.09, 0.17);
      e.add(pupil);
      pupil.scale.multiplyScalar(1 / 0.2);
      pupil.position.multiplyScalar(1 / 0.2);
      return e;
    });
    // 張到最大的嘴：朝前的橘色喇叭管＋深色嘴裡
    const beak = new Mesh(geo('chickBeak', () => new CylinderGeometry(0.3, 0.22, 0.42, 24, 1, true)), cloth('#F57C00'));
    beak.rotation.x = Math.PI / 2;
    beak.scale.set(0.9, 1, 1.35);
    beak.position.set(0, -0.22, HEAD.front + 0.2);
    const throat = new Mesh(geo('chickThroat', () => new CircleGeometry(0.22, 24)), plastic('#5A1414'));
    throat.scale.set(0.9, 1.35, 1);
    throat.position.set(0, -0.22, HEAD.front + 0.01);
    const comb = [
      box(0.32, 0.6, 0.46, 0.15, RED, 0.04, HEAD.top + 0.4, -0.06, [-0.3, 0, -0.12]),
      box(0.28, 0.42, 0.34, 0.13, RED, -0.06, HEAD.top + 0.3, 0.22, [-0.1, 0, 0.18]),
    ];
    const wattle = [-1, 1].map((sx) => ball(0.13, RED, sx * 0.11, -HEAD.top + 0.02, HEAD.front + 0.12, [1, 1.3, 0.8]));
    return [{ part: 'head', object: group(dome, ...eyes, beak, throat, ...comb, ...wattle) }];
  },
  dinoHead: () => {
    const G = '#5FAE4E';
    // 往前伸出的長嘴，下緣一排牙齒
    const snout = box(1.0, 0.5, 0.75, 0.16, G, 0, -0.22, HEAD.front + 0.3);
    const teeth = claws('#FFFFFF', 6, 0.15, -0.47, HEAD.front + 0.6, 0.14, [Math.PI, 0, 0]);
    const nostrils = [-0.18, 0.18].map((x) => ball(0.05, '#2E5A26', x, 0.03, HEAD.front + 0.66));
    const spikes = [0.3, 0.02, -0.26, -0.52].map((z, i) => cone(0.17, 0.42 - i * 0.04, '#F28C28', 0, HEAD.top + 0.18, z, [-0.25, 0, 0]));
    const brow = [-1, 1].map((sx) => box(0.32, 0.1, 0.14, 0.04, '#4E9A40', sx * 0.33, 0.32, HEAD.front + 0.03, [0, 0, sx * 0.25]));
    return [{ part: 'head', object: group(snout, teeth, ...nostrils, ...spikes, ...brow) }];
  },
  longHair: () => {
    const C = '#5A3A22';
    const cap = dome(C, 0.26);
    // 包住後腦、垂到肩下的半圈長髮
    const back = new Mesh(geo('longHairShell', () => new CylinderGeometry(0.62, 0.7, 1.9, 24, 1, true, Math.PI / 2, Math.PI)), cloth(C));
    back.position.y = -0.38;
    back.castShadow = true;
    const locks = [-1, 1].map((sx) => box(0.16, 1.2, 0.36, 0.07, C, sx * 0.6, -0.2, 0.2));
    return [{ part: 'head', object: group(cap, back, ...locks) }];
  },
  shortHair: () => {
    const C = '#2B2B33';
    const fringe = box(1.0, 0.18, 0.16, 0.07, C, 0, HEAD.top - 0.1, HEAD.front - 0.02);
    return [{ part: 'head', object: group(dome(C, 0.26), fringe) }];
  },
  ponytail: () => {
    const C = '#5A3A22';
    const tie = box(0.3, 0.2, 0.18, 0.06, '#E53935', 0, 0.3, HEAD.back - 0.1);
    const tail = box(0.34, 1.0, 0.3, 0.14, C, 0, -0.2, HEAD.back - 0.32, [0.45, 0, 0]);
    return [{ part: 'head', object: group(dome(C, 0.24), tie, tail) }];
  },
  swoop: () => {
    const C = '#F2C14E';
    const puff = ball(1, C, 0.05, HEAD.top + 0.08, -0.02, [0.7, 0.36, 0.66]);
    const flap = box(1.1, 0.26, 0.46, 0.12, '#F5CD64', 0.1, HEAD.top + 0.04, HEAD.front - 0.02, [0.55, 0, -0.08]);
    return [{ part: 'head', object: group(puff, flap) }];
  },
  slick: () => {
    const C = '#1E1E1E';
    const right = ball(1, C, 0.12, HEAD.top + 0.04, -0.02, [0.55, 0.24, 0.6]);
    return [{ part: 'head', object: group(dome(C, 0.16), right) }];
  },
  buzz: () => [{ part: 'head', object: dome('#3A3A40', 0.12) }],
  // 米粉頭：燙得很捲的小捲，整顆頭布滿一顆顆小圓捲
  perm: () => {
    const C = '#2A2422';
    const curls: Mesh[] = [];
    const rings = [
      { y: 0.66, r: 0.08, n: 1 },
      { y: 0.62, r: 0.26, n: 8 },
      { y: 0.52, r: 0.44, n: 13 },
      { y: 0.36, r: 0.58, n: 17 },
      { y: 0.16, r: 0.63, n: 19 },
      { y: -0.04, r: 0.64, n: 19, back: true },
      { y: -0.22, r: 0.6, n: 17, back: true },
    ];
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.n; i++) {
        const th = ((i + (ri % 2) * 0.5) / ring.n) * Math.PI * 2;
        const x = Math.sin(th) * ring.r;
        const z = Math.cos(th) * ring.r;
        // 臉的正面下半部不長捲髮
        if (ring.back && z > 0.1) continue;
        curls.push(ball(0.12, C, x, ring.y, z * 0.95));
      }
    });
    return [{ part: 'head', object: group(...curls) }];
  },
  // 爆炸頭：一大團圓蓬蓬的捲髮，表面一顆顆凸起
  afro: () => {
    // 爆炸頭：一大團圓蓬蓬的捲髮，往上、往後長，臉露出來
    const C = '#3B2A22';
    const cy = 0.62;
    const cz = -0.4;
    const big = ball(0.92, C, 0, cy, cz, [1.05, 0.92, 0.95]);
    const bumps: Mesh[] = [];
    for (let i = 0; i < 52; i++) {
      // 黃金角均勻散在球面上；臉前方（前側、眉毛以下）不放
      const yy = 1 - ((i + 0.5) / 52) * 1.7;
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = i * 2.39996;
      const x = Math.sin(th) * rr;
      const z = Math.cos(th) * rr;
      const py = cy + yy * 0.84;
      const pz = cz + z * 0.87;
      if (pz > 0.25 && py < 0.95) continue;
      bumps.push(ball(0.2, C, x * 0.96, py, pz));
    }
    return [{ part: 'head', object: group(big, ...bumps) }];
  },
  chickenSuit: () => {
    const Y = '#FFD23F';
    const tail = [-0.5, 0, 0.5].map((r, i) => box(0.26, 0.8 - Math.abs(r) * 0.3, 0.14, 0.08, i === 1 ? '#FFE680' : Y, r * 0.5, TORSO.bottom + 0.3, TORSO.back - 0.18, [-0.9, 0, r]));
    // 手臂變翅膀：外側大片羽毛，手掌換成羽毛尖
    const wing = (sx: number) => group(box(0.14, 0.86, 0.56, 0.06, Y, sx * 0.3, -0.05, 0, [0, 0, sx * 0.12]));
    const tips = (sx: number) => group(...[-0.14, 0, 0.14].map((z, i) => box(0.12, 0.42 - i * 0.04, 0.12, 0.05, i === 1 ? '#FFE680' : Y, sx * 0.05, -0.12, z, [z * 1.5, 0, sx * 0.1])));
    const feet = (['shoeL', 'shoeR'] as const).map((p) => ({ part: p, object: claws('#FB8C00', 3, 0.24, -0.08, 0.6, 0.5, [Math.PI / 2, 0, 0]) }));
    return [
      { part: 'torso', object: group(belly(), ...tail) },
      { part: 'upperArmL', object: wing(-1) }, { part: 'upperArmR', object: wing(1) },
      { part: 'foreArmL', object: wing(-1) }, { part: 'foreArmR', object: wing(1) },
      { part: 'handL', object: tips(-1) }, { part: 'handR', object: tips(1) },
      ...feet,
    ];
  },
  longDress: () => {
    const skirt = new Mesh(geo('longSkirt', () => new CylinderGeometry(0.94, 1.3, 1.7, 24, 1, true)), cloth('#C2185B'));
    skirt.position.y = TORSO.bottom - 0.82;
    skirt.castShadow = true;
    const hem = new Mesh(geo('longHem', () => new TorusGeometry(1.3, 0.05, 8, 32)), plastic('#FFC63A'));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = TORSO.bottom - 1.65;
    return [{ part: 'torso', object: group(skirt, hem) }];
  },
  shortDress: () => {
    const skirt = new Mesh(geo('shortSkirt', () => new CylinderGeometry(0.94, 1.18, 0.75, 24, 1, true)), cloth('#4FC3F7'));
    skirt.position.y = TORSO.bottom - 0.3;
    skirt.castShadow = true;
    const hem = new Mesh(geo('shortHem', () => new TorusGeometry(1.18, 0.045, 8, 32)), plastic('#FFFFFF'));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = TORSO.bottom - 0.66;
    return [{ part: 'torso', object: group(skirt, hem) }];
  },
  pigBody: () => {
    const tail = new Mesh(geo('pigTail', () => new TorusGeometry(0.18, 0.06, 8, 20, Math.PI * 1.6)), plastic('#EE8FA6'));
    tail.position.set(0.28, TORSO.bottom + 0.4, TORSO.back - 0.14);
    tail.rotation.set(0, 0.9, 0.4);
    // 豬蹄：手和鞋都換成深粉紅蹄子
    const HOOF = '#9C5466';
    const hoofHand = () => group(box(0.56, 0.3, 0.58, 0.12, HOOF, 0, -0.12, 0), box(0.04, 0.3, 0.6, 0.01, '#5A2E38', 0, -0.12, 0));
    const hoofFoot = () => group(box(0.8, 0.32, 1.12, 0.12, HOOF, 0, 0.02, 0), box(0.04, 0.33, 0.5, 0.01, '#5A2E38', 0, 0.02, 0.32));
    return [
      { part: 'torso', object: group(belly(), tail) },
      { part: 'handL', object: hoofHand() }, { part: 'handR', object: hoofHand() },
      { part: 'shoeL', object: hoofFoot() }, { part: 'shoeR', object: hoofFoot() },
    ];
  },
  dinoSuit: () => {
    const G = '#5FAE4E';
    const ORANGE = '#F28C28';
    const spikes = [0.55, 0.2, -0.15, -0.5].map((y) => cone(0.22, 0.5, ORANGE, 0, y, TORSO.back - 0.18, [-Math.PI / 2, 0, 0]));
    // 粗尾巴往側後方甩出來，從正面也看得到；尾巴上也有刺
    const seg = (w: number, x: number, y: number, z: number, ry: number) => {
      const b = box(w, w * 0.8, w * 1.2, w * 0.3, G, x, y, z, [0.35, ry, 0]);
      b.add(cone(w * 0.28, w * 0.6, ORANGE, 0, w * 0.5, 0, [0, 0, 0]));
      return b;
    };
    const tail = group(
      seg(0.8, 0.55, TORSO.bottom + 0.12, TORSO.back - 0.25, 0.9),
      seg(0.62, 1.2, TORSO.bottom - 0.12, TORSO.back - 0.35, 1.2),
      seg(0.46, 1.75, TORSO.bottom - 0.32, TORSO.back - 0.38, 1.4),
      seg(0.3, 2.2, TORSO.bottom - 0.48, TORSO.back - 0.36, 1.5),
    );
    const hand = () => group(box(0.54, 0.52, 0.56, 0.2, G, 0, 0, 0), claws('#FFFFFF', 3, 0.14, -0.3, 0.18, 0.2, [Math.PI * 0.85, 0, 0]));
    const foot = () => group(box(0.8, 0.3, 1.14, 0.12, G, 0, 0.02, 0), claws('#FFFFFF', 3, 0.24, -0.02, 0.62, 0.22, [Math.PI / 2, 0, 0]));
    return [
      { part: 'torso', object: group(belly(), ...spikes, tail) },
      { part: 'handL', object: hand() }, { part: 'handR', object: hand() },
      { part: 'shoeL', object: foot() }, { part: 'shoeR', object: foot() },
    ];
  },
};

export function buildAccessory(id: AccessoryId): Attachment[] {
  const list = BUILDERS[id]().map((a) => ({ part: a.part, object: group(a.object) }));
  for (const a of list) {
    // 配件以設計尺寸製作，依實際部位大小縮放
    if (a.part in DESIGN_SIZES) {
      const p = a.part as PaintPartId;
      const [dw, dh, dd] = DESIGN_SIZES[p];
      const [w, h, d] = PART_DEFS[p].size;
      if (PART_DEFS[p].shape === 'cylinder') {
        // 圓柱頭：x、z 等比，配件才不會被拉成橢圓
        const k = w / ((dw + dd) / 2);
        a.object.scale.set(k, h / dh, k);
      } else a.object.scale.set(w / dw, h / dh, d / dd);
    }
    a.object.userData.accessory = id;
    a.object.traverse((o) => {
      o.userData.accessory = id;
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }
  return list;
}

export const ACCESSORY_IDS = Object.keys(BUILDERS) as AccessoryId[];
