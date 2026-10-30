import { describe, expect, it } from 'vitest';
import { devRoundOverride, RoundClock } from '../../src/game/engine/roundClock';

const fake = () => {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe('回合計時', () => {
  it('以實際經過時間累計', () => {
    const f = fake();
    const c = new RoundClock(30, f.now);
    c.start();
    f.advance(10_000);
    expect(c.remaining()).toBeCloseTo(20);
  });
  it('暫停時停止，繼續後接著算', () => {
    const f = fake();
    const c = new RoundClock(30, f.now);
    c.start();
    f.advance(5_000);
    c.pause();
    f.advance(60_000);
    expect(c.remaining()).toBeCloseTo(25);
    c.resume();
    f.advance(5_000);
    expect(c.remaining()).toBeCloseTo(20);
  });
  it('繼續打：延長 60 秒，已用時間不變', () => {
    const f = fake();
    const c = new RoundClock(180, f.now);
    c.start();
    f.advance(165_000);
    c.pause();
    c.extend(60);
    expect(c.lengthSec).toBe(240);
    expect(c.remaining()).toBeCloseTo(75);
    c.resume();
    f.advance(60_000);
    expect(c.remaining()).toBeCloseTo(15);
  });
  it('時間到之後不能再延長', () => {
    const f = fake();
    const c = new RoundClock(10, f.now);
    c.start();
    f.advance(11_000);
    expect(c.checkExpired()).toBe(true);
    c.extend(60);
    expect(c.lengthSec).toBe(10);
  });
  it('時間到只觸發一次', () => {
    const f = fake();
    const c = new RoundClock(3, f.now);
    c.start();
    f.advance(2_000);
    expect(c.checkExpired()).toBe(false);
    f.advance(2_000);
    expect(c.checkExpired()).toBe(true);
    for (let i = 0; i < 5; i++) expect(c.checkExpired()).toBe(false);
    expect(c.remaining()).toBe(0);
  });
  it('開始前不計時', () => {
    const f = fake();
    const c = new RoundClock(10, f.now);
    f.advance(5_000);
    expect(c.remaining()).toBe(10);
  });
  it('網址 ?round=30', () => {
    expect(devRoundOverride('?round=30', 5, 600)).toBe(30);
    expect(devRoundOverride('', 5, 600)).toBeNull();
    expect(devRoundOverride('?round=abc', 5, 600)).toBeNull();
    expect(devRoundOverride('?round=1', 5, 600)).toBe(5);
  });
});
