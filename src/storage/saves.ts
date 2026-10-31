import type { AccessoryId, AccessorySlot } from '../game/puppet/looks/accessories';
import type { PaintPartId } from '../game/puppet/parts';
import type { OtherPronoun, SelfPronoun } from '../state/text';
import { readJSON, removeKey, writeJSON } from './safeStorage';

/** 所有遊戲資料的 localStorage 鍵都以這個開頭（清除全部資料時用） */
export const KEY_PREFIX = 'btj.';
const LOOKS_KEY = 'btj.looks';
const CONTENT_KEY = 'btj.content';
/** 最多存幾個外觀 */
export const MAX_LOOKS = 5;

export interface SavedLookData {
  /** 各部位彩繪貼圖（PNG data URL） */
  parts: Partial<Record<PaintPartId, string>>;
  accessories: Partial<Record<AccessorySlot, AccessoryId | null>>;
}

export interface SavedLook {
  id: string;
  name: string;
  savedAt: number;
  data: SavedLookData;
}

/** 「儲存這次內容」會保存的項目（玩家同意後才存） */
export interface SavedContent {
  savedAt: number;
  self: SelfPronoun;
  other: OtherPronoun;
  a: string;
  feelings: string[];
  customFeelings: string[];
  d: string[];
  angerBefore: number | null;
}

export function listLooks(): SavedLook[] {
  const list = readJSON<SavedLook[]>(LOOKS_KEY);
  return Array.isArray(list) ? list.filter((l) => l && typeof l.id === 'string' && l.data && typeof l.data.parts === 'object') : [];
}

/** 存一個外觀；失敗（空間不足、瀏覽器不允許）回傳 false，不影響遊玩。 */
export function saveLook(data: SavedLookData, now = Date.now()): SavedLook | null {
  const list = listLooks();
  if (list.length >= MAX_LOOKS) return null;
  const used = new Set(list.map((l) => l.name));
  let n = 1;
  while (used.has(`外觀 ${n}`)) n++;
  const look: SavedLook = { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, name: `外觀 ${n}`, savedAt: now, data };
  return writeJSON(LOOKS_KEY, [...list, look]) ? look : null;
}

export function deleteLook(id: string): boolean {
  return writeJSON(LOOKS_KEY, listLooks().filter((l) => l.id !== id));
}

export function loadContent(): SavedContent | null {
  const c = readJSON<SavedContent>(CONTENT_KEY);
  return c && typeof c.a === 'string' && Array.isArray(c.d) ? c : null;
}

export function saveContent(c: SavedContent): boolean {
  return writeJSON(CONTENT_KEY, c);
}

export function deleteContent(): boolean {
  return removeKey(CONTENT_KEY);
}

/** 清除這台裝置上所有遊戲資料（設定、外觀、內容、操作教學紀錄）。 */
export function clearAllData(): boolean {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}

export const formatSavedAt = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
