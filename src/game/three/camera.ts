import { CAMERA } from '../../config/game.config';

export interface FrameInput {
  aspect: number;
  fov: number;
  /** 需完整入鏡的角色：中心 x、半寬、頂端高度 */
  actors: { x: number; halfWidth: number; top: number }[];
}

export interface FrameResult {
  x: number;
  dist: number;
  lookY: number;
  camY: number;
}

/**
 * 側面鏡頭取景：X 跟隨兩人中點（限制 ±followLimit），
 * 距離依兩人間距與最高點縮放，確保任何時候所有角色都完整在畫面內。
 */
export function computeFrame({ aspect, fov, actors }: FrameInput): FrameResult {
  const tv = Math.tan(((fov / 2) * Math.PI) / 180);
  const left = Math.min(...actors.map((a) => a.x - a.halfWidth));
  const right = Math.max(...actors.map((a) => a.x + a.halfWidth));
  const top = Math.max(...actors.map((a) => a.top)) + CAMERA.topMargin;
  const mid = Math.max(-CAMERA.followLimit, Math.min(CAMERA.followLimit, (left + right) / 2));
  // 鏡頭中心被限制時，要涵蓋到離中心最遠的一側
  const halfSpan = Math.max(mid - left, right - mid) + CAMERA.sideMargin;
  const halfW = Math.max(CAMERA.minHalfWidth, halfSpan);
  const distW = halfW / (tv * aspect);
  const halfH = (top - CAMERA.floorY) / 2;
  const lookY = Math.max(CAMERA.lookY, CAMERA.floorY + halfH);
  const distH = halfH / tv + 1;
  const dist = Math.max(distW, distH);
  return { x: mid, dist, lookY, camY: lookY + 0.95 + dist * 0.035 };
}
