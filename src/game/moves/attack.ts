import { MOVES, type MoveDef, type MoveId } from '../../config/moves.config';

export interface ActiveAttack {
  move: MoveDef;
  /** 本回合的出招序號（產生唯一 hitId 用） */
  seq: number;
  t: number;
  /** 已處理的判定段數 */
  done: number;
  facing: 1 | -1;
}

export type AttackEvent = { kind: 'check'; segment: number } | { kind: 'throw' };

export function startAttack(id: MoveId, seq: number, facing: 1 | -1): ActiveAttack {
  return { move: MOVES[id], seq, t: 0, done: 0, facing };
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
  } else if (a.done === 0 && a.t >= m.windup) {
    a.done = 1;
    ev.push({ kind: 'throw' });
  }
  return ev;
}

export function attackFinished(a: ActiveAttack): boolean {
  return a.t >= a.move.duration;
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
