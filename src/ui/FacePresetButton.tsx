import { useEffect, useRef } from 'react';
import { PART_DEFS } from '../game/puppet/parts';
import { drawFacePreset, type FacePresetId } from '../game/puppet/facePresets';
import { PUPPET } from '../config/puppet.config';

interface Props {
  id: FacePresetId;
  label: string;
  disabled?: boolean;
  onPick: (id: FacePresetId) => void;
}

const PX = 72;

/** 臉部範例按鈕：用同一套畫法畫出小預覽。 */
export function FacePresetButton({ id, label, disabled, onPick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const c = cv?.getContext('2d');
    if (!cv || !c) return;
    const [w, h] = PART_DEFS.head.size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(PX * dpr);
    cv.height = Math.round(((PX * h) / w) * dpr);
    c.fillStyle = PUPPET.baseColor;
    c.fillRect(0, 0, cv.width, cv.height);
    c.scale(cv.width / w, cv.height / h);
    drawFacePreset(id, c, w, h);
  }, [id]);
  return (
    <button type="button" className="face-btn" onClick={() => onPick(id)} disabled={disabled} aria-label={`套用臉部範例：${label}`}>
      <canvas ref={ref} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
