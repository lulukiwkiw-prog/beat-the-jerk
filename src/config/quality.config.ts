/** 效能分級（SPEC 第 16 節） */
export const QUALITY = {
  maxPixelRatio: 2,
  /** 低於此 FPS 視為卡頓 */
  minFps: 45,
  /** 連續卡頓幾秒後降一級 */
  sustainSeconds: 3,
  /** 取樣視窗（秒） */
  sampleWindow: 0.5,
  /** 降級後重新觀察前的寬限（秒） */
  settleSeconds: 1,
  /** 各級：0 全開、1 關陰影、2 像素比 1.5、3 像素比 1 */
  levels: [
    { shadows: true, pixelRatio: 2 },
    { shadows: false, pixelRatio: 2 },
    { shadows: false, pixelRatio: 1.5 },
    { shadows: false, pixelRatio: 1 },
  ],
  /** 碎屑粒子同時上限 */
  maxParticles: 60,
} as const;
