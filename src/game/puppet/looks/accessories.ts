import {
  BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, TorusGeometry,
} from 'three';
import { plastic, srgb } from '../../three/color';
import { cachedRoundedBox } from '../../three/geometry';
import type { FixedPartId, PaintPartId } from '../parts';

/**
 * 3D 凸出配件：掛在積木人的部位 mesh 底下，所以會跟著部位移動、壓扁與噴飛。
 * 座標以該部位 mesh 的中心為原點（頭：寬 1.22、高 1.1、深 1.1；軀幹：1.7 × 1.5 × 1.0）。
 */
export type AccessoryId =
  | 'pigHead' | 'teruteru' | 'chickenHead' | 'dinoHead'
  | 'longHair' | 'shortHair' | 'ponytail' | 'swoop' | 'slick' | 'buzz'
  | 'chickenSuit' | 'longDress' | 'shortDress' | 'pigBody' | 'dinoSuit';

export type AccessorySlot = 'face' | 'hair' | 'costume';
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

const BUILDERS: Record<AccessoryId, () => Attachment[]> = {
  pigHead: () => {
    const snout = box(0.52, 0.36, 0.22, 0.12, '#EE8FA6', 0, -0.08, HEAD.front + 0.08);
    for (const x of [-0.1, 0.1]) {
      const n = new Mesh(geo('nostril', () => new CylinderGeometry(0.045, 0.045, 0.04, 12)), plastic('#8E4A5A'));
      n.rotation.x = Math.PI / 2;
      n.position.set(x, 0, 0.11);
      snout.add(n);
    }
    const ears = [-1, 1].map((s) => box(0.34, 0.34, 0.12, 0.06, '#EE8FA6', s * 0.42, HEAD.top + 0.1, 0.05, [0.2, 0, s * -0.55]));
    return [{ part: 'head', object: group(snout, ...ears) }];
  },
  teruteru: () => {
    const skirt = new Mesh(geo('teruSkirt', () => new CylinderGeometry(0.5, 1.15, 0.95, 20, 1, true)), cloth('#FFFFFF'));
    skirt.position.y = -HEAD.top - 0.42;
    skirt.castShadow = true;
    const ribbon = new Mesh(geo('teruRibbon', () => new TorusGeometry(0.5, 0.05, 8, 24)), plastic('#E53935'));
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = -HEAD.top + 0.02;
    return [{ part: 'head', object: group(skirt, ribbon) }];
  },
  chickenHead: () => {
    const RED = '#E8452C';
    // 頭頂大雞冠：往後翹的兩片
    const comb = [
      box(0.34, 0.66, 0.46, 0.15, RED, 0.04, HEAD.top + 0.28, -0.08, [-0.3, 0, -0.12]),
      box(0.3, 0.46, 0.36, 0.13, RED, -0.06, HEAD.top + 0.18, 0.24, [-0.1, 0, 0.18]),
    ];
    // 嘴喙上下唇凸出臉外，中間是畫上去的大張嘴
    const upper = box(0.62, 0.13, 0.22, 0.06, '#F57C00', 0, 0.1, HEAD.front + 0.08, [-0.2, 0, 0]);
    const lower = box(0.5, 0.12, 0.2, 0.05, '#EF6C00', 0, -0.5, HEAD.front + 0.06, [0.25, 0, 0]);
    // 下巴雙瓣肉垂
    const wattle = [-1, 1].map((sx) => box(0.22, 0.28, 0.14, 0.09, RED, sx * 0.12, -HEAD.top - 0.04, HEAD.front + 0.06, [0.3, 0, sx * 0.35]));
    return [{ part: 'head', object: group(...comb, upper, lower, ...wattle) }];
  },
  dinoHead: () => {
    const spikes = [0.28, 0, -0.28, -0.52].map((z, i) => cone(0.13, 0.32 - i * 0.03, '#F28C28', 0, HEAD.top + 0.14, z, [-0.25, 0, 0]));
    const brow = [-1, 1].map((s) => box(0.3, 0.1, 0.12, 0.04, '#4E9A40', s * 0.33, 0.27, HEAD.front + 0.03, [0, 0, s * 0.25]));
    return [{ part: 'head', object: group(...spikes, ...brow) }];
  },
  longHair: () => {
    const C = '#5A3A22';
    const cap = box(1.34, 0.22, 1.24, 0.1, C, 0, HEAD.top + 0.08, 0);
    const back = box(1.3, 1.9, 0.2, 0.08, C, 0, -0.35, HEAD.back - 0.08);
    const locks = [-1, 1].map((s) => box(0.18, 1.55, 0.7, 0.08, C, s * (HEAD.side + 0.06), -0.25, -0.12));
    return [{ part: 'head', object: group(cap, back, ...locks) }];
  },
  shortHair: () => {
    const C = '#2B2B33';
    const cap = box(1.32, 0.24, 1.22, 0.1, C, 0, HEAD.top + 0.08, -0.02);
    const fringe = box(1.26, 0.18, 0.14, 0.06, C, 0, HEAD.top - 0.08, HEAD.front + 0.03);
    return [{ part: 'head', object: group(cap, fringe) }];
  },
  ponytail: () => {
    const C = '#5A3A22';
    const cap = box(1.32, 0.22, 1.22, 0.1, C, 0, HEAD.top + 0.07, -0.02);
    const tie = box(0.3, 0.2, 0.18, 0.06, '#E53935', 0, 0.3, HEAD.back - 0.1);
    const tail = box(0.34, 1.0, 0.3, 0.14, C, 0, -0.2, HEAD.back - 0.32, [0.45, 0, 0]);
    return [{ part: 'head', object: group(cap, tie, tail) }];
  },
  swoop: () => {
    const C = '#F2C14E';
    const puff = box(1.44, 0.4, 1.32, 0.18, C, 0.04, HEAD.top + 0.14, -0.02, [0, 0, -0.06]);
    const flap = box(1.34, 0.26, 0.46, 0.12, '#F5CD64', 0.1, HEAD.top + 0.06, HEAD.front + 0.06, [0.55, 0, -0.08]);
    const side = box(0.2, 0.5, 0.9, 0.08, C, HEAD.side + 0.05, 0.25, -0.1);
    return [{ part: 'head', object: group(puff, flap, side) }];
  },
  slick: () => {
    const C = '#1E1E1E';
    const left = box(0.5, 0.16, 1.22, 0.06, C, -0.4, HEAD.top + 0.06, -0.02);
    const right = box(0.82, 0.26, 1.24, 0.1, C, 0.22, HEAD.top + 0.1, -0.02, [0, 0, -0.04]);
    return [{ part: 'head', object: group(left, right) }];
  },
  buzz: () => [{ part: 'head', object: box(1.26, 0.14, 1.14, 0.03, '#3A3A40', 0, HEAD.top + 0.07, 0) }],
  chickenSuit: () => {
    const Y = '#FFD23F';
    const tail = [-0.5, 0, 0.5].map((r, i) => box(0.24, 0.7 - Math.abs(r) * 0.3, 0.12, 0.08, i === 1 ? '#FFE680' : Y, r * 0.5, TORSO.bottom + 0.25, TORSO.back - 0.15, [-0.9, 0, r]));
    const wings = (['upperArmL', 'upperArmR'] as const).map((p, i) => ({ part: p, object: box(0.12, 0.6, 0.5, 0.05, Y, (i ? 1 : -1) * 0.3, 0, 0, [0, 0, (i ? -1 : 1) * 0.15]) }));
    const feet = (['shoeL', 'shoeR'] as const).map((p) => ({
      part: p,
      object: group(...[-0.22, 0, 0.22].map((x) => box(0.14, 0.08, 0.34, 0.03, '#FB8C00', x, -0.1, 0.58, [0, x * 1.2, 0]))),
    }));
    return [{ part: 'torso', object: group(...tail) }, ...wings, ...feet];
  },
  longDress: () => {
    const skirt = new Mesh(geo('longSkirt', () => new CylinderGeometry(0.94, 1.3, 1.95, 24, 1, true)), cloth('#C2185B'));
    skirt.position.y = TORSO.bottom - 0.9;
    skirt.castShadow = true;
    const hem = new Mesh(geo('longHem', () => new TorusGeometry(1.3, 0.05, 8, 32)), plastic('#FFC63A'));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = TORSO.bottom - 1.87;
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
    const tail = new Mesh(geo('pigTail', () => new TorusGeometry(0.16, 0.05, 8, 20, Math.PI * 1.6)), plastic('#EE8FA6'));
    tail.position.set(0.25, TORSO.bottom + 0.35, TORSO.back - 0.12);
    tail.rotation.set(0, 0.9, 0.4);
    return [{ part: 'torso', object: tail }];
  },
  dinoSuit: () => {
    const G = '#6BBF59';
    const spikes = [0.5, 0.15, -0.2, -0.55].map((y) => cone(0.16, 0.36, '#F28C28', 0, y, TORSO.back - 0.12, [-Math.PI / 2, 0, 0]));
    const tail = group(
      box(0.7, 0.6, 0.7, 0.2, G, 0.25, TORSO.bottom + 0.1, TORSO.back - 0.3, [0.5, 0.6, 0]),
      box(0.5, 0.44, 0.7, 0.16, G, 0.6, TORSO.bottom - 0.2, TORSO.back - 0.75, [0.7, 0.7, 0]),
      box(0.3, 0.28, 0.6, 0.1, G, 0.95, TORSO.bottom - 0.45, TORSO.back - 1.1, [0.9, 0.8, 0]),
    );
    return [{ part: 'torso', object: group(...spikes, tail) }];
  },
};

export function buildAccessory(id: AccessoryId): Attachment[] {
  const list = BUILDERS[id]();
  for (const a of list) {
    a.object.userData.accessory = id;
    a.object.traverse((o) => {
      o.userData.accessory = id;
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }
  return list;
}

export const ACCESSORY_IDS = Object.keys(BUILDERS) as AccessoryId[];
