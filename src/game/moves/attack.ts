import { MOVES, type MoveDef, type MoveId } from '../../config/moves.config';

export interface ActiveAttack {
  move: MoveDef;
  /** 本回合的出招序號（產生唯一 hitId 用） */
  seq: number;
  t: number;
  /** 已處理的判定段數 */
  done: number;
  facing: 1 | -1;
  /** 突進招式：本次是否已撞到（撞到後停止突進） */
  landed: boolean;
}

/** check＝近戰判定點；dash＝突進中的逐幀判定；dashEnd＝突進結束；throw＝投出 */
export type AttackEvent = { kind: 'check'; segment: number } | { kind: 'dash' } | { kind: 'dashEnd' } | { kind: 'throw' };

export function startAttack(id: MoveId, seq: number, facing: 1 | -1): ActiveAttack {
  return { move: MOVES[id], seq, t: 0, done: 0, facing, landed: false };
}

/** 推進出招時間，回傳這一步到達的判定時間點（每段只回傳一次）。 */
export function stepAttack(a: ActiveAttack, dt: number): AttackEvent[] {
  a.t += dt;
  const ev: AttackEvent[] = [];
  const m = a.move;
  if (m.type === 'melee') {
    while (a.done < m.hits && a.t >= m.windup + a.done * m.interval) {
      ev.push({ kind: 'check', segment: a.done });
      a.done++;
    }
  } else if (m.type === 'dash') {
    // 突進期間每一步都判定（同一 hitId，由帳本保證只結算一次）
    const end = m.windup + m.dashTime;
    if (a.done === 0 && a.t >= m.windup) {
      if (!a.landed) ev.push({ kind: 'dash' });
      if (a.t >= end) {
        a.done = 1;
        ev.push({ kind: 'dashEnd' });
      }
    }
  } else if (a.done === 0 && a.t >= m.windup) {
    a.done = 1;
    ev.push({ kind: 'throw' });
  }
  return ev;
}

export function attackFinished(a: ActiveAttack): boolean {
  return a.t >= a.move.duration;
}

/** 突進目前的進度（0～1），前搖中為 0。 */
export function dashProgress(a: ActiveAttack): number {
  const m = a.move;
  if (m.type !== 'dash') return 0;
  return Math.max(0, Math.min(1, (a.t - m.windup) / m.dashTime));
}

/**
 * 拋物線投射物的初速：瞄準 (targetX, aimY)，水平距離限制在 [minD, maxD]，
 * 飛行 T 秒落在瞄準點。
 */
export function lobVelocity(o: { fromX: number; fromY: number; targetX: number; aimY: number; dir: 1 | -1; minD: number; maxD: number; T: number; g: number }) {
  const d = Math.max(o.minD, Math.min(o.maxD, (o.targetX - o.fromX) * o.dir));
  const vx = (o.dir * d) / o.T;
  const vy = (o.aimY - o.fromY + 0.5 * o.g * o.T * o.T) / o.T;
  return { vx, vy };
}

export const hitIdOf = (round: number, seq: number, segment: number) => `r${round}:${seq}:${segment}`;

/**
 * 近戰範圍判定：玩家前緣到木偶最近邊緣的距離 ≤ range×H；
 * backRange>0 時身後也算（迴旋踢）。
 */
export function inMeleeRange(opts: {
  playerX: number;
  facing: 1 | -1;
  targetX: number;
  playerHalf: number;
  targetHalf: number;
  range: number;
  backRange: number;
  H: number;
}): boolean {
  const dx = (opts.targetX - opts.playerX) * opts.facing;
  const gap = Math.abs(dx) - (opts.playerHalf + opts.targetHalf);
  if (dx >= -0.1) return gap <= opts.range * opts.H;
  return opts.backRange > 0 && gap <= opts.backRange * opts.H;
}
