/** 短版操作教學（可略過）。 */
export function Tutorial({ onClose }: { onClose: () => void }) {
  return (
    <section className="tutorial" aria-label="操作說明" data-testid="tutorial">
      <div className="tutorial-head">
        <h2>怎麼打</h2>
        <button type="button" className="btn small" onClick={onClose}>
          略過
        </button>
      </div>
      <div className="tutorial-grid">
        <div>
          <h3>手機</h3>
          <ul>
            <li>左下 ◀ ▶ 移動，「閃避」往後跳</li>
            <li>右下按招式，可以邊移動邊出招</li>
            <li>「徒手／武器」切換招式組</li>
          </ul>
        </div>
        <div>
          <h3>電腦</h3>
          <ul>
            <li><kbd>A</kbd> <kbd>D</kbd> 或 <kbd>←</kbd> <kbd>→</kbd> 移動</li>
            <li><kbd>1</kbd>～<kbd>6</kbd> 出招（武器 1～5），<kbd>Q</kbd> 切換徒手／武器</li>
            <li><kbd>空白</kbd> 閃避，<kbd>Esc</kbd> 暫停</li>
          </ul>
        </div>
      </div>
      <p className="note">上勾拳把它打上天，落地會散成一地積木再自己組回來；鐵錘敲頭、連擊每 10 下也會散一次。鐵錘要先蓄力，看到「蓄力…」再等一下。</p>
      <button type="button" className="btn primary" onClick={onClose}>
        知道了
      </button>
    </section>
  );
}
