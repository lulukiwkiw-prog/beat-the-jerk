import { AdditiveBlending, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { srgb } from '../three/color';

const glowMat = (hex: string, opacity: number) =>
  new MeshBasicMaterial({ color: srgb(hex), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false });

/**
 * 致命一擊的能量光波：雙手之間的集氣光球，推出後變成一道白芯黃光的光柱，
 * 末端跟著被轟飛的對手。只用基本幾何與發光材質。
 */
export class EnergyBeam {
  private readonly root = new Group();
  private readonly ball = new Group();
  private readonly beam = new Group();
  private readonly head = new Group();
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly geos = [new SphereGeometry(1, 24, 16), new CylinderGeometry(1, 1, 1, 24, 1, true)];
  private time = 0;

  constructor(parent: Object3D) {
    const core = glowMat('#FFFFFF', 1);
    const mid = glowMat('#FFF3A6', 0.75);
    const outer = glowMat('#FFC63A', 0.4);
    this.mats.push(core, mid, outer);
    const [sph, cyl] = this.geos;
    // 光球：白芯＋兩層光暈
    for (const [m, s] of [[core, 0.55], [mid, 0.8], [outer, 1.15]] as const) {
      const o = new Mesh(sph, m);
      o.scale.setScalar(s);
      this.ball.add(o);
    }
    // 光柱：沿 +Y 的單位圓柱，之後轉向並拉長
    for (const [m, s] of [[core, 0.45], [mid, 0.75], [outer, 1.1]] as const) {
      const o = new Mesh(cyl, m);
      o.scale.set(s, 1, s);
      o.position.y = 0.5;
      this.beam.add(o);
    }
    for (const [m, s] of [[core, 0.9], [mid, 1.3], [outer, 1.8]] as const) {
      const o = new Mesh(sph, m);
      o.scale.setScalar(s);
      this.head.add(o);
    }
    this.root.add(this.ball, this.beam, this.head);
    this.ball.visible = this.beam.visible = this.head.visible = false;
    parent.add(this.root);
  }

  /** 集氣光球：size 0～1 */
  charge(at: Vector3, size: number, dt: number) {
    this.time += dt;
    this.ball.visible = size > 0.01;
    this.ball.position.copy(at);
    this.ball.scale.setScalar(Math.max(0.01, size * (1 + Math.sin(this.time * 40) * 0.08)));
  }

  /** 光柱從 from 射到 to；radius 為光柱粗細，fade 0～1 */
  fire(from: Vector3, to: Vector3, radius: number, fade: number, dt: number) {
    this.time += dt;
    const dir = new Vector3().subVectors(to, from);
    const len = Math.max(0.01, dir.length());
    dir.normalize();
    const r = radius * fade * (1 + Math.sin(this.time * 55) * 0.06);
    this.beam.visible = this.head.visible = fade > 0.01;
    this.beam.position.copy(from);
    this.beam.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    this.beam.scale.set(r, len, r);
    this.head.position.copy(to);
    this.head.scale.setScalar(r * 1.1);
    this.ball.position.copy(from);
    this.ball.scale.setScalar(r * 1.3);
    this.ball.visible = fade > 0.01;
  }

  hide() {
    this.ball.visible = this.beam.visible = this.head.visible = false;
  }

  dispose() {
    this.root.removeFromParent();
    this.mats.forEach((m) => m.dispose());
    this.geos.forEach((g) => g.dispose());
  }
}
