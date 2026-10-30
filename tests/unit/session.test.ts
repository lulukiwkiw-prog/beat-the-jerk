import { describe, expect, it } from 'vitest';
import { emptySession, filledD, isWantedValid } from '../../src/state/session';

describe('通緝單資料', () => {
  it('沒有 B 欄；D 預設 1 欄、稱謂你／他', () => {
    const s = emptySession();
    expect('b' in s).toBe(false);
    expect(s.d).toHaveLength(1);
    expect([s.self, s.other]).toEqual(['你', '他']);
  });
  it('A 只有空白時不合法', () => {
    expect(isWantedValid({ ...emptySession(), a: '   ' })).toBe(false);
    expect(isWantedValid({ ...emptySession(), a: '他' })).toBe(true);
  });
  it('D 忽略空白欄', () => {
    const s = emptySession();
    s.d = [{ id: 1, text: '' }, { id: 2, text: '不是你的錯' }];
    expect(filledD(s)).toEqual(['不是你的錯']);
  });
});
