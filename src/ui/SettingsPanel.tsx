import { useEffect, useRef, useState } from 'react';
import { createStore, useStore } from '../state/store';
import { prefersReducedMotion, updateSettings, useSettings, vibrationSupported, type Level3, type QualityMode } from '../state/settings';
import { Segmented } from './Segmented';

const LEVELS: { value: Level3; label: string }[] = [
  { value: 'off', label: '關' },
  { value: 'weak', label: '弱' },
  { value: 'strong', label: '強' },
];

/**
 * 設定（任何畫面皆可開啟）。只顯示目前已有作用的項目；
 * 音效、音樂、漫畫鼻血等於之後的階段加入。
 */
const openStore = createStore(false);
/** 從其他地方（例如戰鬥 HUD）開啟設定 */
export const openSettings = () => openStore.set(true);
export const useSettingsOpen = () => useStore(openStore);

export function SettingsPanel({ showGear = true }: { showGear?: boolean }) {
  const s = useSettings();
  const open = useStore(openStore);
  const setOpen = (v: boolean | ((p: boolean) => boolean)) => openStore.set(typeof v === 'function' ? v(openStore.get()) : v);
  const [about, setAbout] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {showGear && (
        <button type="button" className="gear" aria-label="設定" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="open-settings">
          ⚙
        </button>
      )}
      {open && (
        <div className="settings" role="dialog" aria-label="設定" ref={panelRef} tabIndex={-1}>
          <div className="settings-head">
            <h2>設定</h2>
            <button type="button" className="btn small" onClick={() => setOpen(false)}>關閉</button>
          </div>
          <Segmented<QualityMode>
            label="畫質"
            value={s.quality}
            onChange={(quality) => updateSettings({ quality })}
            options={[
              { value: 'auto', label: '自動' },
              { value: 'high', label: '高' },
              { value: 'saver', label: '省電' },
            ]}
          />
          <Segmented<Level3> label="螢幕晃動" value={s.shake} options={LEVELS} onChange={(shake) => updateSettings({ shake })} />
          <Segmented<Level3> label="閃光強度" value={s.flash} options={LEVELS} onChange={(flash) => updateSettings({ flash })} />
          {vibrationSupported() && (
            <Segmented<'on' | 'off'>
              label="震動"
              value={s.vibration ? 'on' : 'off'}
              onChange={(v) => updateSettings({ vibration: v === 'on' })}
              options={[
                { value: 'on', label: '開' },
                { value: 'off', label: '關' },
              ]}
            />
          )}
          {prefersReducedMotion() && <p className="note">偵測到系統「減少動態效果」，晃動與閃光預設為關。</p>}
          <button type="button" className="link" onClick={() => setAbout((v) => !v)} aria-expanded={about}>
            關於這個遊戲
          </button>
          {about && (
            <div className="about">
              <p>《打爆那個爛人！》是一款以虛構木偶為對手的卡通抒壓遊戲。你寫的內容只存在這台裝置，不會上傳。</p>
              <p className="fine">本遊戲為娛樂抒壓之用，不是心理治療。若困擾持續影響生活，可撥打衛福部安心專線 1925。</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
