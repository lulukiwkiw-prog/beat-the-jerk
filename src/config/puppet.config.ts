import { H } from './game.config';

/** 積木人外觀與動畫數值 */
export const PUPPET = {
  height: H,
  /** 預設（空白）淺米灰塑膠色 */
  baseColor: '#E7E1D2',
  handColor: '#F2D29B',
  shoeColor: '#2B2B33',
  /** 受擊框半寬（場景單位） */
  halfWidth: 0.9,

  springs: {
    joint: { k: 130, d: 9 },
    head: { k: 150, d: 7 },
    squash: { k: 260, d: 11 },
    spin: { k: 90, d: 12 },
  },
  squashLimits: { minX: 0.6, maxX: 1.5, minY: 0.55, maxY: 1.45 },
  /** 四肢延遲擺動（秒，規格 60–120ms） */
  limbDelay: 0.09,
  /** 地面摩擦：每秒保留比例 */
  groundFriction: 0.012,
  airFriction: 0.6,
  /** 撞牆反彈保留比例、觸發撞牆效果的最低速度 */
  wallRestitution: 0.55,
  wallBumpSpeed: 1.5,

  reactions: {
    punch: { headZ: 12, torso: 4, squashX: 5, squashY: -4, shoulder: 5, push: 0.9, headX: -6 },
    slap: { headY: 28, headZ: 6, push: 0.6, waveTime: 0.35, waveAmount: 0.22, decalLife: 2 },
    /** 上勾拳：初速使最高點約 1.5H */
    launch: { vy: Math.sqrt(2 * 26 * 1.5 * H), spin: 6.5, push: 2, squashY: 8 },
    shoe: { push: 3, squashX: 6, squashY: -5, torso: 5, decalLife: 3 },
    /** 撞牆測試：擊退速度 */
    wallSmash: { push: 15, squashY: 6 },
    /** 落地：超過此速度重摔→噴飛；超過 soft 則壓扁 */
    landing: { scatterImpact: 14, softImpact: 3, squash: 0.6 },
    /** 倒地後起身時間上限（秒） */
    getUpTime: 0.8,
  },

  scatter: {
    flyTime: 1.15,
    returnTime: 0.65,
    gravity: 18,
    floorY: 0.22,
    bounce: 0.42,
    friction: 0.6,
    spinFriction: 0.6,
    baseSpeed: 4,
    randomSpeed: 4,
    upSpeed: 5,
    randomUp: 3,
    angular: 14,
    zMin: -2.5,
    zMax: 3,
    /** 減少動態效果時的距離倍率 */
    reducedMotionScale: 0.5,
  },

  /** 對戰站姿：轉身角度（弧度）、前腳／後腳、膝蓋、身體前傾 */
  stance: { yaw: 0.85, frontHip: 0.35, backHip: 0.3, knee: 0.22, lean: 0.06 },

  /** 跪下、坐下時身體下沉量 */
  kneelDrop: 0.78,
  sitDrop: 1.62,

  /** 彩繪室：完成動畫長度（秒） */
  finishAnimTime: 2.4,
} as const;
