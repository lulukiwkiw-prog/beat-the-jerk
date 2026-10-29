import { createStore, useStore } from './store';

export type Level3 = 'off' | 'weak' | 'strong';
export type QualityMode = 'auto' | 'high' | 'saver';

export interface Settings {
  shake: Level3;
  flash: Level3;
  vibration: boolean;
  quality: QualityMode;
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
  };
}

export const settingsStore = createStore<Settings>(defaultSettings());
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
