import { describe, expect, it } from 'vitest';
import { DIALOGUE } from '../../src/config/dialogue.config';
import { DialogueDirector, minShowTime } from '../../src/game/dialogue/director';

const run = (d: DialogueDirector, from: number, to: number, chatter = false, live = true) => {
  const ev = [];
  for (let t = from; t < to; t += 1 / 60) ev.push(...d.update(t, chatter, live, 1 / 60).map((e) => ({ ...e, t })));
  return ev;
};

describe('木偶對話', () => {
  it('最短顯示時間＝1.2 秒＋每字 0.05 秒', () => {
    expect(minShowTime('對不起！')).toBeCloseTo(1.2 + 4 * 0.05);
  });
  it('開場挑釁：依序說出每則 B 一次，然後結束', () => {
    const d = new DialogueDirector(['第一句', '第二句'], []);
    const ev = [...d.startTaunt(0), ...run(d, 0, 10, false, false)];
    const shows = ev.filter((e) => e.type === 'show') as { text: string }[];
    expect(shows.map((s) => s.text)).toEqual(['第一句', '第二句']);
    expect(ev.filter((e) => e.type === 'tauntDone')).toHaveLength(1);
  });
  it('沒有 B：開場挑釁立刻結束', () => {
    const d = new DialogueDirector([], []);
    expect(d.startTaunt(0).some((e) => e.type === 'tauntDone')).toBe(true);
  });
  it('戰鬥中賤話預設關：不會主動說 B', () => {
    const d = new DialogueDirector(['賤話'], []);
    d.startTaunt(0);
    run(d, 0, 3, false, false);
    expect(run(d, 3, 40, false).filter((e) => e.type === 'show')).toHaveLength(0);
  });
  it('開啟後每 6～10 秒說一則、不連續重複', () => {
    const d = new DialogueDirector(['甲', '乙'], [], () => 0.5);
    d.startTaunt(0);
    run(d, 0, 5, false, false);
    const shows = run(d, 5, 60, true).filter((e) => e.type === 'show') as { text: string; t: number }[];
    expect(shows.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < shows.length; i++) expect(shows[i].text).not.toBe(shows[i - 1].text);
    expect(shows[0].t - 5).toBeGreaterThanOrEqual(DIALOGUE.chatterMin - 0.1);
  });
  it('B 顯示時被打中：碎成星星並加分，接著顯示 D；同一則 B 只能打碎一次且之後不再說', () => {
    const d = new DialogueDirector(['賤話'], ['不是你的錯'], () => 0);
    d.startTaunt(0);
    run(d, 0, 5, false, false);
    const ev = run(d, 5, 20, true);
    const t0 = (ev.find((e) => e.type === 'show') as { t: number }).t;
    const hit = d.onHit(t0 + 0.2);
    expect(hit).toEqual([{ type: 'shatter', bonus: true }]);
    const after = run(d, t0 + 0.2, t0 + 2);
    expect(after.find((e) => e.type === 'show')).toMatchObject({ text: '不是你的錯', kind: 'D' });
    // 之後賤話池已空，不再說 B
    expect(run(d, t0 + 2, t0 + 40, true).filter((e) => e.type === 'show' && (e as { kind: string }).kind === 'B')).toHaveLength(0);
  });
  it('D 顯示中再被打中：不換句，只抖動', () => {
    const d = new DialogueDirector([], ['甲', '乙'], () => 0);
    d.startTaunt(0);
    const first = d.onHit(1);
    expect(first[0]).toMatchObject({ type: 'show', kind: 'D' });
    expect(d.onHit(1.3)).toEqual([{ type: 'shake' }]);
    // 顯示時間過後再打：換一句不同的
    run(d, 1.3, 4);
    const next = d.onHit(4.5)[0] as { text: string };
    expect(next.text).not.toBe((first[0] as { text: string }).text);
  });
  it('沒有 D 時使用預設句', () => {
    const d = new DialogueDirector([], []);
    d.startTaunt(0);
    const e = d.onHit(1)[0] as { text: string };
    expect(DIALOGUE.defaultD).toContain(e.text);
  });
});
