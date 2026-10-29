import { BoxGeometry, CylinderGeometry, Mesh, Vector3, type Object3D } from 'three';
import { EFFECTS } from '../../config/effects.config';
import { QUALITY } from '../../config/quality.config';
import { plastic } from '../three/color';

const COLORS = ['#E8392B', '#FFC63A', '#2FB896', '#64B5F6', '#F48FB1', '#FFFFFF'];
let chipGeo: BoxGeometry | null = null;
let starGeo: CylinderGeometry | null = null;

interface P {
  mesh: Mesh;
  v: Vector3;
  w: Vector3;
  life: number;
}

/** 彩色小積木碎屑與星星粒子；同時最多 maxParticles 個，共用幾何與材質。 */
export class Particles {
  private list: P[] = [];
  constructor(private readonly parent: Object3D) {}

  burst(at: Vector3, kind: 'star' | 'chip', n: number) {
    chipGeo ??= new BoxGeometry(0.2, 0.12, 0.2);
    starGeo ??= new CylinderGeometry(0.16, 0.16, 0.05, 5);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= QUALITY.maxParticles) this.remove(this.list.shift()!);
      const mat = plastic(kind === 'star' ? '#FFC63A' : COLORS[i % COLORS.length]);
      const mesh = new Mesh(kind === 'star' ? starGeo : chipGeo, mat);
      mesh.position.copy(at);
      this.parent.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const [l0, l1] = EFFECTS.particleLife;
      this.list.push({
        mesh,
        v: new Vector3(Math.cos(a) * (2 + Math.random() * 4), 3 + Math.random() * 5, (Math.random() - 0.2) * 3),
        w: new Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: l0 + Math.random() * (l1 - l0),
      });
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      p.v.y -= 16 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.w.x * dt;
      p.mesh.rotation.y += p.w.y * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.v.y *= -0.4;
        p.v.x *= 0.6;
      }
      p.life -= dt;
      if (p.life <= 0) this.remove(p);
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  get count() {
    return this.list.length;
  }

  private remove(p: P) {
    p.life = 0;
    p.mesh.removeFromParent();
  }

  clear() {
    this.list.forEach((p) => this.remove(p));
    this.list = [];
  }
}
