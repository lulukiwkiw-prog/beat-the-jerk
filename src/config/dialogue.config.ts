/** 木偶對話（SPEC 第 12 節） */
export const DIALOGUE = {
  /** 每則最短顯示時間＝base＋每字 perChar 秒 */
  base: 1.2,
  perChar: 0.05,
  /** 沒有 D 時的預設句 */
  defaultD: ['對不起！', '我錯了！', '別打了啦！', '是我不好！'],
  /** 泡泡最寬為畫面寬度比例 */
  maxWidthFrac: 0.7,
} as const;

/** 道歉、結尾、降溫（SPEC 第 14、15 節） */
export const APOLOGY = {
  /** 走回中央、跪下所需時間 */
  walkTime: 1.6,
  /** 燈光轉暖時間；提前結束時加長 */
  warmTime: 2.2,
  earlyExtraWarm: 3,
  /** 道歉稿每段淡入間隔（秒）；加速時倍率 */
  paragraphGap: 2.6,
  fastFactor: 4,
  /** 「值得聽到」畫面最短停留 */
  worthyMin: 3,
  /** 結局動畫長度（1、2、5 相近） */
  endingTime: 8,
  /** 降溫：吸氣、吐氣秒數與輪數 */
  inhale: 4,
  exhale: 6,
  breaths: 4,
  /** 連續第幾次「再打爆一次」時提示休息 */
  restPromptAt: 3,
  /** 「現在」分數達此值時顯示低調支援提示 */
  supportThreshold: 7,
} as const;
