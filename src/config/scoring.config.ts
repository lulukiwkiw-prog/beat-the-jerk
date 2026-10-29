/** 計分（SPEC 第 11 節） */
export const SCORING = {
  /** 連擊：上次命中後幾秒內再命中才延續 */
  comboWindow: 2,
  /** 每達幾連擊給獎勵 */
  comboStep: 10,
  comboBonus: 50,
  /** 招式組合：幾秒內命中幾種不同招式 */
  varietyWindow: 3,
  varietyCount: 3,
  varietyBonus: 40,
  /** 成功閃避（困難模式，階段 5） */
  dodgeBonus: 20,
} as const;
