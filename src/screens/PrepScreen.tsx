import { useEffect, useState } from 'react';
import { ROUND } from '../config/round.config';
import { dispatch } from '../state/app';
import { devRound, markTutorialSeen, tutorialSeen, updateBattle, useBattleOptions } from '../state/battle';
import { Segmented } from '../ui/Segmented';
import { Tutorial } from '../ui/Tutorial';

/** 開戰準備：難度、回合長度、短版操作教學。 */
export function PrepScreen() {
  const o = useBattleOptions();
  const [showTutorial, setShowTutorial] = useState(() => !tutorialSeen());
  const dev = devRound();

  // 「再打一場」：保留設定直接開打
  useEffect(() => {
    if (o.autoStart) {
      updateBattle({ autoStart: false });
      dispatch('BEGIN_BATTLE');
    }
  }, [o.autoStart]);

  const closeTutorial = () => {
    markTutorialSeen();
    setShowTutorial(false);
  };

  return (
    <main className="screen prep-screen">
      <header className="screen-head">
        <button type="button" className="btn small ghost" onClick={() => dispatch('BACK')}>
          ← 回彩繪室
        </button>
        <h1>開戰準備</h1>
      </header>
      <section className="prep-card">
        <Segmented<'easy'> label="難度" value={o.difficulty} onChange={(difficulty) => updateBattle({ difficulty })} options={[{ value: 'easy', label: '簡單' }]} />
        <Segmented<string>
          label="回合長度"
          value={String(o.roundLength)}
          onChange={(v) => updateBattle({ roundLength: Number(v) })}
          options={ROUND.lengths.map((s) => ({ value: String(s), label: `${s / 60} 分鐘` }))}
        />
        {dev != null && <p className="note dev">開發測試：這次回合改為 {dev} 秒。</p>}
        <p className="note">簡單模式：木偶不會走動，每隔一陣子會出一拳，頭上冒出「！」時閃開就好。沒有輸的結局。</p>
        <div className="prep-actions">
          <button type="button" className="btn" onClick={() => setShowTutorial(true)} aria-expanded={showTutorial}>
            操作說明
          </button>
          <button type="button" className="btn primary big" onClick={() => dispatch('BEGIN_BATTLE')} data-testid="begin-battle">
            開始決鬥
          </button>
        </div>
      </section>
      {showTutorial && <Tutorial onClose={closeTutorial} />}
    </main>
  );
}
