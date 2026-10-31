import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('設定', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });
  it('預設：音效、音樂開，漫畫鼻血關', async () => {
    const { settingsStore } = await import('../../src/state/settings');
    const s = settingsStore.get();
    expect(s.sfxOn).toBe(true);
    expect(s.musicOn).toBe(true);
    expect(s.nosebleed).toBe(false);
  });
  it('改了會記在這台裝置，下次開啟還在', async () => {
    const m1 = await import('../../src/state/settings');
    m1.updateSettings({ musicVolume: 0.2, nosebleed: true });
    vi.resetModules();
    const m2 = await import('../../src/state/settings');
    expect(m2.settingsStore.get().musicVolume).toBe(0.2);
    expect(m2.settingsStore.get().nosebleed).toBe(true);
  });
  it('存的資料壞掉或型別不對時用預設值', async () => {
    window.localStorage.setItem('btj.settings', JSON.stringify({ sfxOn: 'yes', shake: 3 }));
    const { settingsStore } = await import('../../src/state/settings');
    expect(settingsStore.get().sfxOn).toBe(true);
    expect(settingsStore.get().shake).not.toBe(3);
  });
});
