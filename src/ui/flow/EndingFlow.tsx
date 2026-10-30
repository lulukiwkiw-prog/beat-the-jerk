import { useCallback, useEffect, useState } from 'react';
import { APOLOGY } from '../../config/dialogue.config';
import type { EndingShow } from '../../game/battle/BattleController';
import { sessionStore, updateSession, useSession } from '../../state/session';
import { fillPronouns } from '../../state/text';
import { AngerCard } from './AngerCard';
import { Breathing } from './Breathing';

type Exit = 'rematch' | 'new' | 'final';
type Step =
  | { k: 'choose' }
  | { k: 'rest' }
  | { k: 'anim'; show: EndingShow; ready: boolean }
  | { k: 'calm' }
  | { k: 'next'; picked: string | null }
  | { k: 'anger'; exit: Exit }
  | { k: 'reuse' }
  | { k: 'final' };

const CHOICES = [
  { id: 'forgive', label: '原諒{他}' },
  { id: 'leave', label: '不原諒，也到此為止' },
  { id: 'rematch', label: '再打爆一次' },
  { id: 'new', label: '我還有其他爛人要打' },
  { id: 'later', label: '我還沒準備好決定' },
] as const;

const ENDING_TEXT: Record<EndingShow, { main: string; sub?: string }> = {
  forgive: { main: '這次，依{你}的決定。', sub: '原諒不代表要和好，也不代表那件事沒關係。' },
  leave: { main: '{你}可以決定，到這裡就好。' },
  later: { main: '不用急著決定。{你}隨時可以再回來。' },
};

const NEXT_STEPS = [
  { label: '喝一杯水', reply: '好，去倒杯水吧。' },
  { label: '起來走一走', reply: '動一動，換個空氣。' },
  { label: '想一件今天還不錯的事', reply: '記得它就好，不用寫下來。' },
];

interface Props {
  stars: number;
  onShow(kind: EndingShow): void;
  onRematch(): void;
  onNewJerk(reuseLook: boolean): void;
}

/**
 * 結尾五選項與之後的流程（SPEC 第 15 節）：五個按鈕大小、顏色、字級相同、順序固定。
 */
export function EndingFlow({ stars, onShow, onRematch, onNewJerk }: Props) {
  const s = useSession();
  const t = (x: string) => fillPronouns(x, s.self, s.other);
  const [step, setStep] = useState<Step>({ k: 'choose' });

  const play = useCallback(
    (show: EndingShow) => {
      onShow(show);
      setStep({ k: 'anim', show, ready: false });
    },
    [onShow],
  );

  useEffect(() => {
    if (step.k !== 'anim' || step.ready) return;
    const timer = window.setTimeout(() => setStep({ ...step, ready: true }), APOLOGY.endingTime * 1000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const pick = (id: (typeof CHOICES)[number]['id']) => {
    if (id === 'rematch') {
      const streak = sessionStore.get().rematchStreak + 1;
      const prompt = streak >= APOLOGY.restPromptAt && !sessionStore.get().restPromptShown;
      updateSession({ rematchStreak: streak, restPromptShown: sessionStore.get().restPromptShown || prompt });
      setStep(prompt ? { k: 'rest' } : { k: 'anger', exit: 'rematch' });
      return;
    }
    updateSession({ rematchStreak: 0 });
    if (id === 'new') setStep({ k: 'anger', exit: 'new' });
    else play(id);
  };

  const exitAnger = (exit: Exit) => {
    if (exit === 'rematch') onRematch();
    else if (exit === 'new') setStep({ k: 'reuse' });
    else setStep({ k: 'final' });
  };

  return (
    <div className="flow-layer" data-testid="ending-flow">
      {step.k === 'choose' && (
        <section className="flow-card" aria-label="接下來" data-testid="ending-choices">
          <div className="choice-grid">
            {CHOICES.map((c) => (
              <button key={c.id} type="button" className="btn choice" onClick={() => pick(c.id)} data-testid={`ending-${c.id}`}>
                {t(c.label)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step.k === 'rest' && (
        <section className="flow-card" data-testid="rest-prompt">
          <p className="flow-text">已經打了 3 場了，要不要先休息一下？</p>
          <div className="flow-row">
            <button type="button" className="btn equal" onClick={() => play('later')}>
              先休息
            </button>
            <button type="button" className="btn equal" onClick={() => setStep({ k: 'anger', exit: 'rematch' })}>
              再打一場
            </button>
          </div>
        </section>
      )}

      {step.k === 'anim' && (
        <>
          <div className={`sky sky-${step.show}`} aria-hidden="true" />
          {step.ready && (
            <section className="flow-card ending-text" data-testid="ending-text">
              <p className="flow-main">{t(ENDING_TEXT[step.show].main)}</p>
              {ENDING_TEXT[step.show].sub && <p className="flow-sub">{t(ENDING_TEXT[step.show].sub!)}</p>}
              <button type="button" className="btn primary" onClick={() => setStep({ k: 'calm' })} data-testid="ending-continue">
                繼續
              </button>
            </section>
          )}
        </>
      )}

      {step.k === 'calm' && <Breathing stars={stars} onDone={() => setStep({ k: 'next', picked: null })} />}

      {step.k === 'next' && (
        <section className="flow-card" data-testid="next-step">
          {step.picked == null ? (
            <>
              <p className="flow-text">接下來，要不要做一件小事？</p>
              <div className="choice-grid four">
                {NEXT_STEPS.map((n) => (
                  <button key={n.label} type="button" className="btn choice" onClick={() => setStep({ k: 'next', picked: n.reply })}>
                    {n.label}
                  </button>
                ))}
                <button type="button" className="btn choice" onClick={() => setStep({ k: 'anger', exit: 'final' })}>
                  不用了
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="flow-text">{step.picked}</p>
              <button type="button" className="btn primary" onClick={() => setStep({ k: 'anger', exit: 'final' })}>
                繼續
              </button>
            </>
          )}
        </section>
      )}

      {step.k === 'anger' && <AngerCard onDone={() => exitAnger(step.exit)} />}

      {step.k === 'reuse' && (
        <section className="flow-card" data-testid="reuse-look">
          <p className="flow-text">要沿用這次的木偶外觀嗎？</p>
          <div className="flow-row">
            <button type="button" className="btn equal" onClick={() => onNewJerk(true)}>
              是
            </button>
            <button type="button" className="btn equal" onClick={() => onNewJerk(false)}>
              否
            </button>
          </div>
        </section>
      )}

      {step.k === 'final' && (
        <section className="flow-card" data-testid="final">
          <p className="flow-text">{t('謝謝{你}來打這一場。')}</p>
          <button type="button" className="btn primary" onClick={() => setStep({ k: 'reuse' })}>
            回到開始
          </button>
        </section>
      )}
    </div>
  );
}
