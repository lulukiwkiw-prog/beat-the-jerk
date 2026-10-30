import type { Group, Mesh, Object3D } from 'three';
import { PROJECTILE, type MoveId, type ThrowMove } from '../../config/moves.config';
import { lobVelocity } from '../moves/attack';
import { buildBucket, buildChair, buildFoam, buildShoe } from './weaponModels';

interface Projectile {
  id: MoveId;
  mesh: Group;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hitId: string;
  spin: number;
  gravity: number;
  pad: number;
  done: boolean;
}

interface Foam {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  life: number;
}

export interface Hurtbox {
  x: number;
  halfWidth: number;
  bottom: number;
  top: number;
  active: boolean;
}

export interface ProjectileHit {
  hitId: string;
  id: MoveId;
  x: number;
  y: number;
}

const BUILD: Partial<Record<MoveId, () => Group>> = { shoe: buildShoe, bucket: buildBucket, chair: buildChair };

/**
 * 投射物：鞋子（直線快速）、水桶與桌椅（拋物線）。以實際碰撞判定命中；
 * 命中、飛出畫面或落地後移除。桌椅碎成泡棉塊，1.5 秒後清除。
 */
export class Projectiles {
  private list: Projectile[] = [];
  private foam: Foam[] = [];
  constructor(private readonly parent: Object3D) {}

  throw(move: ThrowMove, x: number, dir: 1 | -1, hitId: string, targetX: number) {
    const mesh = (BUILD[move.id] ?? buildShoe)();
    const x0 = x + dir * 0.9;
    mesh.position.set(x0, move.releaseY, 0.3);
    mesh.scale.x = dir;
    this.parent.add(mesh);
    let vx = dir * move.speed;
    let vy = move.lift;
    if (move.arc) {
      const a = move.arc;
      ({ vx, vy } = lobVelocity({ fromX: x0, fromY: move.releaseY, targetX, aimY: a.aimY, dir, minD: a.minReach * PROJECTILE.H, maxD: a.maxReach * PROJECTILE.H, T: a.flightTime, g: move.gravity }));
    }
    this.list.push({ id: move.id, mesh, vx, vy, dir, hitId, spin: move.spin, gravity: move.gravity, pad: move.pad, done: false });
  }

  /** 推進並回傳本步命中的投射物。 */
  update(dt: number, target: Hurtbox): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    for (const s of this.list) {
      const p = s.mesh.position;
      p.x += s.vx * dt;
      s.vy -= s.gravity * dt;
      p.y += s.vy * dt;
      s.mesh.rotation.z -= s.dir * s.spin * dt;
      const inX = Math.abs(p.x - target.x) < target.halfWidth + PROJECTILE.hitPad + s.pad;
      if (target.active && inX && p.y > target.bottom - s.pad && p.y < target.top + s.pad) {
        hits.push({ hitId: s.hitId, id: s.id, x: p.x, y: p.y });
        s.done = true;
      }
      if (p.y < 0.2 || Math.abs(p.x) > PROJECTILE.removeX) s.done = true;
    }
    this.list = this.list.filter((s) => {
      if (!s.done) return true;
      // 桌椅不論命中或落地都碎成泡棉塊（離開畫面的就不用了）
      if (s.id === 'chair' && Math.abs(s.mesh.position.x) < PROJECTILE.removeX) this.burstFoam(s.mesh.position.x, Math.max(0.6, s.mesh.position.y), s.dir);
      s.mesh.removeFromParent();
      return false;
    });
    this.updateFoam(dt);
    return hits;
  }

  private burstFoam(x: number, y: number, dir: 1 | -1) {
    const F = PROJECTILE.foam;
    for (let i = 0; i < F.count; i++) {
      const mesh = buildFoam(i);
      mesh.position.set(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.8, 0.3 + (Math.random() - 0.5) * 0.8);
      this.parent.add(mesh);
      this.foam.push({
        mesh,
        vx: -dir * (1 + Math.random() * F.speed) + (Math.random() - 0.5) * F.speed,
        vy: 2 + Math.random() * F.up,
        vz: (Math.random() - 0.5) * F.speed,
        spin: (Math.random() - 0.5) * 12,
        life: F.life,
      });
    }
  }

  private updateFoam(dt: number) {
    const F = PROJECTILE.foam;
    for (const f of this.foam) {
      f.life -= dt;
      const p = f.mesh.position;
      f.vy -= F.gravity * dt;
      p.x += f.vx * dt;
      p.y += f.vy * dt;
      p.z += f.vz * dt;
      if (p.y < 0.15) {
        p.y = 0.15;
        f.vy = Math.abs(f.vy) * 0.35;
        f.vx *= 0.6;
        f.vz *= 0.6;
      }
      f.mesh.rotation.x += f.spin * dt;
      f.mesh.rotation.z += f.spin * 0.7 * dt;
      // 最後 0.3 秒縮小消失
      f.mesh.scale.setScalar(Math.max(0.01, Math.min(1, f.life / 0.3)));
    }
    this.foam = this.foam.filter((f) => {
      if (f.life > 0) return true;
      f.mesh.removeFromParent();
      return false;
    });
  }

  /** 場上投射物＋泡棉塊數量 */
  get count() {
    return this.list.length + this.foam.length;
  }

  clear() {
    this.list.forEach((s) => s.mesh.removeFromParent());
    this.foam.forEach((f) => f.mesh.removeFromParent());
    this.list = [];
    this.foam = [];
  }
}
