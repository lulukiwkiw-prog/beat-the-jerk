import { GAME } from '../../config/game.config';
import { MOVES, PLAYER, type MoveId } from '../../config/moves.config';
import { startAttack, type ActiveAttack } from '../moves/attack';
import type { PlayerRig } from './playerModel';
import { buildShoe } from '../projectiles/shoeModel';
import type { Group } from 'three';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

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
  /** 結局演出時由劇本控制：朝向（弧度）、走路擺腿、坐下 */
  script: { yaw: number; walking: boolean; sit: boolean } | null = null;

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
    if (this.script) {
      this.bob += dt;
      return;
    }
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

  /**
   * 依目前狀態擺姿勢（每個渲染畫格呼叫）。target＝對手的位置與臉的高度，
   * 甩巴掌時用來讓手真的甩到臉上。
   */
  pose(frameDt: number, target: { x: number; faceY: number; faceFront: number }) {
    const L = this.rig;
    const a = this.attack;
    L.root.position.set(this.x, this.hop, 0);
    let face = this.facing > 0 ? 0.85 : -0.85;
    let yawRate = 14;
    let slap: { arm: 'L' | 'R'; shX: number } | null = null;
    if (a && a.move.id === 'slap') {
      const S = PLAYER.slapAnim;
      const t = a.t;
      const w = a.move.windup;
      // 往前踏一步補足距離：手臂長度扣掉高度差後，剩下的水平距離靠踏步
      const dy = target.faceY - (S.shoulderY + this.hop);
      const reachX = Math.sqrt(Math.max(0, S.armLength * S.armLength - dy * dy));
      const gap = Math.abs(target.x - this.x) - target.faceFront;
      const lunge = Math.min(S.maxLunge, Math.max(0, gap - reachX));
      const inOut = t < S.lungeIn ? smooth(t / S.lungeIn) : t < S.hold ? 1 : 1 - smooth((t - S.hold) / Math.max(0.01, a.move.duration - S.hold));
      L.root.position.x += this.facing * lunge * inOut;
      // 身體轉正面對對手，扭腰把手掌從旁邊甩過臉（判定時間點剛好掃過臉）
      const twist = t < w ? lerp(-S.twistBack, 0, t / w) : t < S.hold ? lerp(0, S.twistThrough, (t - w) / (S.hold - w)) : lerp(S.twistThrough, 0, smooth((t - S.hold) / Math.max(0.01, a.move.duration - S.hold)));
      face = this.facing * (Math.PI / 2 + twist);
      yawRate = 40;
      const elev = Math.atan2(dy, Math.max(0.2, reachX));
      slap = { arm: this.facing > 0 ? 'L' : 'R', shX: -(Math.PI / 2 + elev) * Math.min(1, inOut * 1.5) };
    }
    if (this.script) face = this.script.yaw;
    let stomp: number | null = null;
    if (a && a.move.id === 'stomp') {
      // 跳起來往前跳到木偶上方，落下踩扁，站一下再跳回原位
      const S = PLAYER.stompAnim;
      const t = a.t;
      const w = a.move.windup;
      const overX = target.x - this.facing * S.overshoot;
      const reach = t < w ? smooth(t / w) : t < S.hold ? 1 : 1 - smooth((t - S.hold) / (S.land - S.hold));
      L.root.position.x = this.x + (overX - this.x) * reach;
      const y = t < S.rise ? S.peak * Math.sin((t / S.rise) * (Math.PI / 2)) : t < w ? S.peak + (S.standY - S.peak) * smooth((t - S.rise) / (w - S.rise)) : t < S.hold ? S.standY : S.standY * (1 - smooth((t - S.hold) / (S.land - S.hold)));
      L.root.position.y = this.hop + y;
      stomp = t;
    }
    this.bodyYaw += (face - this.bodyYaw) * Math.min(1, frameDt * yawRate);
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
      } else if (m.id === 'slap' && slap) {
        // 靠鏡頭那一側的手，伸直、張開手掌
        if (slap.arm === 'L') {
          A.shL = [slap.shX, 0];
          A.elL = 0;
        } else {
          A.shR = [slap.shX, 0];
          A.elR = 0;
        }
        open = true;
      } else if (m.id === 'stomp' && stomp !== null) {
        // 雙手高舉
        A.shL = [-2.7, -0.3];
        A.shR = [-2.7, 0.3];
        A.elL = A.elR = -0.2;
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
    const walking = this.script ? this.script.walking : Math.abs(this.vx) > 0.5 && this.dodge <= 0;
    const step = walking ? Math.sin(this.bob * 14) * 0.45 : 0;
    // 格鬥站姿：靠近對手的腳在前、另一腳在後（走路時改成擺腿）
    const frontR = this.facing > 0;
    const st = step === 0 ? PLAYER.stance : { front: 0, back: 0 };
    L.legL.rotation.x = step + (frontR ? st.back : -st.front);
    L.legR.rotation.x = -step + (frontR ? -st.front : st.back);
    if (stomp !== null) {
      // 空中縮腿、落下時伸直往下踩
      const tuck = stomp < (a?.move.windup ?? 0) ? -0.9 : -0.1;
      L.legL.rotation.x = tuck;
      L.legR.rotation.x = tuck + 0.3;
    }
    if (this.script?.sit) {
      // 坐在舞台邊緣：雙腿往前、身體下沉、手放在膝上
      L.legL.rotation.x = L.legR.rotation.x = -1.45;
      L.root.position.y = -1.55;
      A.shL = [-0.6, 0];
      A.shR = [-0.6, 0];
      A.elL = A.elR = -0.5;
    }
    if (this.script && !this.script.sit) {
      // 演出時放下拳頭
      A.shL = [0.05 + step * 0.4, 0];
      A.shR = [0.05 - step * 0.4, 0];
      A.elL = A.elR = -0.25;
    }
    L.shL.rotation.set(A.shL[0], 0, A.shL[1]);
    L.shR.rotation.set(A.shR[0], 0, A.shR[1]);
    L.elL.rotation.x = A.elL;
    L.elR.rotation.x = A.elR;
    const openArm = slap?.arm;
    for (const [g, side] of [[L.gloveL, 'L'], [L.gloveR, 'R']] as const) {
      const o = open && openArm === side;
      g.scale.set(o ? 0.5 : 1, o ? 1.35 : 1.05, o ? 1.2 : 1.1);
    }
    this.heldShoe.visible = !!(a && a.move.id === 'shoe' && a.t < a.move.windup);
  }
}
