import { describe, expect, it } from 'vitest';
import { EVENTS } from '../../src/config/round.config';
import { MiniEvents, planMinute, type MiniEvent } from '../../src/game/events/miniEvents';

const timeline = (ev: MiniEvents, to: number) => {
  const starts: { t: number; e: MiniEvent }[] = [];
  const on: Record<MiniEvent, number> = { fever: 0, shoe: 0, bounce: 0 };
  const dt = 0.05;
  for (let t = 0; t < to; t += dt) {
    const r = ev.update(t);
    r.started.forEach((e) => starts.push({ t, e }));
    r.active.forEach((e) => (on[e] += dt));
  }
  return { starts, on };
};

describe('小型活動', () => {
  it('每一分鐘的第 15～40 秒是狂熱時間', () => {
    const ev = new MiniEvents(() => 0.99);
    expect(ev.update(14).active.has('fever')).toBe(false);
    expect(ev.update(15.1).active.has('fever')).toBe(true);
    expect(ev.update(39.9).active.has('fever')).toBe(true);
    expect(ev.update(40.1).active.has('fever')).toBe(false);
    expect(ev.update(75.5).active.has('fever')).toBe(true);
  });
  it('鞋子時間 10 秒、彈墊時間 15 秒，每分鐘各最多一次，開始時只通知一次', () => {
    const ev = new MiniEvents(() => 0.3);
    const { starts, on } = timeline(ev, 120);
    expect(starts.filter((s) => s.e === 'shoe').length).toBe(2);
    expect(starts.filter((s) => s.e === 'bounce').length).toBe(2);
    expect(starts.filter((s) => s.e === 'fever').length).toBe(2);
    expect(on.shoe).toBeCloseTo(2 * EVENTS.shoe.duration, 0);
    expect(on.bounce).toBeCloseTo(2 * EVENTS.bounce.duration, 0);
  });
  it('都在第 45 秒（問致命一擊）之前結束', () => {
    for (let i = 0; i < 50; i++) {
      const p = planMinute(Math.random);
      if (p.shoe !== null) expect(p.shoe + EVENTS.shoe.duration).toBeLessThanOrEqual(45);
      if (p.bounce !== null) expect(p.bounce + EVENTS.bounce.duration).toBeLessThanOrEqual(45);
    }
  });
  it('機率沒抽中時不出現', () => {
    const ev = new MiniEvents(() => 0.95);
    const { starts } = timeline(ev, 60);
    expect(starts.map((s) => s.e)).toEqual(['fever']);
  });
  it('停止後清空進行中的活動', () => {
    const ev = new MiniEvents(() => 0.3);
    ev.update(20);
    expect(ev.current).toContain('fever');
    ev.stop();
    expect(ev.current).toEqual([]);
  });
});
