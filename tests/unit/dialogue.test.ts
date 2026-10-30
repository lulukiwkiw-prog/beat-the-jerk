import { describe, expect, it } from 'vitest';
import { DIALOGUE } from '../../src/config/dialogue.config';
import { DialogueDirector, minShowTime } from '../../src/game/dialogue/director';

const run = (d: DialogueDirector, from: number, to: number) => {
  const ev = [];
  for (let t = from; t < to; t += 1 / 60) ev.push(...d.update(t).map((e) => ({ ...e, t })));
  return ev;
};

describe('木偶對話', () => {
  it('最短顯示時間＝1.2 秒＋每字 0.05 秒', () => {
    expect(minShowTime('對不起！')).toBeCloseTo(1.2 + 4 * 0.05);
  });
  it('沒被打中時不會主動說話', () => {
    const d = new DialogueDirector(['不是你的錯']);
    expect(run(d, 0, 40).filter((e) => e.type === 'show')).toHaveLength(0);
  });
  it('被打中說 D，時間到收起', () => {
    const d = new DialogueDirector(['不是你的錯']);
    expect(d.onHit(1)).toEqual([{ type: 'show', text: '不是你的錯' }]);
    const ev = run(d, 1, 1 + minShowTime('不是你的錯') + 1);
    expect(ev.filter((e) => e.type === 'hide')).toHaveLength(1);
  });
  it('D 顯示中再被打中：不換句，只抖動', () => {
    const d = new DialogueDirector(['甲', '乙'], () => 0);
    const first = d.onHit(1);
    expect(first[0]).toMatchObject({ type: 'show' });
    expect(d.onHit(1.3)).toEqual([{ type: 'shake' }]);
    // 顯示時間過後再打：換一句不同的
    run(d, 1.3, 4);
    const next = d.onHit(4.5)[0] as { text: string };
    expect(next.text).not.toBe((first[0] as { text: string }).text);
  });
  it('沒有 D 時使用預設句', () => {
    const d = new DialogueDirector([]);
    const e = d.onHit(1)[0] as { text: string };
    expect(DIALOGUE.defaultD).toContain(e.text);
  });
});
