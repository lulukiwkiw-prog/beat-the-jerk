import { describe, expect, it } from 'vitest';
import { AUDIO } from '../../src/config/audio.config';
import { midiToHz, notesAt, stepSeconds } from '../../src/audio/pattern';
import { audio } from '../../src/audio/engine';

describe('音樂節奏', () => {
  it('一般：四拍大鼓、二四拍小鼓、每兩步一下鈸', () => {
    const bar = Array.from({ length: 16 }, (_, i) => notesAt(i, false));
    expect(bar.filter((n) => n.kick).length).toBe(4);
    expect(bar.filter((n) => n.snare).length).toBe(2);
    expect(bar.filter((n) => n.hat).length).toBe(8);
    expect(bar.some((n) => n.stab)).toBe(false);
  });
  it('狂熱時間：鼓點更密、拍手、和弦刷奏，速度更快', () => {
    const bar = Array.from({ length: 16 }, (_, i) => notesAt(i, true));
    expect(bar.filter((n) => n.kick).length).toBeGreaterThan(4);
    expect(bar.filter((n) => n.hat).length).toBe(16);
    expect(bar.some((n) => n.stab)).toBe(true);
    expect(stepSeconds(true)).toBeLessThan(stepSeconds(false));
  });
  it('貝斯跟著和弦進行換根音', () => {
    const roots = [0, 16, 32, 48].map((s) => notesAt(s, false).bass);
    expect(roots).toEqual(AUDIO.progression.map((r) => r - 12));
  });
  it('MIDI 69＝440Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
  it('第一次點擊之前（沒有 AudioContext）播放不報錯', () => {
    expect(() => {
      audio.play('hitHeavy');
      audio.setMusic('battle');
      audio.setFever(true);
      audio.setPaused(true);
      audio.setMusic(null);
    }).not.toThrow();
    expect(audio.ready).toBe(false);
  });
});
