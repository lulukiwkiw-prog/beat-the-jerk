import { describe, expect, it } from 'vitest';
import { QualityGovernor } from '../../src/game/three/quality';

const run = (g: QualityGovernor, fps: number, seconds: number) => {
  let changed = 0;
  for (let t = 0; t < seconds; t += 1 / fps) if (g.sample(1 / fps)) changed++;
  return changed;
};

describe('自動畫質', () => {
  it('流暢時不降級', () => {
    const g = new QualityGovernor('auto');
    expect(run(g, 60, 10)).toBe(0);
    expect(g.current(2)).toEqual({ shadows: true, pixelRatio: 2 });
  });
  it('連續 3 秒低於 45 FPS：關陰影 → 1.5 → 1', () => {
    const g = new QualityGovernor('auto');
    run(g, 30, 3.2);
    expect(g.current(2)).toEqual({ shadows: false, pixelRatio: 2 });
    run(g, 30, 4.5);
    expect(g.current(2).pixelRatio).toBe(1.5);
    run(g, 30, 4.5);
    expect(g.current(2).pixelRatio).toBe(1);
    expect(run(g, 20, 10)).toBe(0);
  });
  it('短暫卡頓不降級', () => {
    const g = new QualityGovernor('auto');
    run(g, 30, 2);
    run(g, 60, 1);
    run(g, 30, 2);
    expect(g.level).toBe(0);
  });
  it('像素比上限 2，且不超過裝置像素比', () => {
    expect(new QualityGovernor('high').current(3).pixelRatio).toBe(2);
    expect(new QualityGovernor('high').current(1).pixelRatio).toBe(1);
    expect(new QualityGovernor('saver').current(3)).toEqual({ shadows: false, pixelRatio: 1 });
  });
});
