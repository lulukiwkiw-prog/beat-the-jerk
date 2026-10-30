import { useEffect, useMemo, useRef, useState } from 'react';
import { APOLOGY } from '../../config/dialogue.config';
import { buildApology } from '../../game/apology/script';
import { filledD, useSession } from '../../state/session';
import { fillPronouns } from '../../state/text';

/**
 * 道歉稿逐段淡入。「加速」隨時可用；「顯示全文」在第一段播完後才出現。
 * 全部播完後出現「繼續」。
 */
export function ApologyOverlay({ startDelay, onDone }: { startDelay: number; onDone: () => void }) {
  const s = useSession();
  const paras = useMemo(
    () => buildApology({ self: s.self, other: s.other, a: s.a, feelings: s.feelings, d: filledD(s) }),
    // 道歉稿只在進入時產生一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [shown, setShown] = useState(0);
  const [fast, setFast] = useState(false);
  const timer = useRef(0);
  const done = shown >= paras.length;

  useEffect(() => {
    if (done) return;
    const gap = (shown === 0 ? startDelay : APOLOGY.paragraphGap) / (fast ? APOLOGY.fastFactor : 1);
    timer.current = window.setTimeout(() => setShown((n) => n + 1), gap * 1000);
    return () => window.clearTimeout(timer.current);
  }, [shown, fast, done, startDelay, paras.length]);

  return (
    <div className="story-overlay apology" data-testid="apology">
      <div className="story-text" aria-live="polite">
        {paras.slice(0, shown).map((p, i) => (
          <p key={i} className="story-para">
            {p.map((line, j) => (
              <span key={j} className="story-line">
                {line}
              </span>
            ))}
          </p>
        ))}
      </div>
      <div className="story-actions">
        {!done && (
          <button type="button" className="btn small" onClick={() => setFast(true)} disabled={fast} data-testid="apology-fast">
            加速
          </button>
        )}
        {!done && shown >= 1 && (
          <button type="button" className="btn small" onClick={() => setShown(paras.length)} data-testid="apology-all">
            顯示全文
          </button>
        )}
        {done && (
          <button type="button" className="btn primary" onClick={onDone} data-testid="apology-next">
            繼續
          </button>
        )}
      </div>
      <p className="story-corner">{fillPronouns('這是遊戲中替{你}演出的道歉。', s.self, s.other)}</p>
    </div>
  );
}

/** 「值得聽到」：停留至少 3 秒（可點擊繼續）後才出現結尾選項。 */
export function WorthyOverlay({ onDone }: { onDone: () => void }) {
  const s = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), APOLOGY.worthyMin * 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      className="story-overlay worthy"
      data-testid="worthy"
      onClick={() => ready && onDone()}
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : -1}
      onKeyDown={(e) => ready && (e.key === 'Enter' || e.key === ' ') && onDone()}
      aria-label={ready ? '點一下繼續' : undefined}
    >
      <p className="worthy-text">
        這些話，
        <br />
        {fillPronouns('是{你}本來就值得聽到的。', s.self, s.other)}
      </p>
      {ready && <span className="worthy-hint">點一下繼續</span>}
    </div>
  );
}
