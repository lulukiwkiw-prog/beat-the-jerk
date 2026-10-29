import { GAME } from '../../config/game.config';

export interface LoopHandlers {
  /** 固定步長邏輯更新 */
  update(dt: number): void;
  /** 每個畫格渲染；frameDt 為實際經過時間（秒） */
  render(frameDt: number): void;
}

/**
 * 單一 requestAnimationFrame 迴圈，邏輯以固定時間步長（1/60 秒）更新。
 * 分頁切到背景時停止迴圈，回到前景再繼續（不補算背景時間）。
 */
export function startLoop(h: LoopHandlers): () => void {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    const frameDt = last ? Math.min(GAME.maxFrame, (now - last) / 1000) : GAME.step;
    last = now;
    acc += frameDt;
    while (acc >= GAME.step) {
      h.update(GAME.step);
      acc -= GAME.step;
    }
    h.render(frameDt);
    raf = requestAnimationFrame(frame);
  };
  const onVis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (running && !raf) {
      last = 0;
      acc = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  if (!document.hidden) raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
  };
}
