import { useEffect, useState } from 'react';
import { ROUND } from '../config/round.config';
import { dispatch } from '../state/app';
import { devRound, markTutorialSeen, tutorialSeen, updateBattle, useBattleOptions, type Difficulty } from '../state/battle';
import { SCORING } from '../config/scoring.config';
import { Segmented } from '../ui/Segmented';
import { Tutorial } from '../ui/Tutorial';
import { useSession } from '../state/session';
import { fillPronouns } from '../state/text';

/** 開戰準備：難度、回合說明、短版操作教學。 */
export function PrepScreen() {
  const o = useBattleOptions();
  const session = useSession();
  const t = (x: string) => fillPronouns(x, session.self, session.other);
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
        <Segmented<Difficulty>
          label="難度"
          value={o.difficulty}
          onChange={(difficulty) => updateBattle({ difficulty })}
          options={[{ value: 'easy', label: '簡單' }, { value: 'hard', label: '困難' }]}
        />
        <p className="note" data-testid="round-note">{t(`每回合 ${ROUND.defaultLength / 60} 分鐘。剩 ${ROUND.finisherAskAt} 秒時，可以選擇給{他}致命一擊，或再打 ${ROUND.extendBy / 60} 分鐘。`)}</p>
        {dev != null && <p className="note dev">開發測試：這次回合改為 {dev} 秒。</p>}
        {o.difficulty === 'easy' ? (
          <p className="note" data-testid="difficulty-note">簡單模式：木偶不會走動，每隔一陣子會出一拳，頭上冒出「！」時閃開就好。沒有輸的結局。</p>
        ) : (
          <p className="note" data-testid="difficulty-note">困難模式：木偶會走位、靠近出拳，偶爾還會閃開。看到「！」就按閃避，閃過一拳 +{SCORING.dodgeBonus} 分。被打倒會馬上爬起來，起身後短暫無敵。沒有輸的結局。</p>
        )}
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
