import { useEffect, useRef, useState } from 'react';
import { PAINT } from '../config/paint.config';
import { PUPPET } from '../config/puppet.config';
import { getPaintStore } from '../game/puppet/paintSurface';
import { PART_DEFS, type PaintPartId } from '../game/puppet/parts';
import { PaintRoomController } from '../game/paintRoomController';
import { webglSupported } from '../game/three/renderer';
import { dispatch } from '../state/app';
import { enabledB, useSession } from '../state/session';
import { resetBubbleScale } from '../ui/bubble';
import { NoWebGL } from '../ui/NoWebGL';
import { LookButton } from '../ui/LookButton';
import { LOOK_KINDS, looksOf, type LookKind } from '../game/puppet/looks/presets';
import { Segmented } from '../ui/Segmented';

type Brush = (typeof PAINT.brushes)[number]['id'];

/** 步驟 1：木偶彩繪室 */
export function PaintScreen() {
  const session = useSession();
  const stageRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<PaintRoomController | null>(null);
  const paint = getPaintStore();
  const [color, setColor] = useState<string>(PAINT.colors[0].hex);
  const [brush, setBrush] = useState<Brush>('medium');
  const [eraser, setEraser] = useState(false);
  const [status, setStatus] = useState('直接在積木上畫；每一筆只會留在起筆的那一面');
  const [zoom, setZoom] = useState<PaintPartId | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [hist, setHist] = useState({ undo: paint.history.canUndo, redo: paint.history.canRedo });
  const [finishing, setFinishing] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [gl] = useState(webglSupported);
  const [lookKind, setLookKind] = useState<LookKind>('face');
  const [acc, setAcc] = useState(paint.accessories);

  useEffect(() => {
    if (!gl || !stageRef.current) return;
    const c = new PaintRoomController(stageRef.current, paint, {
      onStatus: setStatus,
      onZoomChange: setZoom,
      onPickModeChange: setPickMode,
    });
    ctrl.current = c;
    c.setBubble(bubbleRef.current);
    if (import.meta.env.DEV) (window as unknown as { __bt: unknown }).__bt = { paint, paintRoom: c };
    const off = paint.onChange(() => {
      setHist({ undo: paint.history.canUndo, redo: paint.history.canRedo });
      setAcc(paint.accessories);
    });
    const offAcc = paint.onAccessories(() => setAcc(paint.accessories));
    return () => {
      off();
      offAcc();
      c.dispose();
      ctrl.current = null;
    };
  }, [gl, paint]);

  useEffect(() => {
    const width = PAINT.brushes.find((b) => b.id === brush)!.width;
    ctrl.current?.setBrush({ color, width, eraser });
  }, [color, brush, eraser]);

  const finish = () => {
    if (finishing) return;
    const lines = enabledB(session);
    const pickLine = lines.length ? lines[Math.floor(Math.random() * lines.length)] : null;
    setFinishing(true);
    setLine(pickLine);
    // 手機上工具列在下方，先把積木人捲回畫面中，才看得到完成動畫
    stageRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (bubbleRef.current) resetBubbleScale(bubbleRef.current);
    ctrl.current?.playFinish(!!pickLine);
    window.setTimeout(() => dispatch('START_DUEL'), (gl ? PUPPET.finishAnimTime : 0.2) * 1000);
  };

  return (
    <main className="screen paint-screen">
      <header className="screen-head">
        <button type="button" className="btn small ghost" onClick={() => dispatch('BACK')} disabled={finishing}>
          ← 回通緝單
        </button>
        <h1>木偶彩繪室</h1>
      </header>

      <div className="paint-layout">
        <section className="paint-stage-box">
          <div className="paint-stage" ref={stageRef} data-testid="paint-stage">
            {!gl && <NoWebGL />}
            <div className="bubble" ref={bubbleRef} hidden={!line} data-testid="paint-bubble">
              {line}
            </div>
          </div>
          <div className="turn-row">
            <button type="button" className="btn" onClick={() => ctrl.current?.turnBy(-1)} disabled={finishing}>↶ 向左轉</button>
            <button type="button" className="btn" onClick={() => ctrl.current?.faceFront()} disabled={finishing}>正面</button>
            <button type="button" className="btn" onClick={() => ctrl.current?.turnBy(1)} disabled={finishing}>向右轉 ↷</button>
          </div>
          <p className="status" role="status">{status}</p>
        </section>

        <section className="tools" aria-label="彩繪工具">
          <div className="tool-group">
            <span className="tool-label">顏色</span>
            <div className="palette">
              {PAINT.colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className="swatch"
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  aria-pressed={!eraser && color === c.hex}
                  onClick={() => {
                    setColor(c.hex);
                    setEraser(false);
                  }}
                />
              ))}
            </div>
          </div>
          <div className="tool-group">
            <span className="tool-label">筆刷</span>
            <div className="btn-row">
              {PAINT.brushes.map((b) => (
                <button key={b.id} type="button" className="btn" aria-pressed={brush === b.id} onClick={() => setBrush(b.id)}>
                  <span className="dot" style={{ width: b.dot, height: b.dot }} /> {b.label}
                </button>
              ))}
              <button type="button" className="btn" aria-pressed={eraser} onClick={() => setEraser((v) => !v)}>
                橡皮擦
              </button>
            </div>
          </div>
          <div className="tool-group">
            <span className="tool-label">範例（疊畫在原本的畫上，可以再修改或復原）</span>
            <Segmented<LookKind> label="範例類別" value={lookKind} onChange={setLookKind} options={LOOK_KINDS.map((k) => ({ value: k.kind, label: k.label }))} />
            <div className="face-row">
              {looksOf(lookKind).map((l) => (
                <LookButton
                  key={l.id}
                  look={l}
                  disabled={finishing}
                  onPick={(id) => {
                    paint.applyLook(id);
                    if (l.kind !== 'costume' || !zoom) ctrl.current?.faceFront();
                    setStatus(`換上了：${l.label}`);
                  }}
                />
              ))}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                disabled={finishing}
                data-testid="random-look"
                onClick={() => {
                  const names = paint.randomize();
                  ctrl.current?.faceFront();
                  setStatus(`隨機造型：${names.join('＋')}`);
                }}
              >
                🎲 一鍵隨機造型
              </button>
            </div>
            {acc[lookKind] && (
              <button type="button" className="btn small" onClick={() => paint.removeAccessory(lookKind)} disabled={finishing}>
                拿掉立體配件
              </button>
            )}
          </div>
          <div className="tool-group">
            <span className="tool-label">部位</span>
            <div className="btn-row">
              {zoom ? (
                <button type="button" className="btn" onClick={() => ctrl.current?.zoomTo(null)}>
                  返回全身
                </button>
              ) : (
                <button type="button" className="btn" aria-pressed={pickMode} onClick={() => ctrl.current?.setPickMode(!pickMode)} disabled={finishing}>
                  {pickMode ? '點選要放大的部位…' : '點選部位放大'}
                </button>
              )}
              {zoom && <span className="zoom-name">正在放大：{PART_DEFS[zoom].label}</span>}
            </div>
          </div>
          <div className="tool-group">
            <span className="tool-label">編輯</span>
            <div className="btn-row">
              <button type="button" className="btn" disabled={!hist.undo || finishing} onClick={() => paint.undo()}>
                復原
              </button>
              <button type="button" className="btn" disabled={!hist.redo || finishing} onClick={() => paint.redo()}>
                重做
              </button>
              <button type="button" className="btn warn" onClick={() => setConfirmClear(true)} disabled={finishing}>
                清空彩繪
              </button>
            </div>
            {confirmClear && (
              <div className="confirm" role="alert">
                確定清空全部彩繪和立體配件？
                <button
                  type="button"
                  className="btn warn small"
                  onClick={() => {
                    paint.clearAll();
                    setConfirmClear(false);
                  }}
                >
                  清空
                </button>
                <button type="button" className="btn small" onClick={() => setConfirmClear(false)}>
                  取消
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn primary big" onClick={finish} disabled={finishing} data-testid="go-duel">
            就是你！出來決鬥！
          </button>
          <p className="note">不畫也可以直接出發。轉向按鈕可以畫側面和背面。</p>
        </section>
      </div>
    </main>
  );
}
