/** 回合、難度與節奏 */
export const ROUND = {
  /** 可選回合長度（秒） */
  lengths: [180, 300],
  defaultLength: 300,
  /** 開發用 ?round=30 允許的範圍 */
  devMin: 5,
  devMax: 600,
  /** 開打倒數（秒） */
  countdown: 2.4,
  /** 時間到後停頓多久再離開戰鬥（秒） */
  endDelay: 1.6,
  /** 收尾時間：剩幾秒開始 */
  windDown: 30,
  /** 收尾時特效強度最低倍率 */
  windDownMinFx: 0.45,
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
