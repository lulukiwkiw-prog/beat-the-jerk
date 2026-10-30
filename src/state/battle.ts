import { ROUND } from '../config/round.config';
import { devRoundOverride } from '../game/engine/roundClock';
import { readJSON, writeJSON } from '../storage/safeStorage';
import { createStore, useStore } from './store';

export type Difficulty = 'easy';

export interface BattleOptions {
  difficulty: Difficulty;
  /** 回合長度（秒） */
  roundLength: number;
  /** 「再打一場」時跳過開戰準備直接開打 */
  autoStart: boolean;
}

export const battleStore = createStore<BattleOptions>({ difficulty: 'easy', roundLength: ROUND.defaultLength, autoStart: false });
export const useBattleOptions = () => useStore(battleStore);
export const updateBattle = (p: Partial<BattleOptions>) => battleStore.set((s) => ({ ...s, ...p }));

/** 開發用：網址 ?round=30 時回合改為 30 秒。 */
export function devRound(): number | null {
  if (typeof window === 'undefined') return null;
  return devRoundOverride(window.location.search, ROUND.devMin, ROUND.devMax);
}

export function effectiveRoundLength(o: BattleOptions): number {
  return devRound() ?? o.roundLength;
}

const TUTORIAL_KEY = 'btj.tutorialSeen';
/** 操作教學只在第一次自動顯示（只記一個旗標，不含任何玩家內容）。 */
export const tutorialSeen = () => readJSON<boolean>(TUTORIAL_KEY) === true;
export const markTutorialSeen = () => writeJSON(TUTORIAL_KEY, true);

export interface RoundResult {
  score: number;
  maxCombo: number;
  hits: number;
  early: boolean;
}
export const resultStore = createStore<RoundResult | null>(null);
export const useRoundResult = () => useStore(resultStore);
