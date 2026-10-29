import { describe, expect, it } from 'vitest';
import { roundedBox } from '../../src/game/three/geometry';

describe('圓角方塊 UV', () => {
  it('UV 依實際位置線性分配（靠邊作畫不會被壓到圓角上）', () => {
    const [w, h, d] = [1.22, 1.1, 1.1];
    const g = roundedBox(w, h, d, 0.24);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const per = pos.count / 6;
    // 正面（+Z）：u 對應 x、v 對應 y
    for (let i = 4 * per; i < 5 * per; i++) {
      expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / w + 0.5, 6);
      expect(uv.getY(i)).toBeCloseTo(pos.getY(i) / h + 0.5, 6);
    }
  });
  it('UV 都在 0～1 之內', () => {
    const g = roundedBox(1.7, 1.5, 1.0, 0.16);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-6);
      expect(uv.getX(i)).toBeLessThanOrEqual(1 + 1e-6);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-6);
      expect(uv.getY(i)).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});
