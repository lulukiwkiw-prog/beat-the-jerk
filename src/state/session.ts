import { FORM } from '../config/form.config';
import { createStore, useStore } from './store';
import type { OtherPronoun, SelfPronoun } from './text';
import { fillPronouns } from './text';

export interface BLine { id: number; text: string; inBattle: boolean }
export interface DLine { id: number; text: string }

/** 本次遊玩資料：只存在記憶體（SPEC 第 17 節）。 */
export interface Session {
  self: SelfPronoun;
  other: OtherPronoun;
  a: string;
  b: BLine[];
  feelings: string[];
  customFeelings: string[];
  d: DLine[];
  /** null＝還沒選；skipped＝勾選略過 */
  angerBefore: number | null;
  angerSkipped: boolean;
}

let nextId = 1;
export const newId = () => nextId++;

export function emptySession(): Session {
  return {
    self: '你',
    other: '他',
    a: '',
    b: Array.from({ length: FORM.bDefaultRows }, () => ({ id: newId(), text: '', inBattle: true })),
    feelings: [],
    customFeelings: [],
    d: Array.from({ length: FORM.dDefaultRows }, () => ({ id: newId(), text: '' })),
    angerBefore: null,
    angerSkipped: false,
  };
}

export const sessionStore = createStore<Session>(emptySession());
export const useSession = () => useStore(sessionStore);

export function updateSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)) {
  sessionStore.set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
}

/** 已填寫的 B（空白忽略）。 */
export function filledB(s: Session): BLine[] {
  return s.b.filter((l) => l.text.trim() !== '');
}

/** 「啟用」的 B＝已填寫且勾選「戰鬥中出現」。 */
export function enabledB(s: Session): string[] {
  return filledB(s).filter((l) => l.inBattle).map((l) => l.text.trim());
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
