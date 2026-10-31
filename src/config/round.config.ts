/** 回合、難度與節奏 */
export const ROUND = {
  /** 回合長度固定 1 分鐘（秒） */
  defaultLength: 60,
  /** 開發用 ?round=30 允許的範圍 */
  devMin: 5,
  devMax: 600,
  /** 開打倒數（秒） */
  countdown: 2.4,
  /** 時間到後停頓多久再離開戰鬥（秒） */
  endDelay: 1.6,
  /** 剩幾秒時問「要給致命一擊嗎？」；選「繼續打」延長幾秒 */
  finisherAskAt: 15,
  extendBy: 60,
  /** 活動提示顯示時間（秒） */
  bannerTime: 2,
} as const;

export const EASY_AI = {
  /** 出拳間隔（秒） */
  intervalMin: 8,
  intervalMax: 12,
  /** 預備動作（明顯可見） */
  windup: 0.8,
  punchTime: 0.3,
  /** 拳頭能打到的中心距離（H） */
  reach: 0.75,
  /** 受擊後重新計時的最短秒數 */
  resetAfterHit: 3,
} as const;

/** 致命一擊（正義光波）演出：各節點的時間（秒）與數值 */
export const FINISHER = {
  /** 總長；結束後直接進道歉 */
  total: 7.6,
  /** 開始時兩人站在場中央兩側的距離（中心到各自） */
  standX: 2.6,
  /** 集氣結束、推出光波、光波打中、光波消失 */
  fire: 1.9,
  hit: 2.15,
  beamEnd: 3.1,
  /** 打中瞬間的慢動作區間與速度倍率 */
  slowFrom: 2.05,
  slowTo: 2.75,
  slowRate: 0.35,
  /** 被轟飛：水平、往上初速（往上約 14 單位，摔回地面時噴飛） */
  blastVx: 3.5,
  blastVy: 27,
  /** 光球最大尺寸、光柱粗細 */
  ballMax: 1.1,
  beamRadius: 0.95,
  /** 摔回地面後幾秒顯示 K.O.（若沒摔到，最晚這個時間） */
  koLatest: 4.9,
  /** 背景變暗：幾秒內暗下來、K.O. 後幾秒亮回來、最暗程度（0～1） */
  darkIn: 0.6,
  darkOut: 1.4,
  darkAmount: 1,
  /** 終結技加分 */
  score: 100,
} as const;

/** 困難模式木偶（SPEC 第 11 節） */
export const HARD_AI = {
  /** 出拳預備動作（秒）、出拳時間 */
  windup: 0.5,
  punchTime: 0.3,
  /** 兩次出拳之間至少間隔（秒）＋隨機 */
  cooldown: 2,
  cooldownRandom: 1.2,
  /** 拳頭打得到的中心距離（H） */
  reach: 0.75,
  /** 移動速度、想保持的距離（場景單位）、靠太近時後退的距離 */
  walkSpeed: 2.6,
  preferDist: 2.9,
  tooClose: 2.0,
  /** 偶爾停下來喘口氣（秒） */
  pauseMin: 0.4,
  pauseMax: 1.2,
  pauseChance: 0.25,
  /** 閃避：機率、之後至少幾秒不再閃、無敵時間、往後跳的速度 */
  dodgeChance: 0.3,
  dodgeCooldown: 3,
  dodgeTime: 0.45,
  dodgeSpeed: 9,
  /** 打中玩家後多等幾秒才能再出拳（避免連續壓制） */
  afterHitRest: 2.5,
} as const;

/** 困難模式玩家被擊倒：起身時間（< 1 秒）、起身後無敵時間 */
export const KNOCKDOWN = {
  getUp: 0.9,
  invulnerable: 1.5,
  push: 9,
} as const;

/**
 * 小型活動（SPEC 第 13 節，依一回合 1 分鐘調整）：每一分鐘的第 15～40 秒是狂熱時間；
 * 鞋子時間、彈墊時間各有一定機率出現，一個在狂熱前、一個在狂熱中後段（每分鐘各最多一次）。
 * 時間都以「這一分鐘內第幾秒」計算；剩 15 秒（第 45 秒）會問致命一擊。
 */
export const EVENTS = {
  fever: { from: 15, to: 40 },
  shoe: { duration: 10, cooldown: 0.3 },
  bounce: { duration: 15, bonus: 10, restitution: 1.05, hitGap: 0.4 },
  /** 每分鐘各自出現的機率 */
  chance: 0.75,
  /** 前段、後段的開始時間範圍 */
  earlySlot: [2, 6],
  lateSlot: [26, 30],
  /** 狂熱時間：粒子、文字放大倍率 */
  feverFx: 1.5,
} as const;
