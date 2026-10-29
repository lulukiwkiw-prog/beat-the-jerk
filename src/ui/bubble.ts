import { chooseBubbleSide, fitFontScale } from './bubbleLayout';

export interface BubbleAnchor {
  /** 頭部左右緣與中心高度（畫布內 px） */
  headLeft: number;
  headRight: number;
  headY: number;
  prefer: 'left' | 'right';
  /** 不可遮住的上方區域高度（HUD） */
  topReserve: number;
  screenWidth: number;
  screenHeight: number;
}

const GAP = 14;
const EDGE = 6;

/**
 * 每幀把對話泡泡放到頭部側邊。寬度不夠時縮窄並換行，再不夠就縮小字級。
 */
export function layoutBubble(el: HTMLElement, a: BubbleAnchor) {
  const { side, maxWidth } = chooseBubbleSide({
    screenWidth: a.screenWidth,
    headLeft: a.headLeft,
    headRight: a.headRight,
    prefer: a.prefer,
    gap: GAP,
    edge: EDGE,
    maxFrac: 0.7,
  });
  el.style.maxWidth = `${Math.max(60, maxWidth)}px`;
  const maxH = Math.max(40, a.screenHeight - a.topReserve - EDGE * 2);
  let scale = Number(el.dataset.scale ?? '1');
  const next = fitFontScale(el.offsetHeight, maxH, scale);
  if (next !== scale) {
    scale = next;
    el.dataset.scale = String(scale);
    el.style.setProperty('--bubble-scale', String(scale));
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = side === 'right' ? a.headRight + GAP : a.headLeft - GAP - w;
  el.classList.toggle('tail-right', side === 'left');
  el.style.left = `${Math.max(EDGE, Math.min(a.screenWidth - w - EDGE, x))}px`;
  el.style.top = `${Math.max(a.topReserve + EDGE, Math.min(a.screenHeight - h - EDGE, a.headY - h / 2))}px`;
}

export function resetBubbleScale(el: HTMLElement) {
  el.dataset.scale = '1';
  el.style.setProperty('--bubble-scale', '1');
}
