import { describe, expect, it } from 'vitest';
import { applyLimit, charCount, fillPronouns } from '../../src/state/text';

describe('字數計算（字素）', () => {
  it('表情符號與組合字算 1 字', () => {
    expect(charCount('😡')).toBe(1);
    expect(charCount('👩‍👩‍👧')).toBe(1);
    expect(charCount('氣死😡')).toBe(3);
    expect(charCount('')).toBe(0);
  });
});

describe('字數上限', () => {
  it('未超過時原樣接受', () => {
    expect(applyLimit('ab', 'abc', 5)).toEqual({ value: 'abc', dropped: 0 });
  });
  it('已滿時再打字不會進去，也不會刪掉原內容', () => {
    expect(applyLimit('甲乙丙', '甲乙丙丁', 3)).toEqual({ value: '甲乙丙', dropped: 1 });
  });
  it('貼上超出時只放入能放的部分，並回報被擋下的字數', () => {
    expect(applyLimit('甲甲', '甲甲乙乙乙乙', 4)).toEqual({ value: '甲甲乙乙', dropped: 2 });
  });
  it('在中間貼上：不截斷後面已輸入的內容', () => {
    const r = applyLimit('頭尾', '頭ABCDE尾', 5);
    expect(r.value).toBe('頭ABC尾');
    expect(r.dropped).toBe(2);
  });
  it('選取取代：被取代的舊字釋出空間', () => {
    expect(applyLimit('甲乙丙', '甲XYZ丙', 4)).toEqual({ value: '甲XY丙', dropped: 1 });
  });
  it('表情符號不會被切成半個', () => {
    const r = applyLimit('', '😡👩‍👩‍👧😡', 2);
    expect(r.value).toBe('😡👩‍👩‍👧');
    expect(r.dropped).toBe(1);
  });
  it('A 300 字：剛好 300 字可接受', () => {
    const long = '爛'.repeat(300);
    expect(applyLimit('', long, 300).value).toBe(long);
    expect(applyLimit(long, long + '爛', 300).value).toBe(long);
  });
});

describe('稱謂替換', () => {
  it('替換 {你}、{他}', () => {
    expect(fillPronouns('我不應該那樣對{你}，{他}說', '妳', '她')).toBe('我不應該那樣對妳，她說');
  });
});
