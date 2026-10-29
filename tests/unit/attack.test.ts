import { describe, expect, it } from 'vitest';
import { H, MOVES } from '../../src/config/moves.config';
import { attackFinished, hitIdOf, inMeleeRange, startAttack, stepAttack } from '../../src/game/moves/attack';

describe('出招時間軸', () => {
  it('連環拳：前搖 0.08 秒後 4 段，間隔 0.09 秒，每段只觸發一次', () => {
    const a = startAttack('jab', 1, 1);
    const times: number[] = [];
    let t = 0;
    while (!attackFinished(a)) {
      t += 1 / 60;
      for (const e of stepAttack(a, 1 / 60)) if (e.kind === 'check') times.push(t);
    }
    expect(times).toHaveLength(4);
    const m = MOVES.jab;
    if (m.type !== 'melee') throw new Error();
    times.forEach((x, i) => expect(x).toBeGreaterThanOrEqual(m.windup + i * m.interval - 1e-9));
    times.forEach((x, i) => expect(x).toBeLessThan(m.windup + i * m.interval + 1 / 60 + 1e-9));
  });
  it('丟鞋子：前搖後投出一次', () => {
    const a = startAttack('shoe', 1, -1);
    const ev = [];
    for (let i = 0; i < 30; i++) ev.push(...stepAttack(a, 1 / 60));
    expect(ev).toEqual([{ kind: 'throw' }]);
  });
  it('每招前搖與冷卻都不同', () => {
    const ids = Object.keys(MOVES) as (keyof typeof MOVES)[];
    expect(new Set(ids.map((i) => MOVES[i].windup)).size).toBe(ids.length);
    expect(new Set(ids.map((i) => MOVES[i].cooldown)).size).toBe(ids.length);
  });
  it('hitId 依回合、出招序號、段數唯一', () => {
    expect(hitIdOf(1, 2, 3)).not.toBe(hitIdOf(2, 2, 3));
    expect(hitIdOf(1, 2, 3)).not.toBe(hitIdOf(1, 3, 2));
  });
});

describe('近戰範圍', () => {
  const base = { playerHalf: 0.7, targetHalf: 0.9, backRange: 0, H };
  it('前方距離內命中、超出落空', () => {
    const reach = 0.6 * H + 1.6;
    expect(inMeleeRange({ ...base, playerX: 0, facing: 1, targetX: reach - 0.01, range: 0.6 })).toBe(true);
    expect(inMeleeRange({ ...base, playerX: 0, facing: 1, targetX: reach + 0.01, range: 0.6 })).toBe(false);
  });
  it('背後打不到（沒有身後範圍的招式）', () => {
    expect(inMeleeRange({ ...base, playerX: 0, facing: 1, targetX: -1.5, range: 0.6 })).toBe(false);
  });
  it('有身後範圍的招式可打到背後', () => {
    expect(inMeleeRange({ ...base, playerX: 0, facing: 1, targetX: -2.5, range: 1, backRange: 0.3 })).toBe(true);
  });
});
