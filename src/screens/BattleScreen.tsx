import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MOVE_SETS, MOVES, type MoveKind } from '../config/moves.config';
import { ROUND } from '../config/round.config';
import { BattleController, type HudState } from '../game/battle/BattleController';
import { getPaintStore } from '../game/puppet/paintSurface';
import { webglSupported } from '../game/three/renderer';
import { dispatch, screenStore, useScreen } from '../state/app';
import { battleStore, effectiveRoundLength, resultStore, updateBattle } from '../state/battle';
import { filledD, resetForNewJerk, sessionStore, useSession } from '../state/session';
import { fillPronouns } from '../state/text';
import { APOLOGY } from '../config/dialogue.config';
import { ApologyOverlay, WorthyOverlay } from '../ui/flow/ApologyOverlay';
import { EndingFlow } from '../ui/flow/EndingFlow';
import { NoWebGL } from '../ui/NoWebGL';
import { openSettings, useSettingsOpen } from '../ui/SettingsPanel';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const INITIAL: HudState = {
  phase: 'countdown', timeLeft: 0, score: 0, combo: 0, maxCombo: 0, kind: 'hand', cooldowns: {}, countdown: '3', paused: false, cine: '',
};

/** 步驟 2～結尾：決鬥、道歉、結尾都在同一個 3D 擂台場景裡 */
/** 可以暫停、提前結束的階段 */
const LIVE_PHASES: HudState['phase'][] = ['countdown', 'fight'];

export function BattleScreen() {
  const screen = useScreen();
  const session = useSession();
  const t = (x: string) => fillPronouns(x, session.self, session.other);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [story, setStory] = useState<'none' | 'apology' | 'worthy'>('none');
  const apologyStarted = useRef(false);
  const inStory = screen === 'apology' || screen === 'ending';
  const settingsOpen = useSettingsOpen();
  const stageRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<BattleController | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL);
  const [banner, setBanner] = useState<{ text: string; id: number } | null>(null);
  const [gl] = useState(webglSupported);
  const paused = screen === 'paused';

  useEffect(() => {
    if (!gl || !stageRef.current || !fxRef.current || !flashRef.current || !alertRef.current || !bubbleRef.current) return;
    const ses = sessionStore.get();
    let bannerTimer = 0;
    const c = new BattleController(
      { stage: stageRef.current, fx: fxRef.current, flash: flashRef.current, alert: alertRef.current, bubble: bubbleRef.current },
      getPaintStore(),
      effectiveRoundLength(battleStore.get()),
      {
        onHud: setHud,
        onBanner: (text) => {
          setBanner({ text, id: Date.now() });
          window.clearTimeout(bannerTimer);
          bannerTimer = window.setTimeout(() => setBanner(null), ROUND.bannerTime * 1000);
        },
        onRequestPause: () => {
          if (screenStore.get() === 'battle') dispatch('PAUSE');
          else if (screenStore.get() === 'paused') dispatch('RESUME');
        },
        onEnd: (r) => {
          resultStore.set(r);
          dispatch('END_ROUND');
        },
      },
      { dLines: filledD(ses) },
    );
    ctrl.current = c;
    if (import.meta.env.DEV) {
      const w = window as unknown as { __bt?: Record<string, unknown> };
      w.__bt = { ...(w.__bt ?? {}), paint: getPaintStore(), battle: c };
    }
    return () => {
      window.clearTimeout(bannerTimer);
      c.dispose();
      ctrl.current = null;
    };
  }, [gl]);

  // 進入道歉：轉場演出＋道歉稿
  useEffect(() => {
    if (screen === 'apology' && !apologyStarted.current) {
      apologyStarted.current = true;
      setConfirmEnd(false);
      ctrl.current?.startApology();
      setStory('apology');
    }
  }, [screen]);

  // 狀態機的暫停 ⇄ 戰鬥同步到控制器
  useEffect(() => {
    ctrl.current?.setPaused(paused);
  }, [paused]);

  // 開啟設定時自動暫停
  useEffect(() => {
    if (settingsOpen && screenStore.get() === 'battle') dispatch('PAUSE');
  }, [settingsOpen]);

  const hold = (dir: 'left' | 'right') => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 不支援時忽略 */
      }
      ctrl.current?.input.pointerHold(dir, e.pointerId, true);
      e.currentTarget.classList.add('on');
    },
    onPointerUp: (e: RPointerEvent<HTMLButtonElement>) => {
      ctrl.current?.input.pointerHold(dir, e.pointerId, false);
      e.currentTarget.classList.remove('on');
    },
    onPointerCancel: (e: RPointerEvent<HTMLButtonElement>) => {
      ctrl.current?.input.pointerHold(dir, e.pointerId, false);
      e.currentTarget.classList.remove('on');
    },
    onLostPointerCapture: (e: RPointerEvent<HTMLButtonElement>) => {
      ctrl.current?.input.pointerHold(dir, e.pointerId, false);
      e.currentTarget.classList.remove('on');
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const setKind = (k: MoveKind) => ctrl.current?.setKind(k);
  const moves = MOVE_SETS[hud.kind];

  const early = resultStore.get()?.early ?? false;
  const apologyDelay = APOLOGY.walkTime + APOLOGY.warmTime + (early ? APOLOGY.earlyExtraWarm : 0);

  return (
    <main className={`screen battle-screen ${inStory ? 'story-mode' : ''}`}>
      <div className="battle-wrap">
        <div className="battle-stage" data-testid="battle-stage">
          <div className="battle-gl" ref={stageRef}>
            {!gl && <NoWebGL />}
          </div>
          <div className="fx-layer" ref={fxRef} aria-hidden="true" />
          <div className="flash" ref={flashRef} aria-hidden="true" />
          <div className="ai-alert" ref={alertRef} hidden aria-hidden="true">！</div>
          <div className="bubble battle-bubble" ref={bubbleRef} hidden data-testid="battle-bubble" />

          {hud.phase === 'finisher' && (
            <div className="cine" aria-live="polite" data-testid="finisher-cine">
              <div className="cine-bar top" />
              <div className="cine-bar bottom" />
              {hud.cine === 'title' && <div className="cine-title">致命一擊</div>}
              {hud.cine === 'ko' && <div className="cine-title ko">K.O.!</div>}
            </div>
          )}
          {hud.phase === 'ask' && !inStory && (
            <div className="overlay finisher-ask" data-testid="finisher-ask">
              <p className="ask-time">剩 {hud.timeLeft} 秒</p>
              <h2>{t('要給{他}致命一擊嗎？')}</h2>
              <div className="btn-row center">
                <button type="button" className="btn primary big" onClick={() => ctrl.current?.chooseFinisher()} data-testid="finisher-yes">
                  致命一擊！
                </button>
                <button type="button" className="btn big" onClick={() => ctrl.current?.chooseContinue()} data-testid="finisher-more">
                  繼續打（再 {ROUND.extendBy / 60} 分鐘）
                </button>
              </div>
            </div>
          )}

          {!inStory && (
          <div className={`hud ${hud.phase === 'finisher' ? 'hidden-cine' : ''}`}>
            <div className="hud-left">
              <div className="chip-stat">時間<b data-testid="hud-time">{fmt(hud.timeLeft)}</b></div>
              <div className="chip-stat">分數<b data-testid="hud-score">{hud.score}</b></div>
              <div className="chip-stat">連擊<b data-testid="hud-combo">{hud.combo}</b></div>
              <div className="chip-stat">最高<b>{hud.maxCombo}</b></div>
            </div>
            <div className="hud-right">
              <button type="button" className="icon-btn" aria-label="暫停" onClick={() => dispatch('PAUSE')} disabled={!LIVE_PHASES.includes(hud.phase)} data-testid="pause">
                ❚❚
              </button>
              <button type="button" className="icon-btn" aria-label="設定" onClick={openSettings}>
                ⚙
              </button>
            </div>
          </div>
          )}
          {confirmEnd && !inStory && (
            <div className="overlay" data-testid="confirm-end">
              <h2>{t('打夠了，要聽{他}說嗎？')}</h2>
              <div className="btn-row center">
                <button
                  type="button"
                  className="btn primary big"
                  onClick={() => {
                    setConfirmEnd(false);
                    if (screenStore.get() === 'paused') dispatch('RESUME');
                    ctrl.current?.endEarly();
                  }}
                  data-testid="confirm-end-yes"
                >
                  {t('聽{他}說')}
                </button>
                <button
                  type="button"
                  className="btn big"
                  onClick={() => {
                    setConfirmEnd(false);
                    if (screenStore.get() === 'paused') dispatch('RESUME');
                  }}
                >
                  繼續打
                </button>
              </div>
            </div>
          )}
          {screen === 'apology' && story === 'apology' && (
            <ApologyOverlay
              startDelay={apologyDelay}
              onDone={() => {
                ctrl.current?.showWorthy();
                setStory('worthy');
              }}
            />
          )}
          {screen === 'apology' && story === 'worthy' && <WorthyOverlay onDone={() => dispatch('APOLOGY_DONE')} />}
          {screen === 'ending' && (
            <EndingFlow
              stars={resultStore.get()?.hits ?? 0}
              onShow={(k) => ctrl.current?.playEnding(k)}
              onRematch={() => {
                updateBattle({ autoStart: true });
                dispatch('REMATCH');
              }}
              onNewJerk={(reuse) => {
                if (!reuse) getPaintStore().resetAll();
                resetForNewJerk();
                dispatch('NEW_JERK');
              }}
            />
          )}

          {hud.phase === 'countdown' && !paused && <div className="countdown" aria-live="polite">{hud.countdown}</div>}
          {banner && (
            <div className="banner" key={banner.id} role="status">
              {banner.text}
            </div>
          )}

          {paused && !confirmEnd && (
            <div className="overlay" data-testid="pause-overlay">
              <h2>暫停中</h2>
              <div className="btn-row center">
                <button type="button" className="btn primary big" onClick={() => dispatch('RESUME')} data-testid="resume">
                  繼續
                </button>
                <button
                  type="button"
                  className="btn big"
                  onClick={() => {
                    ctrl.current?.restart();
                    dispatch('RESUME');
                  }}
                  data-testid="restart"
                >
                  重新開始
                </button>
              </div>
            </div>
          )}
        </div>

        {!inStory && (
        <div className="controls" aria-label="操作">
          <div className="pad-left">
            <button type="button" className="ctl" aria-label="往左" {...hold('left')} data-testid="ctl-left">◀</button>
            <button
              type="button"
              className="ctl"
              aria-label="閃避"
              onPointerDown={(e) => {
                e.preventDefault();
                ctrl.current?.input.push({ type: 'dodge' });
              }}
              onClick={(e) => e.detail === 0 && ctrl.current?.input.push({ type: 'dodge' })}
            >
              閃避
            </button>
            <button type="button" className="ctl" aria-label="往右" {...hold('right')} data-testid="ctl-right">▶</button>
          </div>
          <div className="pad-right">
            <div className="kinds" role="radiogroup" aria-label="徒手／武器">
              {(['hand', 'weapon'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={hud.kind === k} className="kind" onClick={() => setKind(k)} data-testid={`kind-${k}`}>
                  {k === 'hand' ? '徒手' : '武器'}
                </button>
              ))}
            </div>
            <div className="moves" data-count={moves.length}>
              {moves.map((id, i) => {
                const cd = hud.cooldowns[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    className="ctl mv"
                    aria-label={`${MOVES[id].name}（${i + 1}）`}
                    data-testid={`move-${id}`}
                    style={{ ['--cd' as string]: String(Math.min(1, cd / MOVES[id].cooldown)) }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      ctrl.current?.pressSlot(i);
                    }}
                    onClick={(e) => e.detail === 0 && ctrl.current?.pressSlot(i)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <span className="cd" aria-hidden="true" />
                    {cd > 0 && <span className="cdt">{cd.toFixed(1)}</span>}
                    <span className="mv-name">{MOVES[id].name}</span>
                    <small>{i + 1}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
        {!inStory && (
          <div className="battle-extra">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (screenStore.get() === 'battle') dispatch('PAUSE');
                setConfirmEnd(true);
              }}
              disabled={!LIVE_PHASES.includes(hud.phase)}
              data-testid="end-early"
            >
              {t('打夠了，聽{他}說')}
            </button>
          </div>
        )}
      </div>
      {!inStory && (
        <p className="keys">
          電腦：<kbd>A</kbd><kbd>D</kbd> 或方向鍵移動、<kbd>1</kbd>～<kbd>{moves.length}</kbd> 出招、<kbd>Q</kbd> 切換徒手／武器、<kbd>空白</kbd> 閃避、<kbd>Esc</kbd> 暫停
        </p>
      )}
    </main>
  );
}
