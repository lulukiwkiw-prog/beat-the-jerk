import { describe, expect, it } from 'vitest';
import { ScoreLedger } from '../../src/game/scoring/ScoreLedger';

const hit = (l: ScoreLedger, hitId: string, at: number, move: 'jab' | 'uppercut' | 'slap' | 'shoe' = 'jab', base = 10) =>
  l.resolve({ hitId, move, base, at });

describe('計分帳本', () => {
  it('同一 hitId 只計分一次（逐幀重複檢查不重複加分）', () => {
    const l = new ScoreLedger();
    expect(hit(l, 'r1:1:0', 0).scored).toBe(true);
    for (let i = 0; i < 30; i++) expect(hit(l, 'r1:1:0', i / 60).scored).toBe(false);
    expect(l.score).toBe(10);
    expect(l.combo).toBe(1);
  });
  it('不同段數是不同 hitId，各自計分', () => {
    const l = new ScoreLedger();
    for (let s = 0; s < 4; s++) hit(l, `r1:1:${s}`, s * 0.09);
    expect(l.score).toBe(40);
    expect(l.combo).toBe(4);
  });
  it('2 秒內持續命中延續連擊，逾時歸零', () => {
    const l = new ScoreLedger();
    hit(l, 'a', 0);
    hit(l, 'b', 1.9);
    expect(l.combo).toBe(2);
    l.tick(3.95);
    expect(l.combo).toBe(0);
    hit(l, 'c', 4);
    expect(l.combo).toBe(1);
    expect(l.maxCombo).toBe(2);
  });
  it('超過 2 秒才命中：連擊重新從 1 開始', () => {
    const l = new ScoreLedger();
    hit(l, 'a', 0);
    hit(l, 'b', 2.5);
    expect(l.combo).toBe(1);
  });
  it('每達 10 連擊 +50', () => {
    const l = new ScoreLedger();
    let milestone = 0;
    for (let i = 0; i < 20; i++) if (hit(l, `h${i}`, i * 0.1).comboMilestone) milestone++;
    expect(milestone).toBe(2);
    expect(l.score).toBe(20 * 10 + 2 * 50);
  });
  it('3 秒內命中 3 種不同招式 +40，觸發後重新計算', () => {
    const l = new ScoreLedger();
    hit(l, 'a', 0, 'jab', 10);
    hit(l, 'b', 1, 'slap', 15);
    const r = hit(l, 'c', 2, 'shoe', 15);
    expect(r.lines.some((x) => x.label === '招式組合！' && x.points === 40)).toBe(true);
    expect(l.score).toBe(10 + 15 + 15 + 40);
    // 剛觸發過，再打一種不會馬上又給
    const r2 = hit(l, 'd', 2.2, 'uppercut', 25);
    expect(r2.lines.some((x) => x.label === '招式組合！')).toBe(false);
  });
  it('3 種招式超過 3 秒不算組合', () => {
    const l = new ScoreLedger();
    hit(l, 'a', 0, 'jab');
    hit(l, 'b', 1.5, 'slap');
    hit(l, 'c', 3.5, 'shoe');
    expect(l.score).toBe(30);
  });
  it('空中追擊加分', () => {
    const l = new ScoreLedger();
    const r = l.resolve({ hitId: 'x', move: 'uppercut', base: 25, at: 0, extra: { points: 5, label: '空中追擊' } });
    expect(r.lines).toEqual([{ points: 25, label: '' }, { points: 5, label: '空中追擊' }]);
    expect(l.score).toBe(30);
  });
});
