import { describe, expect, it } from 'vitest';
import { H, MOVE_SETS, MOVES } from '../../src/config/moves.config';
import { attackFinished, dashProgress, hitIdOf, inMeleeRange, lobVelocity, startAttack, stepAttack } from '../../src/game/moves/attack';
import { ScoreLedger } from '../../src/game/scoring/ScoreLedger';

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
  it('每招冷卻都不同，前搖＋冷卻的組合也不同', () => {
    const ids = Object.keys(MOVES) as (keyof typeof MOVES)[];
    expect(new Set(ids.map((i) => MOVES[i].cooldown)).size).toBe(ids.length);
    expect(new Set(ids.map((i) => `${MOVES[i].windup}/${MOVES[i].cooldown}`)).size).toBe(ids.length);
  });
  it('十招齊全（加上踩扁）：徒手 6 招、武器 5 招，數值照規格', () => {
    expect(MOVE_SETS.hand).toEqual(['jab', 'spin', 'uppercut', 'flykick', 'slap', 'stomp']);
    expect(MOVE_SETS.weapon).toEqual(['club', 'bucket', 'chair', 'shoe', 'hammer']);
    const spec: [keyof typeof MOVES, number, number, number[]][] = [
      ['spin', 0.2, 1.2, [30]],
      ['flykick', 0.18, 1.5, [30]],
      ['club', 0.15, 1.4, [15, 15, 25]],
      ['bucket', 0.25, 2.5, [35]],
      ['chair', 0.4, 6, [50]],
      ['hammer', 0.6, 4, [60]],
    ];
    for (const [id, w, cd, sc] of spec) {
      expect(MOVES[id].windup).toBe(w);
      expect(MOVES[id].cooldown).toBe(cd);
      expect(MOVES[id].score).toEqual(sc);
    }
  });
  it('棍棒連打：3 段，間隔 0.18 秒', () => {
    const a = startAttack('club', 1, 1);
    const times: number[] = [];
    let t = 0;
    while (!attackFinished(a)) {
      t += 1 / 60;
      for (const e of stepAttack(a, 1 / 60)) if (e.kind === 'check') times.push(t);
    }
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeCloseTo(0.18, 1);
    expect(times[2] - times[1]).toBeCloseTo(0.18, 1);
  });
  it('迴旋踢身後 0.3H 也打得到', () => {
    const m = MOVES.spin;
    if (m.type !== 'melee') throw new Error();
    expect(m.backRange).toBe(0.3);
    expect(m.range).toBe(1.0);
  });
  it('飛踢：突進 0.25 秒內每步都判定，撞到後停止判定，最後送出結束事件', () => {
    const a = startAttack('flykick', 1, 1);
    let dash = 0;
    let end = 0;
    while (!attackFinished(a)) {
      for (const e of stepAttack(a, 1 / 60)) {
        if (e.kind === 'dash') dash++;
        if (e.kind === 'dashEnd') end++;
      }
    }
    expect(dash).toBeGreaterThanOrEqual(14);
    expect(dash).toBeLessThanOrEqual(17);
    expect(end).toBe(1);
    const b = startAttack('flykick', 2, 1);
    let after = 0;
    for (let i = 0; i < 60; i++) {
      const ev = stepAttack(b, 1 / 60);
      if (ev.some((e) => e.kind === 'dash')) {
        if (b.landed) after++;
        b.landed = true;
      }
    }
    expect(after).toBe(0);
    expect(dashProgress(b)).toBe(1);
  });
  it('飛踢逐幀判定同一 hitId，帳本只結算一次', () => {
    const L = new ScoreLedger();
    const hitId = hitIdOf(1, 5, 0);
    const scored = [0, 1, 2, 3, 4].map((i) => L.resolve({ hitId, move: 'flykick', base: 30, at: i / 60 }).scored);
    expect(scored).toEqual([true, false, false, false, false]);
    expect(L.score).toBe(30);
  });
  it('水桶、桌椅：前搖後投出一次', () => {
    for (const id of ['bucket', 'chair'] as const) {
      const a = startAttack(id, 1, 1);
      const ev = [];
      for (let i = 0; i < 60; i++) ev.push(...stepAttack(a, 1 / 60));
      expect(ev).toEqual([{ kind: 'throw' }]);
    }
  });
  it('鐵錘：蓄力 0.6 秒後才判定', () => {
    const a = startAttack('hammer', 1, 1);
    let t = 0;
    let at = -1;
    while (at < 0 && t < 2) {
      t += 1 / 60;
      if (stepAttack(a, 1 / 60).length) at = t;
    }
    expect(at).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(at).toBeLessThan(0.6 + 1 / 60 + 1e-9);
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

describe('拋物線投射物', () => {
  const g = 26;
  const sim = (vx: number, vy: number, x0: number, y0: number, T: number) => {
    let x = x0;
    let y = y0;
    let v = vy;
    const dt = 1 / 600;
    for (let t = 0; t < T - 1e-9; t += dt) {
      x += vx * dt;
      v -= g * dt;
      y += v * dt;
    }
    return { x, y };
  };
  it('飛行時間到時落在瞄準點', () => {
    const { vx, vy } = lobVelocity({ fromX: -2, fromY: 3.4, targetX: 4, aimY: 3.9, dir: 1, minD: 1, maxD: 20, T: 0.75, g });
    const end = sim(vx, vy, -2, 3.4, 0.75);
    expect(end.x).toBeCloseTo(4, 1);
    expect(end.y).toBeCloseTo(3.9, 1);
  });
  it('水平距離限制在最小～最大之間，方向跟著面向', () => {
    const far = lobVelocity({ fromX: 0, fromY: 3, targetX: 50, aimY: 3, dir: 1, minD: 1, maxD: 10, T: 1, g });
    expect(far.vx).toBeCloseTo(10);
    const near = lobVelocity({ fromX: 0, fromY: 3, targetX: -0.2, aimY: 3, dir: -1, minD: 2, maxD: 10, T: 1, g });
    expect(near.vx).toBeCloseTo(-2);
  });
});
