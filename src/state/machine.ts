/**
 * 遊戲狀態機（SPEC 第 17 節）：
 * 輸入 → 彩繪 → 開戰準備 → 戰鬥 ⇄ 暫停 → 道歉 → 結尾 → （輸入｜開戰準備）
 */
export type Screen = 'input' | 'paint' | 'prep' | 'battle' | 'paused' | 'apology' | 'ending';

export type GameEvent =
  | 'SUBMIT_WANTED'
  | 'START_DUEL'
  | 'BACK'
  | 'BEGIN_BATTLE'
  | 'PAUSE'
  | 'RESUME'
  | 'END_ROUND'
  | 'APOLOGY_DONE'
  | 'REMATCH'
  | 'NEW_JERK';

const TABLE: Record<Screen, Partial<Record<GameEvent, Screen>>> = {
  input: { SUBMIT_WANTED: 'paint' },
  paint: { START_DUEL: 'prep', BACK: 'input' },
  prep: { BEGIN_BATTLE: 'battle', BACK: 'paint' },
  battle: { PAUSE: 'paused', END_ROUND: 'apology' },
  paused: { RESUME: 'battle', END_ROUND: 'apology' },
  apology: { APOLOGY_DONE: 'ending' },
  ending: { REMATCH: 'prep', NEW_JERK: 'input' },
};

/** 不合法的轉換回傳原狀態（不丟錯，避免重複點擊造成崩潰）。 */
export function transition(state: Screen, event: GameEvent): Screen {
  return TABLE[state][event] ?? state;
}

export function canTransition(state: Screen, event: GameEvent): boolean {
  return TABLE[state][event] !== undefined;
}
