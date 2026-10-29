import { GAME } from '../../config/game.config';
import { MOVES, PLAYER, type MoveId } from '../../config/moves.config';
import { startAttack, type ActiveAttack } from '../moves/attack';
import type { PlayerRig } from './playerModel';
import { buildShoe } from '../projectiles/shoeModel';
import type { Group } from 'three';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 玩家角色的狀態與動作。 */
export class Player {
  x: number = GAME.playerStartX;
  vx = 0;
  facing: 1 | -1 = 1;
  attack: ActiveAttack | null = null;
  cooldowns: Partial<Record<MoveId, number>> = {};
  dodge = 0;
  dodgeCd = 0;
  stun = 0;
  private hop = 0;
  private bob = 0;
  private bodyYaw = 0.85;
  private heldShoe: Group;

  constructor(readonly rig: PlayerRig) {
    this.heldShoe = buildShoe();
    this.heldShoe.visible = false;
    this.heldShoe.position.set(0, -0.75, 0);
    rig.elR.add(this.heldShoe);
  }

  reset() {
    this.x = GAME.playerStartX;
    this.vx = 0;
    this.facing = 1;
    this.attack = null;
    this.cooldowns = {};
    this.buffered = null;
    this.dodge = this.dodgeCd = this.stun = this.hop = 0;
  }

  get busy() {
    return !!this.attack || this.stun > 0 || this.dodge > 0;
  }

  cooldownOf(id: MoveId) {
    return this.cooldowns[id] ?? 0;
  }

  /** 前一招還沒收完時先預約，收招後立刻出（避免按鍵被吃掉） */
  private buffered: { id: MoveId; ttl: number } | null = null;

  /** 嘗試出招；冷卻中或硬直中回傳 null（出招中則預約）。 */
  tryAttack(id: MoveId, seq: number): ActiveAttack | null {
    if (this.attack && this.stun <= 0) {
      this.buffered = { id, ttl: PLAYER.inputBuffer };
      return null;
    }
    if (this.busy || this.cooldownOf(id) > 0) return null;
    this.attack = startAttack(id, seq, this.facing);
    this.cooldowns[id] = MOVES[id].cooldown;
    return this.attack;
  }

  tryDodge(): boolean {
    if (this.dodgeCd > 0 || this.attack || this.stun > 0) return false;
    this.dodge = PLAYER.dodgeTime;
    this.dodgeCd = PLAYER.dodgeCooldown;
    this.vx = -this.facing * PLAYER.dodgeSpeed;
    return true;
  }

  knockedBack(dir: number) {
    this.vx = dir * PLAYER.hitPush;
    this.stun = PLAYER.hitStun;
    this.attack = null;
  }

  /** 取出到期前的預約招式（目前沒有在出招時）。 */
  takeBuffered(): MoveId | null {
    if (!this.buffered || this.attack) return null;
    const id = this.buffered.id;
    this.buffered = null;
    return id;
  }

  update(dt: number, move: -1 | 0 | 1, targetX: number, live: boolean) {
    if (this.buffered) {
      this.buffered.ttl -= dt;
      if (this.buffered.ttl <= 0 || !live) this.buffered = null;
    }
    for (const k of Object.keys(this.cooldowns) as MoveId[]) this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.bob += dt;
    if (this.dodge > 0) {
      this.dodge = Math.max(0, this.dodge - dt);
      this.hop = Math.sin((1 - this.dodge / PLAYER.dodgeTime) * Math.PI) * PLAYER.dodgeHop;
    } else this.hop = 0;
    const want = live && !this.attack && this.stun <= 0 && this.dodge <= 0 ? move : 0;
    if (this.dodge <= 0 && this.stun <= 0) this.vx = want * PLAYER.speed;
    else this.vx *= Math.pow(0.02, dt);
    this.x = Math.max(GAME.playerMinX, Math.min(GAME.playerMaxX, this.x + this.vx * dt));
    // 自動面朝木偶（出招中保持方向）
    if (!this.attack) {
      const d = Math.sign(targetX - this.x);
      if (d) this.facing = d as 1 | -1;
    }
  }

  /** 依目前狀態擺姿勢（每個渲染畫格呼叫）。 */
  pose(frameDt: number) {
    const L = this.rig;
    const a = this.attack;
    L.root.position.set(this.x, this.hop, 0);
    const face = this.facing > 0 ? 0.85 : -0.85;
    this.bodyYaw += (face - this.bodyYaw) * Math.min(1, frameDt * 14);
    L.body.rotation.y = this.bodyYaw;
    L.body.rotation.z = this.stun > 0 ? 0.22 * this.facing : this.dodge > 0 ? 0.3 * this.facing : 0;
    const bob = Math.sin(this.bob * 5) * 0.06;
    const A = { shL: [-0.5 + bob, 0], elL: -1.9, shR: [-0.35 - bob, 0], elR: -1.7 } as Record<'shL' | 'shR', [number, number]> & { elL: number; elR: number };
    let open = false;
    if (a) {
      const t = a.t;
      const m = a.move;
      if (m.id === 'jab') {
        // 左右手交替出拳，每段 interval 秒
        const k = Math.max(0, t - m.windup * 0.5) / 0.09;
        const e = Math.sin((k % 1) * Math.PI);
        if (Math.floor(k) % 2) {
          A.shR = [lerp(-0.35, -1.57, e), 0];
          A.elR = lerp(-1.7, 0, e);
        } else {
          A.shL = [lerp(-0.5, -1.57, e), 0];
          A.elL = lerp(-1.9, 0, e);
        }
      } else if (m.id === 'uppercut') {
        const p = Math.min(1, t / 0.25);
        A.shR = [lerp(-0.2, -2.9, p), 0];
        A.elR = lerp(-1.6, -0.3, p);
        L.root.position.y += Math.sin(p * Math.PI) * 0.25;
      } else if (m.id === 'slap') {
        const p = Math.min(1, t / 0.16);
        A.shR = [-1.45, lerp(-1.0, 0.7, p)];
        A.elR = 0;
        open = true;
      } else if (m.id === 'shoe') {
        const p = Math.min(1, t / 0.12);
        A.shR = [lerp(1.0, -2.1, p), 0];
        A.elR = -0.3;
      }
    }
    if (this.stun > 0) {
      A.shL = [-2.6, 0];
      A.shR = [-2.6, 0];
      A.elL = A.elR = -0.6;
    }
    const step = Math.abs(this.vx) > 0.5 && this.dodge <= 0 ? Math.sin(this.bob * 14) * 0.45 : 0;
    L.legL.rotation.x = step;
    L.legR.rotation.x = -step;
    L.shL.rotation.set(A.shL[0], 0, A.shL[1]);
    L.shR.rotation.set(A.shR[0], 0, A.shR[1]);
    L.elL.rotation.x = A.elL;
    L.elR.rotation.x = A.elR;
    L.gloveR.scale.set(open ? 0.5 : 1, open ? 1.35 : 1.05, open ? 1.2 : 1.1);
    this.heldShoe.visible = !!(a && a.move.id === 'shoe' && a.t < a.move.windup);
  }
}
