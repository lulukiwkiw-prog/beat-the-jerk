/** 特效數值 */
export const EFFECTS = {
  /** 閃光強度（不透明度） */
  flash: { weak: 0.25, strong: 0.55 },
  flashDecay: 4,
  vibrateMs: 18,
  particleLife: [0.7, 1.1],
  wordLife: 0.6,
  scoreLife: 0.9,
  /** 命中停格（秒）：一般、重擊 */
  hitStop: { light: 0.045, heavy: 0.1 },
  /** 命中時木偶閃白光（秒、亮度） */
  hitFlash: { time: 0.12, intensity: 0.5 },
  /** 命中震動：一般、重擊的倍率；連擊越高越大（每連擊 +perCombo，最多 +maxCombo） */
  hitShake: { light: 0.6, heavy: 1.05, perCombo: 0.025, maxCombo: 0.5 },
  /** 粒子數：一般、重擊 */
  hitParticles: { star: [5, 9], chip: [7, 14] },
  /** 殘影：產生間隔（秒）、存活時間、不透明度、顏色 */
  afterimage: { every: 0.028, life: 0.22, opacity: 0.55, color: '#7CC8FF', maxGhosts: 80 },
} as const;

/** 空中連擊：浮空的木偶打得到的高度（H）、每次命中往上托的速度、滯空時間與滯空時的重力比例、玩家跳起追打 */
export const JUGGLE = {
  airReach: 2.1,
  liftVy: 5.5,
  hangTime: 0.38,
  hangGravity: 0.25,
  pushKeep: 0.35,
  /** 玩家跳到木偶下方多少、最高跳多高、上升／落下速度、往木偶靠近的速度 */
  playerBelow: 0.5,
  playerMax: 7.5,
  riseRate: 16,
  fallRate: 9,
  chaseSpeed: 9,
} as const;
