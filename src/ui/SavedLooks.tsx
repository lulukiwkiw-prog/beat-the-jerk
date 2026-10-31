import { useState } from 'react';
import type { PaintStore } from '../game/puppet/paintSurface';
import { deleteLook, formatSavedAt, listLooks, MAX_LOOKS, saveLook } from '../storage/saves';

/** 彩繪室「我的外觀」：存到這台裝置、套用、刪除（只存彩繪與配件，不含任何文字）。 */
export function SavedLooks({ paint, disabled }: { paint: PaintStore; disabled: boolean }) {
  const [list, setList] = useState(listLooks);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const save = () => {
    if (list.length >= MAX_LOOKS) {
      setMsg(`最多存 ${MAX_LOOKS} 個外觀，先刪掉一個再存。`);
      return;
    }
    const saved = saveLook(paint.exportLook());
    if (!saved) {
      setMsg('儲存失敗（裝置空間不足或瀏覽器不允許儲存），不影響遊玩。');
      return;
    }
    setList(listLooks());
    setMsg(`已存到這台裝置：${saved.name}`);
  };

  return (
    <div className="tool-group saved-looks" data-testid="saved-looks">
      <span className="tool-label">我的外觀（只存在這台裝置）</span>
      <div className="btn-row">
        <button type="button" className="btn" onClick={save} disabled={disabled} data-testid="save-look">
          儲存目前外觀
        </button>
      </div>
      {list.length > 0 && (
        <ul className="saved-list">
          {list.map((l) => (
            <li key={l.id}>
              <span className="saved-name">
                {l.name}
                <small>{formatSavedAt(l.savedAt)}</small>
              </span>
              {confirmDel === l.id ? (
                <>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      deleteLook(l.id);
                      setList(listLooks());
                      setConfirmDel(null);
                      setMsg(`已刪除：${l.name}`);
                    }}
                  >
                    確定刪除
                  </button>
                  <button type="button" className="btn small" onClick={() => setConfirmDel(null)}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn small"
                    disabled={disabled}
                    onClick={async () => setMsg((await paint.importLook(l.data)) ? `換上了：${l.name}（可以復原）` : '讀取失敗，這個外觀可能已損壞。')}
                    data-testid={`load-look-${l.name}`}
                  >
                    套用
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => setConfirmDel(l.id)} aria-label={`刪除 ${l.name}`}>
                    刪除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
