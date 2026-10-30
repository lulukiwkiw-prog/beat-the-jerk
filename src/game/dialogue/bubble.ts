import { graphemes } from '../../state/text';
import { layoutBubble, resetBubbleScale } from '../../ui/bubble';

/**
 * 對話泡泡（HTML 疊層）：每個字一個 span。只用 textContent，不解析玩家輸入。
 */
export class DialogueBubble {
  private textEl: HTMLSpanElement;

  constructor(private readonly el: HTMLElement) {
    this.textEl = document.createElement('span');
    this.textEl.className = 'bubble-text';
    el.replaceChildren(this.textEl);
    el.hidden = true;
  }

  get visible() {
    return !this.el.hidden;
  }

  show(text: string) {
    resetBubbleScale(this.el);
    this.textEl.replaceChildren(
      ...graphemes(text).map((g) => {
        const s = document.createElement('span');
        s.textContent = g;
        return s;
      }),
    );
    this.el.hidden = false;
    this.el.classList.remove('shake');
  }

  shake() {
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  }

  hide() {
    this.el.hidden = true;
  }

  /** 每幀把泡泡放在頭部側邊（遠離玩家那一側）。 */
  layout(a: { headLeft: number; headRight: number; headY: number; prefer: 'left' | 'right'; topReserve: number; width: number; height: number }) {
    if (this.el.hidden) return;
    layoutBubble(this.el, {
      headLeft: a.headLeft,
      headRight: a.headRight,
      headY: a.headY,
      prefer: a.prefer,
      topReserve: a.topReserve,
      screenWidth: a.width,
      screenHeight: a.height,
    });
  }

  dispose() {
    this.el.hidden = true;
  }
}
