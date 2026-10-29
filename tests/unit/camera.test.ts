import { describe, expect, it } from 'vitest';
import { CAMERA } from '../../src/config/game.config';
import { computeFrame } from '../../src/game/three/camera';

const visible = (aspect: number, a: { x: number; halfWidth: number; top: number }[]) => {
  const f = computeFrame({ aspect, fov: 30, actors: a });
  const tv = Math.tan((15 * Math.PI) / 180);
  const halfH = f.dist * tv;
  const halfW = halfH * aspect;
  return a.every((x) => x.x - x.halfWidth >= f.x - halfW - 1e-6 && x.x + x.halfWidth <= f.x + halfW + 1e-6 && x.top <= f.lookY + halfH + 1e-6) && f;
};

describe('鏡頭取景', () => {
  it('兩人靠近時拉近、拉開時退遠', () => {
    const near = computeFrame({ aspect: 1.6, fov: 30, actors: [{ x: -1, halfWidth: 0.9, top: 5 }, { x: 1, halfWidth: 0.9, top: 5 }] });
    const far = computeFrame({ aspect: 1.6, fov: 30, actors: [{ x: -6, halfWidth: 0.9, top: 5 }, { x: 6, halfWidth: 0.9, top: 5 }] });
    expect(far.dist).toBeGreaterThan(near.dist);
  });
  it('X 跟隨中點，限制在 ±3.2', () => {
    const f = computeFrame({ aspect: 1.6, fov: 30, actors: [{ x: 5, halfWidth: 0.9, top: 5 }, { x: 6.6, halfWidth: 0.9, top: 5 }] });
    expect(f.x).toBe(CAMERA.followLimit);
  });
  it('任何情況兩人都完整在畫面內（含浮空 1.5H、手機 4:3.3）', () => {
    for (const aspect of [16 / 10, 4 / 3.3, 2.2])
      for (const [px, qx] of [[-7, 6.6], [-3, 3], [5, 6.6], [-6.6, -7]])
        for (const lift of [0, 7.2]) expect(visible(aspect, [{ x: px, halfWidth: 0.9, top: 5 }, { x: qx, halfWidth: 1.5, top: 4.8 + lift }])).toBeTruthy();
  });
});
