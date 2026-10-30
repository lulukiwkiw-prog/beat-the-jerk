/** 回合、難度與節奏 */
export const ROUND = {
  /** 回合長度固定 3 分鐘（秒） */
  defaultLength: 180,
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
  /** 終結技加分 */
  score: 100,
} as const;
