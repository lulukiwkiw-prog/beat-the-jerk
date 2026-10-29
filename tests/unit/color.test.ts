import { describe, expect, it } from 'vitest';
import { srgb } from '../../src/game/three/color';

describe('色彩管理', () => {
  it('sRGB 顏色只轉一次到線性空間', () => {
    const c = srgb('#808080');
    // sRGB 0.502 → 線性約 0.2159；若重複轉換會變成約 0.038
    expect(c.r).toBeCloseTo(0.2159, 3);
    expect(c.getHexString()).toBe('808080');
  });
});
