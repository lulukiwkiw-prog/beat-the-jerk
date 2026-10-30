import { useState } from 'react';
import { APOLOGY } from '../../config/dialogue.config';
import { FORM } from '../../config/form.config';
import { updateSession, useSession } from '../../state/session';
import { fillPronouns } from '../../state/text';

/**
 * 前後氣憤值（選填）。開打前也有填時並排顯示，不加評語、箭頭顏色或「進步」字眼。
 * 「現在」≥ 7 或高於開打前時，以小字顯示低調支援提示。
 */
export function AngerCard({ onDone }: { onDone: () => void }) {
  const s = useSession();
  const [now, setNow] = useState<number | null>(s.angerAfter);
  const before = s.angerSkipped ? null : s.angerBefore;
  const showHint = now != null && (now >= APOLOGY.supportThreshold || (before != null && now > before));
  const finish = (value: number | null) => {
    updateSession({ angerAfter: value });
    onDone();
  };
  return (
    <section className="flow-card" data-testid="anger-after">
      <h2>現在有多氣？<span className="opt">選填</span></h2>
      <div className="anger">
        <input
          type="range"
          min={FORM.angerMin}
          max={FORM.angerMax}
          step={1}
          value={now ?? 5}
          aria-label="現在有多氣（0 到 10）"
          aria-valuetext={now == null ? '還沒選' : String(now)}
          className={now == null ? 'untouched' : ''}
          onChange={(e) => setNow(Number(e.target.value))}
          data-testid="anger-after-range"
        />
        <output className="anger-val">{now ?? '—'}</output>
      </div>
      <div className="anger-scale" aria-hidden="true">
        <span>0 不氣</span>
        <span>10 氣炸</span>
      </div>
      {before != null && now != null && (
        <p className="anger-compare" data-testid="anger-compare">
          開打前：{before}{'\u3000'}現在：{now}
        </p>
      )}
      {showHint && (
        <p className="support-hint" data-testid="support-hint">
          {fillPronouns('如果這件事一直壓著{你}，找信任的人聊聊也很好。安心專線 1925', s.self, s.other)}
        </p>
      )}
      <div className="flow-row">
        <button type="button" className="btn equal" onClick={() => finish(null)}>
          略過
        </button>
        <button type="button" className="btn equal" onClick={() => finish(now)} disabled={now == null} data-testid="anger-done">
          完成
        </button>
      </div>
    </section>
  );
}
