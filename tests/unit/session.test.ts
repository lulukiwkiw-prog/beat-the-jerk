import { describe, expect, it } from 'vitest';
import { emptySession, enabledB, filledD, isWantedValid } from '../../src/state/session';

describe('通緝單資料', () => {
  it('預設 B 3 欄、D 1 欄、稱謂你／他', () => {
    const s = emptySession();
    expect(s.b).toHaveLength(3);
    expect(s.d).toHaveLength(1);
    expect([s.self, s.other]).toEqual(['你', '他']);
  });
  it('A 只有空白時不合法', () => {
    expect(isWantedValid({ ...emptySession(), a: '   ' })).toBe(false);
    expect(isWantedValid({ ...emptySession(), a: '他' })).toBe(true);
  });
  it('啟用的 B：忽略空白欄，只取勾選戰鬥中出現的', () => {
    const s = emptySession();
    s.b = [
      { id: 1, text: '第一句', inBattle: true },
      { id: 2, text: '  ', inBattle: true },
      { id: 3, text: '第三句', inBattle: false },
    ];
    expect(enabledB(s)).toEqual(['第一句']);
  });
  it('D 忽略空白欄', () => {
    const s = emptySession();
    s.d = [{ id: 1, text: '' }, { id: 2, text: '不是你的錯' }];
    expect(filledD(s)).toEqual(['不是你的錯']);
  });
});
