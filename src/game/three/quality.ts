import { QUALITY } from '../../config/quality.config';
import type { QualityMode } from '../../state/settings';

export interface QualityLevel {
  shadows: boolean;
  pixelRatio: number;
}

/**
 * 自動畫質：連續 sustainSeconds 秒低於 minFps 時降一級（只降不升）：
 * 關陰影 → 像素比 1.5 → 像素比 1。
 */
export class QualityGovernor {
  level = 0;
  private winTime = 0;
  private winFrames = 0;
  private slowFor = 0;
  private settle = 0;

  constructor(public mode: QualityMode = 'auto') {}

  /** 每個渲染畫格呼叫；回傳 true 表示等級改變。 */
  sample(frameDt: number): boolean {
    if (this.mode !== 'auto' || this.level >= QUALITY.levels.length - 1) return false;
    if (this.settle > 0) {
      this.settle -= frameDt;
      return false;
    }
    this.winTime += frameDt;
    this.winFrames++;
    if (this.winTime < QUALITY.sampleWindow) return false;
    const fps = this.winFrames / this.winTime;
    if (fps < QUALITY.minFps) this.slowFor += this.winTime;
    else this.slowFor = 0;
    this.winTime = 0;
    this.winFrames = 0;
    if (this.slowFor >= QUALITY.sustainSeconds) {
      this.level++;
      this.slowFor = 0;
      this.settle = QUALITY.settleSeconds;
      return true;
    }
    return false;
  }

  current(devicePixelRatio: number): QualityLevel {
    const cap = (pr: number) => Math.min(devicePixelRatio || 1, pr, QUALITY.maxPixelRatio);
    if (this.mode === 'high') return { shadows: true, pixelRatio: cap(QUALITY.maxPixelRatio) };
    if (this.mode === 'saver') return { shadows: false, pixelRatio: cap(1) };
    const l = QUALITY.levels[this.level];
    return { shadows: l.shadows, pixelRatio: cap(l.pixelRatio) };
  }

  setMode(mode: QualityMode) {
    this.mode = mode;
    this.slowFor = 0;
    this.winTime = this.winFrames = 0;
  }
}
