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

/** 道歉時的舞台：背景轉黑所需時間、聚光燈（顏色、角度、柔邊、高度、往前偏移、亮度、光柱與光圈） */
export const APOLOGY_SPOT = {
  blackout: 0.9,
  /** 黑掉之後保留一點點環境光，看得出積木人的輪廓 */
  ambient: 0.06,
  color: '#FFE6BF',
  angle: 0.3,
  penumbra: 0.55,
  height: 12,
  forward: 3.2,
  intensity: 7,
  beamOpacity: 0.11,
  poolRadius: 2.4,
  poolOpacity: 0.55,
} as const;

/** 通緝單沒填時，道歉稿用的通用台詞（{你}／{他} 會依稱謂替換） */
export const APOLOGY_DEFAULTS = {
  /** 沒寫 A：開頭 */
  opening: ['那件讓{你}難受的事，', '是我做得不對。'],
  /** 沒選心情 */
  feeling: ['我知道，那讓{你}很不好受。'],
  /** 沒寫想聽的話 */
  closing: ['這不是{你}的錯。', '{你}值得被好好對待。'],
} as const;
