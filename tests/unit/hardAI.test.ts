import { describe, expect, it } from 'vitest';
import { HARD_AI } from '../../src/config/round.config';
import { HardAI, type HardAiInput } from '../../src/game/enemy/hardAI';

const near: HardAiInput = { canAct: true, playerSide: -1, dist: 2.5, playerVulnerable: true, reach: 3.6 };
const run = (ai: HardAI, secs: number, input: HardAiInput | ((t: number) => HardAiInput)) => {
  const log: { t: number; type: string }[] = [];
  for (let t = 0; t < secs; t += 1 / 60) {
    const i = typeof input === 'function' ? input(t) : input;
    for (const e of ai.update(1 / 60, i)) log.push({ t, type: e.type });
  }
  return log;
};

describe('困難模式木偶', () => {
  it('出拳預備 0.5 秒，兩次出拳至少間隔 2 秒', () => {
    const ai = new HardAI(() => 0);
    const log = run(ai, 20, near);
    const w = log.filter((e) => e.type === 'windup');
    const s = log.filter((e) => e.type === 'strike');
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s[0].t - w[0].t).toBeCloseTo(HARD_AI.windup, 1);
    for (let i = 1; i < w.length; i++) expect(w[i].t - s[i - 1].t).toBeGreaterThanOrEqual(HARD_AI.cooldown);
  });
  it('太遠時往玩家走，太近時退開；打得到才出拳', () => {
    const ai = new HardAI(() => 0.99);
    ai.update(1 / 60, { ...near, dist: 8, playerSide: 1 });
    expect(ai.move).toBe(1);
    ai.update(1 / 60, { ...near, dist: 1.2, playerSide: 1 });
    expect(ai.move).toBe(-1);
    const far = run(new HardAI(() => 0), 10, { ...near, dist: 8 });
    expect(far.filter((e) => e.type === 'windup')).toHaveLength(0);
  });
  it('玩家倒地或無敵中不出拳（不連續壓制）', () => {
    const log = run(new HardAI(() => 0), 15, { ...near, playerVulnerable: false });
    expect(log.filter((e) => e.type === 'windup')).toHaveLength(0);
  });
  it('打中玩家後多休息，下一拳至少隔 2＋2.5 秒', () => {
    const ai = new HardAI(() => 0);
    const log = run(ai, 4, near);
    const s0 = log.find((e) => e.type === 'strike')!;
    ai.restAfterHit();
    const rest = run(ai, 10, near);
    const nextW = rest.find((e) => e.type === 'windup')!;
    expect(nextW.t + 4 - s0.t).toBeGreaterThanOrEqual(HARD_AI.cooldown + HARD_AI.afterHitRest - 0.5);
  });
  it('閃避後至少 3 秒內不再閃避', () => {
    const ai = new HardAI(() => 0);
    expect(ai.tryDodge()).toBe(true);
    expect(ai.tryDodge()).toBe(false);
    run(ai, HARD_AI.dodgeCooldown - 0.2, { ...near, playerVulnerable: false });
    expect(ai.tryDodge()).toBe(false);
    run(ai, 0.4, { ...near, playerVulnerable: false });
    expect(ai.tryDodge()).toBe(true);
  });
  it('只是偶爾閃避（機率）', () => {
    const ai = new HardAI(() => 0.9);
    expect(ai.tryDodge()).toBe(false);
  });
  it('不能行動時（噴飛、暈眩、回合外）不走也不出拳', () => {
    const ai = new HardAI(() => 0);
    const log = run(ai, 10, { ...near, canAct: false, dist: 8 });
    expect(log.filter((e) => e.type === 'windup')).toHaveLength(0);
    expect(ai.move).toBe(0);
  });
});
