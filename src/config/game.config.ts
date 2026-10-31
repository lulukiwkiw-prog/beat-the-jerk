/** 全域遊戲數值。距離單位：場景單位；H＝積木人站立身高。 */
export const H = 4.8;

export const GAME = {
  /** 固定邏輯步長（秒） */
  step: 1 / 60,
  /** 單一畫格最多補算的時間（秒），避免切回分頁時螺旋補算 */
  maxFrame: 0.1,
  /** 場地左右邊界（木偶中心的活動範圍） */
  wallL: -6.6,
  wallR: 6.6,
  /** 玩家活動範圍 */
  playerMinX: -7,
  playerMaxX: 7,
  /** 預設位置 */
  playerStartX: -3,
  puppetStartX: 3,
  /** 重力（場景單位／秒²） */
  gravity: 26,
} as const;

export const CAMERA = {
  fov: 30,
  /** 鏡頭 X 跟隨範圍 */
  followLimit: 3.2,
  /** 跟隨平滑速度（每秒） */
  followRate: 4,
  /** 角色外緣以外的水平留白（場景單位） */
  sideMargin: 1.7,
  minHalfWidth: 4.3,
  /** 畫面下緣、上緣留白（場景單位） */
  floorY: -0.6,
  topMargin: 0.9,
  lookY: 2.75,
  baseY: 3.7,
  /** 晃動強度（弱、強） */
  shake: { weak: 0.2, strong: 0.38 },
  /** 晃動衰減（每秒） */
  shakeDecay: 0.8,
} as const;

export const STAGE_LAYOUT = {
  /** 手機版判斷寬度（px） */
  mobileMaxWidth: 700,
  wideAspect: 16 / 10,
  mobileAspect: 4 / 3.3,
} as const;
