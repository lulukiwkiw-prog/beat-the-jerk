import { CylinderGeometry, Group, Mesh, type Object3D } from 'three';
import { GAME } from '../../config/game.config';
import { PUPPET } from '../../config/puppet.config';
import { plastic } from '../three/color';
import { cachedRoundedBox } from '../three/geometry';

interface Pad {
  root: Group;
  cushion: Mesh;
  squash: number;
}

/**
 * 彈墊時間：左右場邊各立一塊彈簧墊。出現時彈出來，木偶撞上去時壓扁再彈回。
 */
export class BouncePads {
  private readonly pads: Pad[] = [];
  private shown = 0;
  private target = 0;

  constructor(parent: Object3D) {
    const x = GAME.wallR + PUPPET.halfWidth + 0.35;
    for (const side of [-1, 1]) {
      const root = new Group();
      root.position.set(side * x, 0, 0);
      const base = new Mesh(cachedRoundedBox(0.5, 0.3, 2.4, 0.08), plastic('#2B2B33'));
      base.position.y = 0.15;
      root.add(base);
      const spring = new CylinderGeometry(0.08, 0.08, 1, 8);
      for (const z of [-0.7, 0.7]) {
        const s = new Mesh(spring, plastic('#B8C0CC'));
        s.position.set(0, 0.8, z);
        root.add(s);
      }
      const cushion = new Mesh(cachedRoundedBox(0.55, 3.2, 2.2, 0.24), plastic(side < 0 ? '#FF7FA8' : '#FFC63A'));
      cushion.position.y = 2.4;
      cushion.castShadow = true;
      root.add(cushion);
      root.scale.setScalar(0.001);
      root.visible = false;
      parent.add(root);
      this.pads.push({ root, cushion, squash: 0 });
    }
  }

  show(on: boolean) {
    this.target = on ? 1 : 0;
  }

  /** side＝-1 左、1 右 */
  hit(side: -1 | 1) {
    this.pads[side < 0 ? 0 : 1].squash = 1;
  }

  get visible() {
    return this.shown > 0.5;
  }

  update(dt: number) {
    // 出現時彈一下（超過 1 再回來）、消失時縮回去
    const k = this.target > this.shown ? 7 : 9;
    this.shown += (this.target - this.shown) * Math.min(1, dt * k);
    const pop = this.target === 1 ? 1 + Math.sin(Math.min(1, this.shown) * Math.PI) * 0.15 : 1;
    for (const p of this.pads) {
      const s = Math.max(0.001, this.shown * pop);
      p.root.scale.setScalar(s);
      p.root.visible = this.shown > 0.01;
      p.squash = Math.max(0, p.squash - dt * 5);
      p.cushion.scale.set(1 - p.squash * 0.45, 1 + p.squash * 0.08, 1);
    }
  }

  hideNow() {
    this.target = this.shown = 0;
    this.update(0);
  }
}
