import { DIALOGUE } from '../../config/dialogue.config';
import { graphemes } from '../../state/text';
import { layoutBubble, resetBubbleScale } from '../../ui/bubble';

/**
 * 對話泡泡（HTML 疊層）：每個字一個 span，打碎時逐字變成星星飛散。
 * 只用 textContent，不解析玩家輸入。
 */
export class DialogueBubble {
  private textEl: HTMLSpanElement;
  private shattering: HTMLDivElement | null = null;

  constructor(private readonly el: HTMLElement, private readonly layer: HTMLElement) {
    this.textEl = document.createElement('span');
    this.textEl.className = 'bubble-text';
    el.replaceChildren(this.textEl);
    el.hidden = true;
  }

  get visible() {
    return !this.el.hidden;
  }

  show(text: string, kind: 'B' | 'D') {
    this.clearShatter();
    resetBubbleScale(this.el);
    this.textEl.replaceChildren(
      ...graphemes(text).map((g) => {
        const s = document.createElement('span');
        s.textContent = g;
        return s;
      }),
    );
    this.el.dataset.kind = kind;
    this.el.hidden = false;
    this.el.classList.remove('shake');
  }

  shake() {
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  }

  /** 逐字碎成星星飛散後消失；減少動態效果時改為淡出。 */
  shatter(reduced: boolean) {
    if (this.el.hidden) return;
    const ms = DIALOGUE.shatterTime * 1000;
    const host = this.layer.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'shatter';
    wrap.setAttribute('aria-hidden', 'true');
    for (const s of Array.from(this.textEl.children) as HTMLSpanElement[]) {
      const r = s.getBoundingClientRect();
      const piece = document.createElement('span');
      piece.className = 'shard';
      piece.textContent = s.textContent;
      piece.style.left = `${r.left - host.left}px`;
      piece.style.top = `${r.top - host.top}px`;
      wrap.appendChild(piece);
      if (reduced) {
        piece.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = 40 + Math.random() * 70;
        const dx = Math.cos(a) * d;
        const dy = Math.sin(a) * d - 30;
        // 前半段是字、後半段變成星星
        piece.animate(
          [
            { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${dx * 0.4}px,${dy * 0.4}px) rotate(${(Math.random() - 0.5) * 180}deg) scale(1.1)`, opacity: 1, offset: 0.35 },
            { transform: `translate(${dx}px,${dy}px) rotate(${(Math.random() - 0.5) * 540}deg) scale(0.6)`, opacity: 0 },
          ],
          { duration: ms, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
        );
        window.setTimeout(() => {
          piece.textContent = '★';
          piece.classList.add('star');
        }, ms * 0.3);
      }
    }
    this.layer.appendChild(wrap);
    this.shattering = wrap;
    this.el.hidden = true;
    window.setTimeout(() => this.clearShatter(), ms + 50);
  }

  private clearShatter() {
    this.shattering?.remove();
    this.shattering = null;
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
    this.clearShatter();
    this.el.hidden = true;
  }
}
