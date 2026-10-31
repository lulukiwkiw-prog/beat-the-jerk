import { AUDIO } from '../config/audio.config';
import { readJSON, writeJSON } from '../storage/safeStorage';
import { createStore, useStore } from './store';

export type Level3 = 'off' | 'weak' | 'strong';
export type QualityMode = 'auto' | 'high' | 'saver';

export interface Settings {
  shake: Level3;
  flash: Level3;
  vibration: boolean;
  quality: QualityMode;
  /** 音效、音樂：各自開關與音量（0～1） */
  sfxOn: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  /** 漫畫鼻血（預設關） */
  nosebleed: boolean;
}

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const vibrationSupported = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function defaultSettings(reduced = prefersReducedMotion()): Settings {
  return {
    // 偵測到「減少動態效果」時預設關閉晃動與閃光，玩家仍可手動開啟
    shake: reduced ? 'off' : 'weak',
    flash: reduced ? 'off' : 'weak',
    vibration: true,
    quality: 'auto',
    sfxOn: true,
    sfxVolume: AUDIO.defaultSfx,
    musicOn: true,
    musicVolume: AUDIO.defaultMusic,
    nosebleed: false,
  };
}

/** 設定記在這台裝置（不含任何玩家寫的內容）；讀不到或壞掉時用預設值。 */
export const SETTINGS_KEY = 'btj.settings';
function loadSettings(): Settings {
  const d = defaultSettings();
  const saved = readJSON<Partial<Settings>>(SETTINGS_KEY);
  if (!saved || typeof saved !== 'object') return d;
  const out = { ...d };
  for (const k of Object.keys(d) as (keyof Settings)[]) {
    if (typeof saved[k] === typeof d[k]) (out as Record<string, unknown>)[k] = saved[k];
  }
  return out;
}

export const settingsStore = createStore<Settings>(loadSettings());
settingsStore.subscribe(() => writeJSON(SETTINGS_KEY, settingsStore.get()));
export const useSettings = () => useStore(settingsStore);
export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

/** 震動：裝置不支援或設定關閉時不做任何事，不報錯。 */
export function vibrate(ms: number) {
  if (!settingsStore.get().vibration || !vibrationSupported()) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* 不支援時忽略 */
  }
}
