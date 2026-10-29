import { describe, expect, it } from 'vitest';
import { atlasUV, faceDims, faceFromUV, FACES, uvToFacePoint } from '../../src/game/puppet/faces';

describe('3×2 圖集：UV ↔ 面', () => {
  it('每一面任何位置的 UV 都判斷回同一面', () => {
    for (const f of FACES)
      for (const a of [0, 0.01, 0.5, 0.99, 1])
        for (const b of [0, 0.01, 0.5, 0.99, 1]) {
          const [u, v] = atlasUV(f, a, b);
          expect(faceFromUV(u, v)).toBe(f);
        }
  });
  it('各面 UV 範圍互不重疊（含留白）', () => {
    const boxes = FACES.map((f) => [atlasUV(f, 0, 0), atlasUV(f, 1, 1)]);
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const [a0, a1] = boxes[i];
        const [b0, b1] = boxes[j];
        const overlap = a0[0] < b1[0] && b0[0] < a1[0] && a0[1] < b1[1] && b0[1] < a1[1];
        expect(overlap).toBe(false);
      }
  });
  it('面的實際尺寸', () => {
    const size: [number, number, number] = [1.7, 1.5, 1.0];
    expect(faceDims(size, 0)).toEqual([1.0, 1.5]);
    expect(faceDims(size, 3)).toEqual([1.7, 1.0]);
    expect(faceDims(size, 4)).toEqual([1.7, 1.5]);
  });
  it('UV 換算成面座標：以實際尺寸計，y 向下', () => {
    const size: [number, number, number] = [1.7, 1.5, 1.0];
    const [u0, v0] = atlasUV(4, 0, 1);
    expect(uvToFacePoint(u0, v0, 4, size)).toEqual({ x: 0, y: 0 });
    const [u1, v1] = atlasUV(4, 1, 0);
    const p = uvToFacePoint(u1, v1, 4, size);
    expect(p.x).toBeCloseTo(1.7);
    expect(p.y).toBeCloseTo(1.5);
    // 窄面：同樣 0.5 的 a，換算後的距離依該面寬度
    const [u2, v2] = atlasUV(0, 0.5, 0.5);
    expect(uvToFacePoint(u2, v2, 0, size).x).toBeCloseTo(0.5);
  });
});
