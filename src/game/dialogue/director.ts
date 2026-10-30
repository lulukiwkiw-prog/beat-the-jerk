import { DIALOGUE } from '../../config/dialogue.config';
import { charCount } from '../../state/text';

export type DialogueEvent = { type: 'show'; text: string } | { type: 'shake' } | { type: 'hide' };

interface Current {
  text: string;
  minUntil: number;
  hideAt: number;
}

export const minShowTime = (text: string) => DIALOGUE.base + charCount(text) * DIALOGUE.perChar;

/**
 * 木偶對話排程（SPEC 第 12 節，B 已依使用者要求移除）：
 * - 被打中時說 D；多句隨機輪替、不連續重複；沒有 D 時用預設句。
 * - 顯示中再被打中只抖動，不換句。
 */
export class DialogueDirector {
  current: Current | null = null;
  private lastD = '';
  private readonly dPool: string[];

  constructor(
    dLines: string[],
    private readonly rand: () => number = Math.random,
  ) {
    this.dPool = dLines.length ? dLines : [...DIALOGUE.defaultD];
  }

  private show(now: number, text: string): DialogueEvent {
    const min = minShowTime(text);
    this.current = { text, minUntil: now + min, hideAt: now + min + 0.6 };
    this.lastD = text;
    return { type: 'show', text };
  }

  private pick(pool: string[], last: string): string | null {
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let t = pool[Math.floor(this.rand() * pool.length)];
    for (let i = 0; i < 8 && t === last; i++) t = pool[Math.floor(this.rand() * pool.length)];
    return t === last ? pool.find((x) => x !== last)! : t;
  }

  /** 每步呼叫：時間到就收起泡泡。 */
  update(now: number): DialogueEvent[] {
    if (this.current && now >= this.current.hideAt) {
      this.current = null;
      return [{ type: 'hide' }];
    }
    return [];
  }

  /** 木偶被命中。 */
  onHit(now: number): DialogueEvent[] {
    const c = this.current;
    if (c && now < c.minUntil) {
      // 顯示中再被命中：不換句，只抖動，並延長顯示
      c.hideAt = Math.max(c.hideAt, now + 0.6);
      return [{ type: 'shake' }];
    }
    const d = this.pick(this.dPool, this.lastD);
    return d ? [this.show(now, d)] : [];
  }

  /** 回合結束：清掉對話 */
  stop(): DialogueEvent[] {
    this.current = null;
    return [{ type: 'hide' }];
  }
}
