import { useState } from 'react';
import { deleteContent, formatSavedAt, loadContent, saveContent } from '../storage/saves';
import { newId, updateSession, useSession } from '../state/session';

/**
 * 「儲存這次內容」：先列出會保存哪些項目，玩家按同意才存到這台裝置；
 * 之後可以讀回來或刪除。預設不存（SPEC 第 17 節）。
 */
export function SaveContent() {
  const s = useSession();
  const [saved, setSaved] = useState(loadContent);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState('');

  const doSave = () => {
    const ok = saveContent({
      savedAt: Date.now(),
      self: s.self,
      other: s.other,
      a: s.a,
      feelings: s.feelings,
      customFeelings: s.customFeelings,
      d: s.d.map((l) => l.text),
      angerBefore: s.angerSkipped ? null : s.angerBefore,
    });
    setAsking(false);
    setSaved(loadContent());
    setMsg(ok ? '已存到這台裝置。' : '儲存失敗（裝置空間不足或瀏覽器不允許儲存），不影響遊玩。');
  };

  const doLoad = () => {
    const c = loadContent();
    if (!c) return;
    updateSession({
      self: c.self,
      other: c.other,
      a: c.a,
      feelings: c.feelings,
      customFeelings: c.customFeelings,
      d: (c.d.length ? c.d : ['']).map((text) => ({ id: newId(), text })),
      angerBefore: c.angerBefore,
      angerSkipped: c.angerBefore === null,
    });
    setMsg('已讀回上次儲存的內容。');
  };

  return (
    <section className="q save-content" data-testid="save-content">
      <h3>
        儲存這次內容<span className="opt">選填</span>
      </h3>
      <p className="note">預設不儲存，關掉分頁就消失。想下次再用，可以存在這台裝置。</p>
      {asking ? (
        <div className="consent" role="dialog" aria-label="儲存這次內容" data-testid="save-consent">
          <p>會把下面這些存在這台裝置（不會上傳）：</p>
          <ul>
            <li>稱謂</li>
            <li>A．為什麼想打爆這個人</li>
            <li>B．當時的心情（含自訂的心情）</li>
            <li>C．希望對方說的話</li>
            <li>開打前有多氣</li>
          </ul>
          <p className="note">彩繪外觀另外在彩繪室儲存。隨時可以在這裡刪除，或在設定裡清除所有資料。</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={doSave} data-testid="save-consent-yes">
              同意並儲存
            </button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setAsking(true)} disabled={!s.a.trim()} data-testid="save-content-btn">
            {saved ? '用目前內容覆蓋儲存' : '儲存這次內容'}
          </button>
          {saved && (
            <>
              <button type="button" className="btn" onClick={doLoad} data-testid="load-content">
                讀回 {formatSavedAt(saved.savedAt)} 的內容
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  deleteContent();
                  setSaved(null);
                  setMsg('已刪除儲存的內容。');
                }}
                data-testid="delete-content"
              >
                刪除儲存的內容
              </button>
            </>
          )}
        </div>
      )}
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
