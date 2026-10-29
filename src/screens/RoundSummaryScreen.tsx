import { dispatch } from '../state/app';
import { updateBattle, useRoundResult } from '../state/battle';

/**
 * 階段 2 暫用：回合結束畫面。階段 3 換成道歉與結尾。
 */
export function RoundSummaryScreen() {
  const r = useRoundResult();
  const again = (autoStart: boolean) => {
    updateBattle({ autoStart });
    dispatch('APOLOGY_DONE');
    dispatch('REMATCH');
  };
  return (
    <main className="screen summary-screen">
      <section className="prep-card center">
        <h1>這回合打完了</h1>
        <div className="stats">
          <span>
            <b data-testid="final-score">{r?.score ?? 0}</b>
            <small>分數</small>
          </span>
          <span>
            <b>{r?.maxCombo ?? 0}</b>
            <small>最高連擊</small>
          </span>
        </div>
        <p className="note">道歉與結尾會在下一個版本加入。</p>
        <div className="btn-row center">
          <button type="button" className="btn primary big" onClick={() => again(true)} data-testid="rematch">
            再打一場
          </button>
          <button type="button" className="btn big" onClick={() => again(false)}>
            回開戰準備
          </button>
        </div>
      </section>
    </main>
  );
}
