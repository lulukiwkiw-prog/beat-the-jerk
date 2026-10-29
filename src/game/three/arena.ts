import {
  BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, TorusGeometry,
} from 'three';
import { plastic, srgb } from './color';
import { cachedRoundedBox, roundedBox, studGeometry } from './geometry';

const RED = '#D8322A';
const YEL = '#F2B632';
const BLUE = '#2A5DB0';
const NAVY = '#1D2740';
const BG = '#E8E7DE';

/** 依顏色收集凸點位置，最後各建一個 InstancedMesh。 */
class StudBatch {
  private byColor = new Map<string, Matrix4[]>();
  add(color: string, x: number, y: number, z: number) {
    const list = this.byColor.get(color) ?? [];
    list.push(new Matrix4().makeTranslation(x, y, z));
    this.byColor.set(color, list);
  }
  build(parent: Group) {
    for (const [color, list] of this.byColor) {
      const inst = new InstancedMesh(studGeometry(), plastic(color), list.length);
      list.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.castShadow = true;
      inst.receiveShadow = true;
      parent.add(inst);
    }
  }
}

export const ARENA_BACKGROUND = BG;

/**
 * 擂台展示台（SPEC 第 4 節）：深藍底座、兩色方磚地板、中央標記、外框積木、
 * 四角柱、三色繩（前方不設）、燈桿、小道具。
 */
export function buildArena(): Group {
  const g = new Group();
  g.name = 'arena';
  const studs = new StudBatch();

  const ground = new Mesh(new PlaneGeometry(90, 90), new MeshStandardMaterial({ color: srgb('#DFDDD2'), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.9;
  ground.receiveShadow = true;
  g.add(ground);

  const slab = new Mesh(roundedBox(19.6, 0.4, 10, 0.12), plastic(NAVY));
  slab.position.set(0, -0.68, 0.3);
  slab.receiveShadow = true;
  g.add(slab);

  // 方磚地板（兩色交錯）
  const tileGeo = roundedBox(0.97, 0.12, 0.97, 0.03, 3);
  const tiles: Record<'a' | 'b', Matrix4[]> = { a: [], b: [] };
  for (let x = -8; x <= 8; x++) for (let z = -3; z <= 3; z++) tiles[(x + z) & 1 ? 'a' : 'b'].push(new Matrix4().makeTranslation(x, -0.06, z));
  for (const [k, color] of [['a', '#C7CEC2'], ['b', '#D8DCD2']] as const) {
    const inst = new InstancedMesh(tileGeo, plastic(color), tiles[k].length);
    tiles[k].forEach((m, i) => inst.setMatrixAt(i, m));
    inst.receiveShadow = true;
    g.add(inst);
  }

  // 中央藍框紅心
  const mark = (w: number, color: string, y: number) => {
    const m = new Mesh(new BoxGeometry(w, 0.02, w * 0.62), plastic(color));
    m.position.set(0, y, 0);
    m.receiveShadow = true;
    g.add(m);
  };
  mark(3.2, BLUE, 0.005);
  mark(2.7, '#D8DCD2', 0.012);
  mark(1.4, RED, 0.02);

  const brick = (x: number, z: number, w: number, d: number, color: string, y: number, h: number, withStuds: boolean) => {
    const b = new Mesh(cachedRoundedBox(w - 0.04, h, d - 0.04, 0.05), plastic(color));
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
    if (withStuds) {
      const n = Math.max(1, Math.round(w / 0.5));
      const m = Math.max(1, Math.round(d / 0.5));
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) studs.add(color, x + (i - (n - 1) / 2) * (w / n), y + h / 2 + 0.05, z + (j - (m - 1) / 2) * (d / m));
    }
  };

  // 前排紅黃交錯、下層藍色
  for (let i = 0; i < 15; i++) {
    const x = -8.4 + i * 1.2;
    brick(x, 3.95, 1.2, 0.8, i % 2 ? YEL : RED, -0.2, 0.46, true);
    brick(x + 0.6, 3.95, 1.2, 0.8, BLUE, -0.55, 0.3, false);
  }
  // 左側藍、右側紅
  for (let i = 0; i < 8; i++) {
    const z = -3.6 + i * 1.08;
    brick(-9.25, z, 0.8, 1.08, BLUE, -0.2, 0.46, true);
    brick(9.25, z, 0.8, 1.08, RED, -0.2, 0.46, true);
  }
  // 後方藍色矮牆
  for (let i = 0; i < 9; i++) brick(-8.4 + i * 2.1, -3.95, 2.1, 0.7, BLUE, 0.1, 0.9, true);

  // 四角柱：左藍右紅、黃色柱頭帶凸點
  for (const [x, z] of [[-8.6, -3.5], [8.6, -3.5], [-8.6, 3.5], [8.6, 3.5]]) {
    for (let i = 0; i < 5; i++) brick(x, z, 0.7, 0.7, x < 0 ? BLUE : RED, 0.26 + i * 0.52, 0.5, false);
    brick(x, z, 0.78, 0.78, YEL, 2.82, 0.4, true);
  }

  // 三色繩：後方與兩側，前方不設
  const ropeGeoLong = new CylinderGeometry(0.06, 0.06, 17.2, 10);
  const ropeGeoSide = new CylinderGeometry(0.06, 0.06, 7, 10);
  [RED, '#F4F1EA', BLUE].forEach((c, i) => {
    const y = 0.95 + i * 0.62;
    const back = new Mesh(ropeGeoLong, plastic(c));
    back.rotation.z = Math.PI / 2;
    back.position.set(0, y, -3.5);
    back.castShadow = true;
    g.add(back);
    for (const x of [-8.6, 8.6]) {
      const side = new Mesh(ropeGeoSide, plastic(c));
      side.rotation.x = Math.PI / 2;
      side.position.set(x, y, 0);
      side.castShadow = true;
      g.add(side);
    }
  });

  // 後方兩根黑色燈桿與燈頭
  const black = plastic('#1C1C22');
  for (const x of [-9.6, 9.6]) {
    const pole = new Mesh(new CylinderGeometry(0.09, 0.09, 6.4, 10), black);
    pole.position.set(x, 2.6, -4.6);
    g.add(pole);
    const lamp = new Mesh(cachedRoundedBox(1.1, 0.4, 0.7, 0.1), black);
    lamp.position.set(x * 0.96, 5.9, -4.4);
    lamp.rotation.z = x < 0 ? -0.2 : 0.2;
    g.add(lamp);
    const glow = new Mesh(new BoxGeometry(0.9, 0.05, 0.5), new MeshBasicMaterial({ color: srgb('#FFF3C4') }));
    glow.position.y = -0.21;
    lamp.add(glow);
  }

  // 台上小道具（純裝飾，不參與碰撞）
  const bucket = new Mesh(new CylinderGeometry(0.42, 0.34, 0.62, 20), plastic(NAVY));
  bucket.position.set(7.2, 0.31, 2.6);
  bucket.castShadow = true;
  g.add(bucket);
  const rim = new Mesh(new TorusGeometry(0.4, 0.05, 8, 24), plastic('#3A4A70'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.31;
  bucket.add(rim);
  brick(-7.3, -2.6, 1.0, 0.8, YEL, 0.32, 0.64, true);
  brick(3.4, 2.9, 0.6, 0.5, RED, 0.13, 0.26, true);

  studs.build(g);
  return g;
}

