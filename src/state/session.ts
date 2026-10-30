import { FORM } from '../config/form.config';
import { createStore, useStore } from './store';
import type { OtherPronoun, SelfPronoun } from './text';
import { fillPronouns } from './text';

export interface DLine { id: number; text: string }

/** 本次遊玩資料：只存在記憶體（SPEC 第 17 節）。 */
export interface Session {
  self: SelfPronoun;
  other: OtherPronoun;
  a: string;
  feelings: string[];
  customFeelings: string[];
  d: DLine[];
  /** null＝還沒選；skipped＝勾選略過 */
  angerBefore: number | null;
  angerSkipped: boolean;
  /** 結尾後的「現在有多氣」 */
  angerAfter: number | null;
  /** 對同一對手連續選「再打爆一次」的次數 */
  rematchStreak: number;
  /** 休息提示每個對手只出現一次 */
  restPromptShown: boolean;
}

let nextId = 1;
export const newId = () => nextId++;

export function emptySession(): Session {
  return {
    self: '你',
    other: '他',
    a: '',
    feelings: [],
    customFeelings: [],
    d: Array.from({ length: FORM.dDefaultRows }, () => ({ id: newId(), text: '' })),
    angerBefore: null,
    angerSkipped: false,
    angerAfter: null,
    rematchStreak: 0,
    restPromptShown: false,
  };
}

/** 「我還有其他爛人要打」：清空通緝單與這個對手的紀錄，保留稱謂。 */
export function resetForNewJerk() {
  sessionStore.set((s) => ({ ...emptySession(), self: s.self, other: s.other }));
}

export const sessionStore = createStore<Session>(emptySession());
export const useSession = () => useStore(sessionStore);

export function updateSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)) {
  sessionStore.set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
}

export function filledD(s: Session): string[] {
  return s.d.map((l) => l.text.trim()).filter(Boolean);
}

export function isWantedValid(s: Session): boolean {
  return s.a.trim() !== '';
}

/** 依目前稱謂填入 {你}／{他}。 */
export function usePronounText() {
  const s = useSession();
  return (template: string) => fillPronouns(template, s.self, s.other);
}
