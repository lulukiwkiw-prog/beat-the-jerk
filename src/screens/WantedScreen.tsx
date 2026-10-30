import { useState } from 'react';
import { FORM } from '../config/form.config';
import { dispatch } from '../state/app';
import { isWantedValid, newId, updateSession, useSession } from '../state/session';
import { fillPronouns, type OtherPronoun, type SelfPronoun } from '../state/text';
import { CharField } from '../ui/CharField';
import { Segmented } from '../ui/Segmented';

/** 步驟 0：情緒通緝單 */
export function WantedScreen() {
  const s = useSession();
  const t = (x: string) => fillPronouns(x, s.self, s.other);
  const [custom, setCustom] = useState('');
  const valid = isWantedValid(s);
  const allFeelings = [...FORM.feelings, ...s.customFeelings];

  const toggleFeeling = (f: string) =>
    updateSession((p) => ({ feelings: p.feelings.includes(f) ? p.feelings.filter((x) => x !== f) : [...p.feelings, f] }));

  const addCustom = () => {
    const v = custom.trim();
    if (!v || s.customFeelings.length >= FORM.customFeelingsMaxCount) return;
    if (allFeelings.includes(v)) {
      if (!s.feelings.includes(v)) toggleFeeling(v);
      setCustom('');
      return;
    }
    updateSession((p) => ({ customFeelings: [...p.customFeelings, v], feelings: [...p.feelings, v] }));
    setCustom('');
  };

  const removeCustom = (f: string) =>
    updateSession((p) => ({ customFeelings: p.customFeelings.filter((x) => x !== f), feelings: p.feelings.filter((x) => x !== f) }));

  return (
    <main className="screen wanted-screen">
      <header className="title-block">
        <h1>打爆<em>那個爛人</em>！</h1>
        <p className="sub">把沒說出口的話，打成滿天星星。</p>
      </header>

      <form className="poster" onSubmit={(e) => e.preventDefault()} aria-label="情緒通緝單">
        <div className="poster-head">
          <span className="poster-tag">WANTED</span>
          <h2>情緒通緝單</h2>
        </div>
        <p className="privacy">建議使用綽號，不要輸入真實姓名或可辨識的公司資訊。你寫的內容只存在這台裝置。</p>

        <div className="row2">
          <Segmented<SelfPronoun>
            label="你希望遊戲怎麼稱呼你？"
            value={s.self}
            onChange={(self) => updateSession({ self })}
            options={[{ value: '你', label: '你' }, { value: '妳', label: '妳' }]}
          />
          <Segmented<OtherPronoun>
            label="對手是？"
            value={s.other}
            onChange={(other) => updateSession({ other })}
            options={[{ value: '他', label: '他' }, { value: '她', label: '她' }]}
          />
        </div>

        <section className="q">
          <h3>A．{t('{你}')}為什麼想打爆這個人？<span className="req">必填</span></h3>
          <CharField
            ariaLabel="A．為什麼想打爆這個人"
            value={s.a}
            onChange={(a) => updateSession({ a })}
            max={FORM.aMax}
            multiline
            rows={4}
            placeholder={t('明明是{他}沒做事，卻當眾怪我。')}
            testId="field-a"
          />
        </section>


        <section className="q">
          <h3>B．{t('{你}')}當時的心情？<span className="opt">選填，可複選</span></h3>
          <div className="chips" role="group" aria-label="心情">
            {allFeelings.map((f) => (
              <span key={f} className="chip-wrap">
                <button type="button" className="chip" aria-pressed={s.feelings.includes(f)} onClick={() => toggleFeeling(f)}>
                  {f}
                </button>
                {s.customFeelings.includes(f) && (
                  <button type="button" className="chip-x" aria-label={`移除自訂心情 ${f}`} onClick={() => removeCustom(f)}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {s.customFeelings.length < FORM.customFeelingsMaxCount ? (
            <div className="custom-row">
              <CharField ariaLabel="自訂心情" value={custom} onChange={setCustom} max={FORM.customFeelingMax} placeholder="自己寫一個" />
              <button type="button" className="btn small" onClick={addCustom} disabled={!custom.trim()}>
                新增（{s.customFeelings.length}／{FORM.customFeelingsMaxCount}）
              </button>
            </div>
          ) : (
            <p className="note">自訂心情最多 {FORM.customFeelingsMaxCount} 個。</p>
          )}
        </section>

        <section className="q">
          <h3>C．{t('{你}希望{他}對{你}說什麼？')}<span className="opt">選填</span></h3>
          {s.d.map((line, i) => (
            <div className="line-row" key={line.id}>
              <CharField
                ariaLabel={`C 第 ${i + 1} 句`}
                value={line.text}
                onChange={(text) => updateSession((p) => ({ d: p.d.map((l) => (l.id === line.id ? { ...l, text } : l)) }))}
                max={FORM.dMax}
                placeholder={i === 0 ? t('不是{你}的錯') : t('我不應該那樣對{你}')}
                testId={`field-d-${i}`}
              />
              {s.d.length > 1 && (
                <div className="line-tools">
                  <button
                    type="button"
                    className="btn small ghost"
                    aria-label={`刪除 C 第 ${i + 1} 句`}
                    onClick={() => updateSession((p) => ({ d: p.d.filter((l) => l.id !== line.id) }))}
                  >
                    刪除
                  </button>
                </div>
              )}
            </div>
          ))}
          {s.d.length < FORM.dMaxRows && (
            <button type="button" className="btn small" onClick={() => updateSession((p) => ({ d: [...p.d, { id: newId(), text: '' }] }))}>
              ＋ 再加一句（{s.d.length}／{FORM.dMaxRows}）
            </button>
          )}
        </section>

        <section className="q">
          <h3>現在有多氣？<span className="opt">選填</span></h3>
          <div className="anger">
            <input
              type="range"
              min={FORM.angerMin}
              max={FORM.angerMax}
              step={1}
              value={s.angerBefore ?? 5}
              disabled={s.angerSkipped}
              aria-label="現在有多氣（0 到 10）"
              aria-valuetext={s.angerBefore == null ? '還沒選' : String(s.angerBefore)}
              onChange={(e) => updateSession({ angerBefore: Number(e.target.value) })}
              className={s.angerBefore == null ? 'untouched' : ''}
            />
            <output className="anger-val">{s.angerSkipped ? '略過' : s.angerBefore ?? '—'}</output>
            <label className="check">
              <input type="checkbox" checked={s.angerSkipped} onChange={(e) => updateSession({ angerSkipped: e.target.checked })} />
              略過
            </label>
          </div>
          <div className="anger-scale" aria-hidden="true">
            <span>0 不氣</span>
            <span>10 氣炸</span>
          </div>
        </section>

        <div className="actions">
          {!valid && <p className="why" id="why-disabled">先寫下 A．{t('{你}')}為什麼想打爆這個人，才能繼續。</p>}
          <button
            type="button"
            className="btn primary big"
            disabled={!valid}
            aria-describedby={valid ? undefined : 'why-disabled'}
            onClick={() => dispatch('SUBMIT_WANTED')}
            data-testid="go-paint"
          >
            去畫那個爛人
          </button>
        </div>
      </form>
    </main>
  );
}
