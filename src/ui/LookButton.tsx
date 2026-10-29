import { useEffect, useRef } from 'react';
import type { LookPreset } from '../game/puppet/looks/presets';
import { drawLookIcon } from './lookIcon';

const PX = 72;

/** 範例按鈕：用同一套畫法畫出小預覽。 */
export function LookButton({ look, disabled, onPick }: { look: LookPreset; disabled?: boolean; onPick: (id: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(PX * dpr);
    drawLookIcon(cv, look);
  }, [look]);
  return (
    <button type="button" className="face-btn" onClick={() => onPick(look.id)} disabled={disabled} aria-label={`套用範例：${look.label}`}>
      <canvas ref={ref} aria-hidden="true" />
      <span>{look.label}</span>
    </button>
  );
}
