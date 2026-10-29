import { EASY_AI } from '../../config/round.config';

export type AiPhase = 'idle' | 'windup' | 'punch';
export type AiEvent = { type: 'windup'; side: -1 | 1 } | { type: 'strike'; side: -1 | 1 } | { type: 'recover' };

/**
 * 簡單模式木偶：不主動走動；每 8～12 秒出拳一次，預備動作 0.8 秒、明顯可見。
 */
export class EasyAI {
  phase: AiPhase = 'idle';
  side: -1 | 1 = -1;
  private t: number;

  constructor(private readonly rand: () => number = Math.random) {
    this.t = this.nextInterval();
  }

  private nextInterval() {
    return EASY_AI.intervalMin + this.rand() * (EASY_AI.intervalMax - EASY_AI.intervalMin);
  }

  reset() {
    this.phase = 'idle';
    this.t = this.nextInterval();
  }

  /** 被打中時取消出拳。 */
  interrupt() {
    if (this.phase !== 'idle') {
      this.phase = 'idle';
      this.t = Math.max(EASY_AI.resetAfterHit, this.nextInterval() * 0.5);
    }
  }

  /** canAct=false（噴飛、浮空、回合外）時不出拳。 */
  update(dt: number, canAct: boolean, playerSide: -1 | 1): AiEvent[] {
    const ev: AiEvent[] = [];
    if (!canAct) {
      if (this.phase !== 'idle') {
        this.phase = 'idle';
        ev.push({ type: 'recover' });
      }
      return ev;
    }
    this.t -= dt;
    if (this.t > 0) return ev;
    if (this.phase === 'idle') {
      this.phase = 'windup';
      this.side = playerSide;
      this.t = EASY_AI.windup;
      ev.push({ type: 'windup', side: this.side });
    } else if (this.phase === 'windup') {
      this.phase = 'punch';
      this.t = EASY_AI.punchTime;
      ev.push({ type: 'strike', side: this.side });
    } else {
      this.phase = 'idle';
      this.t = this.nextInterval();
      ev.push({ type: 'recover' });
    }
    return ev;
  }
}
