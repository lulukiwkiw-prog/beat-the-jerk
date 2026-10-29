import { describe, expect, it } from 'vitest';
import { EASY_AI } from '../../src/config/round.config';
import { EasyAI } from '../../src/game/enemy/easyAI';

describe('簡單模式木偶', () => {
  it('每 8～12 秒出拳，預備 0.8 秒', () => {
    const ai = new EasyAI(() => 0.5);
    const log: { t: number; type: string }[] = [];
    for (let t = 0; t < 30; t += 1 / 60) for (const e of ai.update(1 / 60, true, -1)) log.push({ t, type: e.type });
    const windups = log.filter((e) => e.type === 'windup');
    const strikes = log.filter((e) => e.type === 'strike');
    expect(windups[0].t).toBeGreaterThanOrEqual(EASY_AI.intervalMin - 0.05);
    expect(windups[0].t).toBeLessThanOrEqual(EASY_AI.intervalMax);
    expect(strikes[0].t - windups[0].t).toBeCloseTo(EASY_AI.windup, 1);
    expect(windups.length).toBeGreaterThanOrEqual(2);
  });
  it('不能行動時（噴飛、回合外）不出拳', () => {
    const ai = new EasyAI(() => 0);
    for (let t = 0; t < 30; t += 1 / 60) expect(ai.update(1 / 60, false, 1).filter((e) => e.type === 'strike')).toHaveLength(0);
  });
  it('被打中時取消預備動作', () => {
    const ai = new EasyAI(() => 0);
    for (let t = 0; t < 8.1; t += 1 / 60) ai.update(1 / 60, true, 1);
    expect(ai.phase).toBe('windup');
    ai.interrupt();
    expect(ai.phase).toBe('idle');
  });
});
