import { HARD_AI } from '../../config/round.config';
import type { AiEvent, AiPhase } from './easyAI';

export interface HardAiInput {
  /** 噴飛、浮空、暈眩、回合外等不能行動 */
  canAct: boolean;
  /** 玩家所在方向與中心距離 */
  playerSide: -1 | 1;
  dist: number;
  /** 玩家倒地或無敵中：不出拳（不連續壓制） */
  playerVulnerable: boolean;
  /** 拳頭打得到的中心距離 */
  reach: number;
}

/**
 * 困難模式木偶：左右移動、接近、出拳（預備 0.5 秒、冷卻至少 2 秒），
 * 偶爾閃避（閃避後至少 3 秒內不再閃避）。
 */
export class HardAI {
  phase: AiPhase = 'idle';
  side: -1 | 1 = -1;
  /** 想走的方向（-1、0、1） */
  move: -1 | 0 | 1 = 0;
  private t = 0;
  private cd: number;
  private pause = 0;
  private dodgeCd = 0;

  constructor(private readonly rand: () => number = Math.random) {
    this.cd = this.nextCooldown();
  }

  private nextCooldown() {
    return HARD_AI.cooldown + this.rand() * HARD_AI.cooldownRandom;
  }

  reset() {
    this.phase = 'idle';
    this.move = 0;
    this.t = this.pause = this.dodgeCd = 0;
    this.cd = this.nextCooldown();
  }

  /** 被打中時取消出拳（冷卻重新計算，仍至少 2 秒）。 */
  interrupt() {
    if (this.phase !== 'idle') this.phase = 'idle';
    this.cd = Math.max(this.cd, HARD_AI.cooldown);
  }

  /** 打中玩家後多休息一下，避免連續壓制 */
  restAfterHit() {
    this.cd = Math.max(this.cd, HARD_AI.cooldown + HARD_AI.afterHitRest);
  }

  /** 玩家出招時決定要不要閃：閃避後至少 3 秒不再閃。回傳 true＝閃。 */
  tryDodge(): boolean {
    if (this.dodgeCd > 0 || this.phase !== 'idle') return false;
    if (this.rand() >= HARD_AI.dodgeChance) return false;
    this.dodgeCd = HARD_AI.dodgeCooldown;
    return true;
  }

  get canDodgeAgainIn() {
    return this.dodgeCd;
  }

  update(dt: number, i: HardAiInput): AiEvent[] {
    const ev: AiEvent[] = [];
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.cd = Math.max(0, this.cd - dt);
    if (!i.canAct) {
      this.move = 0;
      if (this.phase !== 'idle') {
        this.phase = 'idle';
        ev.push({ type: 'recover' });
      }
      return ev;
    }
    if (this.phase !== 'idle') {
      this.move = 0;
      this.t -= dt;
      if (this.t > 0) return ev;
      if (this.phase === 'windup') {
        this.phase = 'punch';
        this.t = HARD_AI.punchTime;
        ev.push({ type: 'strike', side: this.side });
      } else {
        this.phase = 'idle';
        this.cd = this.nextCooldown();
        ev.push({ type: 'recover' });
      }
      return ev;
    }
    // 走位：保持一點距離，太遠就靠近、太近就退開，偶爾停一下
    if (this.pause > 0) {
      this.pause -= dt;
      this.move = 0;
    } else if (i.dist > HARD_AI.preferDist) this.move = i.playerSide;
    else if (i.dist < HARD_AI.tooClose) this.move = (-i.playerSide) as -1 | 1;
    else {
      this.move = 0;
      if (this.rand() < HARD_AI.pauseChance * dt) this.pause = HARD_AI.pauseMin + this.rand() * (HARD_AI.pauseMax - HARD_AI.pauseMin);
    }
    if (this.cd <= 0 && i.playerVulnerable && i.dist <= i.reach) {
      this.phase = 'windup';
      this.side = i.playerSide;
      this.t = HARD_AI.windup;
      this.move = 0;
      ev.push({ type: 'windup', side: this.side });
    }
    return ev;
  }
}
