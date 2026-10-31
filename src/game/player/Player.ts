import { GAME } from '../../config/game.config';
import { H, MOVES, PLAYER, type MoveId } from '../../config/moves.config';
import { PUPPET } from '../../config/puppet.config';
import { JUGGLE } from '../../config/effects.config';
import { dashProgress, startAttack, type ActiveAttack } from '../moves/attack';
import type { PlayerRig } from './playerModel';
import { buildBucket, buildChair, buildClub, buildHammer, buildShoe } from '../projectiles/weaponModels';
import type { Group, Object3D } from 'three';

type Held = 'shoe' | 'club' | 'hammer' | 'bucket' | 'chair';

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
  /** 上次閃避開始後經過的秒數（判斷閃避成功用） */
  dodgeAge = Infinity;
  stun = 0;
  /** 困難模式：被擊倒（躺下再起身）與起身後的無敵時間 */
  down = false;
  invuln = 0;
  /** 最近一次出的招（測試用） */
  lastMove: MoveId | null = null;
  /** 小型活動暫時改變的冷卻（例：鞋子時間丟鞋子 0.3 秒） */
  cdOverride: Partial<Record<MoveId, number>> = {};
  /** 演出時退場（道歉時不出場） */
  hidden = false;
  /** 空中連擊：跳起追打的高度（目前、目標） */
  airLift = 0;
  airTarget = 0;
  /** 致命一擊演出：集氣（0～1）、推出光波（0～1） */
  powerUp = 0;
  thrust = 0;
  private hop = 0;
  private bob = 0;
  private bodyYaw = 0.85;
  private held: Record<Held, Group>;
  /** 結局演出時由劇本控制：朝向（弧度）、走路擺腿、坐下 */
  script: { yaw: number; walking: boolean; sit: boolean } | null = null;

  constructor(readonly rig: PlayerRig) {
    // 拿在右手的武器（平常隱藏，出招時才出現）
    const at = (o: Group, parent: Object3D, x: number, y: number, z: number) => {
      o.visible = false;
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };
    const chair = at(buildChair(), rig.elR, -0.45, -1.15, 0);
    chair.rotation.set(Math.PI / 2, 0, 0);
    const bucket = at(buildBucket(), rig.elR, 0, -1.05, 0);
    bucket.scale.setScalar(0.85);
    this.held = {
      shoe: at(buildShoe(), rig.elR, 0, -0.75, 0),
      club: at(buildClub(), rig.elR, 0, -0.6, 0),
      hammer: at(buildHammer(), rig.elR, 0, -0.6, 0),
      bucket,
      chair,
    };
  }

  reset() {
    this.x = GAME.playerStartX;
    this.vx = 0;
    this.facing = 1;
    this.attack = null;
    this.cooldowns = {};
    this.buffered = null;
    this.dodge = this.dodgeCd = this.stun = this.hop = this.invuln = 0;
    this.dodgeAge = Infinity;
    this.down = false;
    this.airLift = this.airTarget = 0;
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
    this.cooldowns[id] = this.cdOverride[id] ?? MOVES[id].cooldown;
    this.lastMove = id;
    return this.attack;
  }

  tryDodge(): boolean {
    if (this.dodgeCd > 0 || this.attack || this.stun > 0) return false;
    this.dodge = PLAYER.dodgeTime;
    this.dodgeCd = PLAYER.dodgeCooldown;
    this.dodgeAge = 0;
    this.vx = -this.facing * PLAYER.dodgeSpeed;
    return true;
  }

  knockedBack(dir: number) {
    this.vx = dir * PLAYER.hitPush;
    this.stun = PLAYER.hitStun;
    this.attack = null;
  }

  /** 困難模式：被擊倒，getUp 秒內起身，起身後 invulnerable 秒無敵。 */
  knockedDown(dir: number, push: number, getUp: number, invulnerable: number) {
    this.vx = dir * push;
    this.stun = getUp;
    this.down = true;
    this.invuln = getUp + invulnerable;
    this.attack = null;
    this.buffered = null;
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
    if (this.stun === 0) this.down = false;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeAge += dt;
    this.bob += dt;
    // 空中連擊：快速跳上去、慢慢落下
    const J = JUGGLE;
    const target = this.attack ? this.airTarget : 0;
    this.airLift = target > this.airLift ? Math.min(target, this.airLift + J.riseRate * dt) : Math.max(target, this.airLift - J.fallRate * dt);
    if (this.dodge > 0) {
      this.dodge = Math.max(0, this.dodge - dt);
      this.hop = Math.sin((1 - this.dodge / PLAYER.dodgeTime) * Math.PI) * PLAYER.dodgeHop;
    } else this.hop = 0;
    const want = live && !this.attack && this.stun <= 0 && this.dodge <= 0 ? move : 0;
    if (this.dodge <= 0 && this.stun <= 0) this.vx = want * PLAYER.speed;
    else this.vx *= Math.pow(0.02, dt);
    this.x = Math.max(GAME.playerMinX, Math.min(GAME.playerMaxX, this.x + this.vx * dt));
    const a = this.attack;
    if (a && a.move.type === 'dash' && !a.landed) {
      // 飛踢突進：往面向衝，撞到木偶就停在它前面
      const m = a.move;
      const p0 = dashProgress(a);
      const p1 = Math.max(0, Math.min(1, (a.t + dt - m.windup) / m.dashTime));
      const stopAt = targetX - a.facing * (PLAYER.halfWidth + PUPPET.halfWidth);
      let nx = this.x + a.facing * (p1 - p0) * m.dashDist * H;
      if ((stopAt - nx) * a.facing < 0) nx = (stopAt - this.x) * a.facing > 0 ? stopAt : this.x;
      this.x = Math.max(GAME.playerMinX, Math.min(GAME.playerMaxX, nx));
    }
    // 自動面朝木偶（出招中保持方向）
    if (!this.attack) {
      const d = Math.sign(targetX - this.x);
      if (d) this.facing = d as 1 | -1;
    }
  }

  /** 殘影要複製的部位：拳類＝拳套、腿類＝雙腿、棍棒／鐵錘＝武器＋拳套 */
  trailParts(): Object3D[] {
    const a = this.attack;
    if (!a) return [];
    const L = this.rig;
    const id = a.move.id;
    if (id === 'spin' || id === 'flykick' || id === 'stomp') return [L.legL, L.legR];
    if (id === 'club') return [this.held.club, L.gloveR];
    if (id === 'hammer') return a.t >= a.move.windup ? [this.held.hammer, L.gloveL, L.gloveR] : [];
    if (id === 'chair') return [];
    return [L.gloveL, L.gloveR];
  }

  /**
   * 依目前狀態擺姿勢（每個渲染畫格呼叫）。target＝對手的位置與臉的高度，
   * 甩巴掌時用來讓手真的甩到臉上。
   */
  pose(frameDt: number, target: { x: number; faceY: number; faceFront: number }) {
    const L = this.rig;
    const a = this.attack;
    L.root.position.set(this.x, this.hop + this.airLift, 0);
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
    let spinLeg = 0;
    let fly = 0;
    if (a && a.move.id === 'spin') {
      // 迴旋踢：身體轉一整圈，後腳往外掃
      const S = PLAYER.spinAnim;
      const u = smooth((a.t - S.start) / (S.end - S.start));
      face = this.facing * (0.85 + u * Math.PI * 2);
      yawRate = 60;
      spinLeg = Math.sin(u * Math.PI) * S.legLift;
    }
    if (a && a.move.type === 'dash') {
      // 飛踢：側身騰空、前腳踢直
      const m = a.move;
      const total = m.windup + m.dashTime;
      fly = a.t < m.windup ? (a.t / m.windup) * 0.3 : a.t < total ? 1 : 1 - smooth((a.t - total) / Math.max(0.01, m.duration - total));
      L.root.position.y += Math.sin(Math.min(1, fly) * Math.PI * 0.5) * PLAYER.flykickAnim.hop * (a.t < total ? 1 : 1 - smooth((a.t - total) / 0.2));
      face = this.facing * (Math.PI / 2);
      yawRate = 30;
    }
    if (this.powerUp > 0 || this.thrust > 0) {
      // 側身蓄力，推出時轉正對準對手
      face = this.facing * lerp(0.35, Math.PI / 2, smooth(this.thrust));
      yawRate = 20;
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
    // 擊倒：一屁股跌坐在地、身體往後仰，最後 0.35 秒爬起來
    const downK = this.down && this.stun > 0 ? Math.min(1, this.stun / 0.35) : 0;
    L.body.rotation.z = downK ? this.facing * 0.45 * downK : this.stun > 0 ? 0.22 * this.facing : this.dodge > 0 ? 0.3 * this.facing : 0;
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
      } else if (m.id === 'club' && m.type === 'melee') {
        // 棍棒連打：每段從頭上往前敲，第 3 下舉更高、敲更用力
        const seg = Math.min(m.hits - 1, Math.max(0, Math.floor((t - m.windup + m.interval * 0.6) / m.interval)));
        const segStart = m.windup + seg * m.interval;
        const k = smooth((t - (segStart - m.interval * 0.6)) / (m.interval * 0.6));
        const top = seg === 2 ? -3.2 : -2.6;
        A.shR = [lerp(top, -1.05, k), 0];
        A.elR = lerp(-0.6, -0.1, k);
        A.shL = [-1.0, 0];
      } else if (m.id === 'hammer') {
        // 鐵錘：蓄力時高舉過頭、微微發抖，判定瞬間往下敲
        const H2 = PLAYER.hammerAnim;
        if (t < m.windup) {
          const k = smooth(t / 0.2);
          const sh = Math.sin(t * 60) * H2.shake * Math.min(1, t / m.windup);
          A.shR = [lerp(-0.6, -3.3, k) + sh, 0];
          A.shL = [lerp(-0.5, -3.1, k) - sh, 0];
          A.elR = A.elL = -0.25;
        } else {
          const k = smooth((t - m.windup) / 0.08);
          A.shR = [lerp(-3.3, -0.9, k), 0];
          A.shL = [lerp(-3.1, -1.0, k), 0];
          A.elR = A.elL = -0.1;
        }
      } else if (m.id === 'bucket') {
        // 由下往上拋
        const p = smooth(t / m.windup);
        A.shR = [lerp(0.9, -2.0, p), 0];
        A.elR = lerp(-0.2, -0.4, p);
      } else if (m.id === 'chair') {
        // 雙手舉過頭再往前丟
        const p = t < m.windup ? smooth(t / m.windup) : 1;
        const thr = t < m.windup ? 0 : smooth((t - m.windup) / 0.12);
        A.shR = [lerp(-1.2, -3.2, p) + thr * 1.4, 0.15];
        A.shL = [lerp(-1.2, -3.2, p) + thr * 1.4, -0.15];
        A.elR = A.elL = -0.3;
      }
    }
    if ((this.powerUp > 0 || this.thrust > 0) && !a) {
      // 集氣：雙手收到身側合成一個碗（手心之間是光球），蹲低、全身發抖；
      // 推出：雙手往前伸直、手掌張開對準對手
      const k = smooth(this.thrust);
      A.shL = [lerp(0.35, -1.5, k), lerp(0.45, 0.12, k)];
      A.shR = [lerp(0.25, -1.5, k), lerp(0.25, -0.12, k)];
      A.elL = A.elR = lerp(-1.25, 0, k);
      L.body.rotation.z = Math.sin(this.bob * 60) * 0.035 * Math.max(this.powerUp, this.thrust);
      L.root.position.y -= 0.35 * Math.max(this.powerUp, k);
      open = true;
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
    L.legL.rotation.z = L.legR.rotation.z = 0;
    if (spinLeg) {
      // 後腳往外抬起，隨身體轉圈掃過
      const back = frontR ? L.legL : L.legR;
      back.rotation.z = (frontR ? -1 : 1) * spinLeg;
      back.rotation.x = 0;
    }
    if (fly) {
      // 前腳踢直、後腳縮起
      const f = Math.min(1, fly);
      const fl = frontR ? L.legR : L.legL;
      const bl = frontR ? L.legL : L.legR;
      fl.rotation.x = lerp(fl.rotation.x, -1.5, f);
      bl.rotation.x = lerp(bl.rotation.x, 0.9, f);
      L.body.rotation.z = -0.25 * f * this.facing;
    }
    if (stomp !== null) {
      // 空中縮腿、落下時伸直往下踩
      const tuck = stomp < (a?.move.windup ?? 0) ? -0.9 : -0.1;
      L.legL.rotation.x = tuck;
      L.legR.rotation.x = tuck + 0.3;
    }
    if (downK) {
      // 跌坐：雙腿往前伸、屁股著地、雙手亂揮
      L.legL.rotation.x = L.legR.rotation.x = -1.45 * downK;
      L.root.position.y -= 1.55 * downK;
      const flail = Math.sin(this.bob * 18) * 0.35;
      A.shL = [-2.3 + flail, -0.5];
      A.shR = [-2.3 - flail, 0.5];
      A.elL = A.elR = -0.4;
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
    const beamHands = this.powerUp > 0 || this.thrust > 0;
    for (const [g, side] of [[L.gloveL, 'L'], [L.gloveR, 'R']] as const) {
      const o = open && (beamHands || openArm === side);
      g.scale.set(o ? 0.5 : 1, o ? 1.35 : 1.05, o ? 1.2 : 1.1);
    }
    // 起身後無敵：閃爍
    L.root.visible = !this.hidden && !(this.invuln > 0 && this.stun <= 0 && Math.floor(this.bob * 12) % 2 === 0);
    // 手上的武器：棍棒、鐵錘整招都拿著；投擲物出手後就不在手上
    const id = a?.move.id;
    const before = !!a && a.t < a.move.windup;
    this.held.shoe.visible = id === 'shoe' && before;
    this.held.bucket.visible = id === 'bucket' && before;
    this.held.chair.visible = id === 'chair' && before;
    this.held.club.visible = id === 'club';
    this.held.hammer.visible = id === 'hammer';
    if (id === 'hammer' && a) {
      // 蓄力提示：錘頭越來越大
      const head = this.held.hammer.userData.head as Object3D;
      head.scale.setScalar(a.t < a.move.windup ? lerp(1, PLAYER.hammerAnim.grow, a.t / a.move.windup) : 1);
    }
  }
}
