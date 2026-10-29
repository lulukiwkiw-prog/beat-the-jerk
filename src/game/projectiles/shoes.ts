import type { Group, Object3D } from 'three';
import { PROJECTILE, type ThrowMove } from '../../config/moves.config';
import { buildShoe } from './shoeModel';

interface Shoe {
  mesh: Group;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hitId: string;
  spin: number;
  gravity: number;
}

export interface Hurtbox {
  x: number;
  halfWidth: number;
  bottom: number;
  top: number;
  active: boolean;
}

/** 直線快速投射物：以實際碰撞判定命中；飛出畫面或落地後移除。 */
export class ShoeProjectiles {
  private list: Shoe[] = [];
  constructor(private readonly parent: Object3D) {}

  throw(move: ThrowMove, x: number, dir: 1 | -1, hitId: string) {
    const mesh = buildShoe();
    mesh.position.set(x + dir * 0.9, move.releaseY, 0.3);
    mesh.scale.x = dir;
    this.parent.add(mesh);
    this.list.push({ mesh, vx: dir * move.speed, vy: move.lift, dir, hitId, spin: move.spin, gravity: move.gravity });
  }

  /** 推進並回傳本步命中的 hitId。 */
  update(dt: number, target: Hurtbox): { hitId: string; x: number; y: number }[] {
    const hits: { hitId: string; x: number; y: number }[] = [];
    for (const s of this.list) {
      const p = s.mesh.position;
      p.x += s.vx * dt;
      s.vy -= s.gravity * dt;
      p.y += s.vy * dt;
      s.mesh.rotation.z -= s.dir * s.spin * dt;
      const inX = Math.abs(p.x - target.x) < target.halfWidth + PROJECTILE.hitPad;
      if (target.active && inX && p.y > target.bottom && p.y < target.top) {
        hits.push({ hitId: s.hitId, x: p.x, y: p.y });
        s.vx = 0;
      }
    }
    // 命中、飛出畫面或落地就移除
    this.list = this.list.filter((s) => {
      const gone = s.vx === 0 || Math.abs(s.mesh.position.x) > PROJECTILE.removeX || s.mesh.position.y < 0;
      if (gone) s.mesh.removeFromParent();
      return !gone;
    });
    return hits;
  }

  get count() {
    return this.list.length;
  }

  clear() {
    this.list.forEach((s) => s.mesh.removeFromParent());
    this.list = [];
  }
}
