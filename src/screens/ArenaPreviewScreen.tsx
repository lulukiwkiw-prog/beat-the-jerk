import { useEffect, useRef, useState } from 'react';
import { ArenaPreviewController, type PreviewAction } from '../game/arenaPreviewController';
import { getPaintStore } from '../game/puppet/paintSurface';
import { webglSupported } from '../game/three/renderer';
import { dispatch } from '../state/app';
import { NoWebGL } from '../ui/NoWebGL';

const ACTIONS: { id: PreviewAction; label: string }[] = [
  { id: 'punch', label: '被打一拳' },
  { id: 'slap', label: '甩巴掌' },
  { id: 'launch', label: '打上天' },
  { id: 'shoe', label: '鞋印' },
  { id: 'smash', label: '撞牆回彈' },
  { id: 'explode', label: '噴飛再組回' },
];

/**
 * 擂台預覽（階段 1）：確認自己畫的積木人在擂台上待機、受擊、噴飛。
 * 階段 2 會換成開戰準備與正式決鬥。
 */
export function ArenaPreviewScreen() {
  const stageRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<ArenaPreviewController | null>(null);
  const [gl] = useState(webglSupported);

  useEffect(() => {
    if (!gl || !stageRef.current || !fxRef.current || !flashRef.current) return;
    const c = new ArenaPreviewController(stageRef.current, fxRef.current, flashRef.current, getPaintStore());
    ctrl.current = c;
    if (import.meta.env.DEV) {
      const w = window as unknown as { __bt?: Record<string, unknown> };
      w.__bt = { ...(w.__bt ?? {}), paint: getPaintStore(), arena: c };
    }
    return () => {
      c.dispose();
      ctrl.current = null;
    };
  }, [gl]);

  return (
    <main className="screen arena-screen">
      <header className="screen-head">
        <button type="button" className="btn small ghost" onClick={() => dispatch('BACK')}>
          ← 回彩繪室
        </button>
        <h1>擂台預覽</h1>
      </header>
      <div className="arena-wrap">
        <div className="arena-stage" data-testid="arena-stage">
          <div className="arena-gl" ref={stageRef}>
            {!gl && <NoWebGL />}
          </div>
          <div className="fx-layer" ref={fxRef} aria-hidden="true" />
          <div className="flash" ref={flashRef} aria-hidden="true" />
        </div>
        <div className="preview-actions" role="group" aria-label="受擊測試">
          {ACTIONS.map((a) => (
            <button key={a.id} type="button" className="btn act" onClick={() => ctrl.current?.trigger(a.id)} disabled={!gl} data-testid={`act-${a.id}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <p className="note center">這是測試擂台：看看你畫的積木人被打、被打上天、散成一地再組回來。正式決鬥在下一個版本加入。</p>
    </main>
  );
}
