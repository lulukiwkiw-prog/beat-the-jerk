import { describe, expect, it } from 'vitest';
import { chooseBubbleSide, fitFontScale } from '../../src/ui/bubbleLayout';

const base = { gap: 14, edge: 6, maxFrac: 0.7 };

describe('對話泡泡位置', () => {
  it('優先放遠離玩家那一側', () => {
    expect(chooseBubbleSide({ ...base, screenWidth: 1000, headLeft: 450, headRight: 550, prefer: 'right' }).side).toBe('right');
  });
  it('該側空間不足時改到另一側', () => {
    expect(chooseBubbleSide({ ...base, screenWidth: 1000, headLeft: 700, headRight: 900, prefer: 'right' }).side).toBe('left');
  });
  it('寬度不超過畫面 70%，也不超過該側可用寬度（不蓋住身體）', () => {
    const r = chooseBubbleSide({ ...base, screenWidth: 390, headLeft: 150, headRight: 240, prefer: 'right' });
    expect(r.maxWidth).toBeLessThanOrEqual(390 * 0.7);
    expect(r.maxWidth).toBeLessThanOrEqual(390 - 6 - (240 + 14));
    const wide = chooseBubbleSide({ ...base, screenWidth: 1000, headLeft: 10, headRight: 50, prefer: 'right' });
    expect(wide.maxWidth).toBe(700);
  });
  it('高度放不下時縮小字級，最小 0.6', () => {
    expect(fitFontScale(100, 200, 1)).toBe(1);
    expect(fitFontScale(400, 200, 1)).toBeLessThan(1);
    expect(fitFontScale(4000, 10, 0.6)).toBe(0.6);
  });
});
