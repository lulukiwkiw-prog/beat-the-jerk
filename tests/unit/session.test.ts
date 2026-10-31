import { describe, expect, it } from 'vitest';
import { emptySession, filledD } from '../../src/state/session';

describe('通緝單資料', () => {
  it('沒有 B 欄；D 預設 1 欄、稱謂你／他', () => {
    const s = emptySession();
    expect('b' in s).toBe(false);
    expect(s.d).toHaveLength(1);
    expect([s.self, s.other]).toEqual(['你', '他']);
  });
  it('一開始還沒選要不要記錄心情；每一題都可以不填', () => {
    const s = emptySession();
    expect(s.writeMood).toBeNull();
    expect(s.a).toBe('');
  });
  it('D 忽略空白欄', () => {
    const s = emptySession();
    s.d = [{ id: 1, text: '' }, { id: 2, text: '不是你的錯' }];
    expect(filledD(s)).toEqual(['不是你的錯']);
  });
});
