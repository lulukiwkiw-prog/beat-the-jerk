import { useEffect, useMemo, useState } from 'react';
import { APOLOGY } from '../../config/dialogue.config';
import { prefersReducedMotion } from '../../state/settings';
import { fillPronouns } from '../../state/text';
import { useSession } from '../../state/session';

/**
 * 降溫段：戰鬥中打出的星星緩緩升空，一圈光暈隨呼吸縮放（吸氣 4 秒、吐氣 6 秒，共 4 輪）。
 * 只顯示「吸氣」「吐氣」。右上角「略過」隨時可按。
 */
export function Breathing({ stars, onDone }: { stars: number; onDone: () => void }) {
  const s = useSession();
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<{ n: number; inhale: boolean }>({ n: 0, inhale: true });
  const starList = useMemo(
    () =>
      Array.from({ length: Math.max(8, Math.min(40, stars)) }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i * 0.73) % 10,
        dur: 10 + ((i * 3.1) % 8),
        size: 10 + ((i * 7) % 12),
      })),
    [stars],
  );

  useEffect(() => {
    const ms = (phase.inhale ? APOLOGY.inhale : APOLOGY.exhale) * 1000;
    const t = window.setTimeout(() => {
      if (!phase.inhale && phase.n + 1 >= APOLOGY.breaths) onDone();
      else setPhase((p) => (p.inhale ? { n: p.n, inhale: false } : { n: p.n + 1, inhale: true }));
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase, onDone]);

  const dur = phase.inhale ? APOLOGY.inhale : APOLOGY.exhale;
  return (
    <div className="calm" data-testid="breathing">
      <div className="calm-stars" aria-hidden="true">
        {starList.map((st, i) => (
          <span key={i} style={{ left: `${st.left}%`, animationDelay: `${st.delay}s`, animationDuration: `${st.dur}s`, fontSize: st.size }}>
            ★
          </span>
        ))}
      </div>
      <button type="button" className="btn small calm-skip" onClick={onDone} data-testid="breath-skip">
        略過
      </button>
      <h2 className="calm-title">{fillPronouns('最後，陪{你}慢慢呼吸一下', s.self, s.other)}</h2>
      <div
        className={`calm-ring ${reduced ? 'reduced' : ''}`}
        data-inhale={phase.inhale}
        style={{ transitionDuration: `${dur}s` }}
        aria-hidden="true"
      />
      <p className="calm-word" aria-live="polite">
        {phase.inhale ? '吸氣' : '吐氣'}
      </p>
    </div>
  );
}
