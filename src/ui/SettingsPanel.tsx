import { useEffect, useRef, useState } from 'react';
import { createStore, useStore } from '../state/store';
import { clearAllData } from '../storage/saves';
import { defaultSettings, prefersReducedMotion, updateSettings, useSettings, vibrationSupported, type Level3, type QualityMode } from '../state/settings';
import { Segmented } from './Segmented';

const LEVELS: { value: Level3; label: string }[] = [
  { value: 'off', label: '關' },
  { value: 'weak', label: '弱' },
  { value: 'strong', label: '強' },
];

/** 設定（任何畫面皆可開啟）。 */
const openStore = createStore(false);
/** 從其他地方（例如戰鬥 HUD）開啟設定 */
export const openSettings = () => openStore.set(true);
export const useSettingsOpen = () => useStore(openStore);

/** 音效／音樂：開關＋音量滑桿 */
function SoundRow(p: { label: string; on: boolean; volume: number; onToggle: (on: boolean) => void; onVolume: (v: number) => void }) {
  return (
    <div className="sound-row">
      <Segmented<'on' | 'off'>
        label={p.label}
        value={p.on ? 'on' : 'off'}
        onChange={(v) => p.onToggle(v === 'on')}
        options={[
          { value: 'on', label: '開' },
          { value: 'off', label: '關' },
        ]}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(p.volume * 100)}
        disabled={!p.on}
        aria-label={`${p.label}音量`}
        onChange={(e) => p.onVolume(Number(e.target.value) / 100)}
      />
    </div>
  );
}

export function SettingsPanel({ showGear = true }: { showGear?: boolean }) {
  const s = useSettings();
  const open = useStore(openStore);
  const setOpen = (v: boolean | ((p: boolean) => boolean)) => openStore.set(typeof v === 'function' ? v(openStore.get()) : v);
  const [about, setAbout] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState('');
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
          <SoundRow label="音效" on={s.sfxOn} volume={s.sfxVolume} onToggle={(sfxOn) => updateSettings({ sfxOn })} onVolume={(sfxVolume) => updateSettings({ sfxVolume })} />
          <SoundRow label="音樂" on={s.musicOn} volume={s.musicVolume} onToggle={(musicOn) => updateSettings({ musicOn })} onVolume={(musicVolume) => updateSettings({ musicVolume })} />
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
          <Segmented<'on' | 'off'>
            label="漫畫鼻血"
            value={s.nosebleed ? 'on' : 'off'}
            onChange={(v) => updateSettings({ nosebleed: v === 'on' })}
            options={[
              { value: 'on', label: '開' },
              { value: 'off', label: '關' },
            ]}
          />
          {prefersReducedMotion() && <p className="note">偵測到系統「減少動態效果」，晃動與閃光預設為關。</p>}
          <div className="clear-data">
            {confirmClear ? (
              <div className="confirm" role="alert">
                確定清除這台裝置上的所有遊戲資料？（設定、儲存的外觀與內容都會刪掉，無法復原）
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn warn small"
                    onClick={() => {
                      updateSettings(defaultSettings());
                      const ok = clearAllData();
                      setConfirmClear(false);
                      setCleared(ok ? '已清除這台裝置上的所有遊戲資料。' : '清除失敗，請稍後再試。');
                    }}
                    data-testid="clear-all-yes"
                  >
                    確定清除
                  </button>
                  <button type="button" className="btn small" onClick={() => setConfirmClear(false)}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn small warn" onClick={() => setConfirmClear(true)} data-testid="clear-all">
                清除這台裝置上的所有遊戲資料
              </button>
            )}
            {cleared && (
              <p className="note" role="status">
                {cleared}
              </p>
            )}
          </div>
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
