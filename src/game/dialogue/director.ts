import { DIALOGUE } from '../../config/dialogue.config';
import { charCount } from '../../state/text';

export type LineKind = 'B' | 'D';
export type DialogueEvent =
  | { type: 'show'; text: string; kind: LineKind }
  | { type: 'shake' }
  | { type: 'shatter'; bonus: boolean }
  | { type: 'hide' }
  | { type: 'tauntDone' };

interface Current {
  text: string;
  kind: LineKind;
  minUntil: number;
  hideAt: number;
}

export const minShowTime = (text: string) => DIALOGUE.base + charCount(text) * DIALOGUE.perChar;

/**
 * 木偶對話排程（SPEC 第 12 節）：
 * - 開場挑釁依序說出啟用的 B（每句一次）。
 * - 戰鬥中賤話預設關；開啟後木偶未受擊時每 6～10 秒說一則，不連續重複。
 * - B 顯示時被打中：文字碎成星星（每則 B 只能被打碎一次，之後不再說），再顯示 D。
 * - D 多句隨機輪替、不連續重複；顯示中再被打中只抖動。
 */
export class DialogueDirector {
  current: Current | null = null;
  private tauntQueue: string[] = [];
  private tauntNext = 0;
  private tauntActive = false;
  private chatterT: number;
  private lastB = '';
  private lastD = '';
  private shattered = new Set<string>();
  private pendingD: number | null = null;
  private readonly dPool: string[];

  constructor(
    private readonly bLines: string[],
    dLines: string[],
    private readonly rand: () => number = Math.random,
  ) {
    this.dPool = dLines.length ? dLines : [...DIALOGUE.defaultD];
    this.chatterT = this.nextChatter();
  }

  private nextChatter() {
    return DIALOGUE.chatterMin + this.rand() * (DIALOGUE.chatterMax - DIALOGUE.chatterMin);
  }

  get tauntRunning() {
    return this.tauntActive;
  }

  /** 開場挑釁；沒有 B 時立刻結束。 */
  startTaunt(now: number): DialogueEvent[] {
    this.tauntQueue = [...this.bLines];
    this.tauntActive = true;
    this.tauntNext = now;
    return this.update(now, false, false, 0);
  }

  skipTaunt(): DialogueEvent[] {
    if (!this.tauntActive) return [];
    this.tauntActive = false;
    this.tauntQueue = [];
    this.current = null;
    return [{ type: 'hide' }, { type: 'tauntDone' }];
  }

  private show(now: number, text: string, kind: LineKind): DialogueEvent {
    const min = minShowTime(text);
    this.current = { text, kind, minUntil: now + min, hideAt: now + min + 0.6 };
    if (kind === 'B') this.lastB = text;
    else this.lastD = text;
    return { type: 'show', text, kind };
  }

  private pick(pool: string[], last: string): string | null {
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let t = pool[Math.floor(this.rand() * pool.length)];
    for (let i = 0; i < 8 && t === last; i++) t = pool[Math.floor(this.rand() * pool.length)];
    return t === last ? pool.find((x) => x !== last)! : t;
  }

  /** 每步呼叫。chatterOn＝「賤話：開」；live＝戰鬥中且未暫停。 */
  update(now: number, chatterOn: boolean, live: boolean, dt: number): DialogueEvent[] {
    const ev: DialogueEvent[] = [];
    if (this.tauntActive) {
      if (now >= this.tauntNext && (!this.current || now >= this.current.minUntil)) {
        const next = this.tauntQueue.shift();
        if (next) {
          ev.push(this.show(now, next, 'B'));
          this.tauntNext = this.current!.minUntil + DIALOGUE.tauntGap;
        } else {
          this.tauntActive = false;
          this.current = null;
          ev.push({ type: 'hide' }, { type: 'tauntDone' });
        }
      }
      return ev;
    }
    if (this.pendingD !== null && now >= this.pendingD) {
      this.pendingD = null;
      const d = this.pick(this.dPool, this.lastD);
      if (d) ev.push(this.show(now, d, 'D'));
    }
    if (this.current && now >= this.current.hideAt && this.pendingD === null) {
      this.current = null;
      ev.push({ type: 'hide' });
    }
    if (live && chatterOn && !this.current && this.pendingD === null) {
      this.chatterT -= dt;
      if (this.chatterT <= 0) {
        this.chatterT = this.nextChatter();
        const b = this.pick(this.bLines.filter((x) => !this.shattered.has(x)), this.lastB);
        if (b) ev.push(this.show(now, b, 'B'));
      }
    }
    return ev;
  }

  /** 木偶被命中。回傳 shatter 時 bonus＝是否加「打碎！」分數。 */
  onHit(now: number): DialogueEvent[] {
    this.chatterT = this.nextChatter();
    const c = this.current;
    if (c && c.kind === 'B' && this.pendingD === null) {
      const bonus = !this.shattered.has(c.text);
      this.shattered.add(c.text);
      this.current = null;
      this.pendingD = now + DIALOGUE.shatterTime;
      return [{ type: 'shatter', bonus }];
    }
    if (this.pendingD !== null) return [];
    if (c && c.kind === 'D' && now < c.minUntil) {
      // 顯示中再被命中：不換句，只抖動，並延長顯示
      c.hideAt = Math.max(c.hideAt, now + 0.6);
      return [{ type: 'shake' }];
    }
    const d = this.pick(this.dPool, this.lastD);
    return d ? [this.show(now, d, 'D')] : [];
  }

  /** 回合結束：清掉對話 */
  stop(): DialogueEvent[] {
    this.tauntActive = false;
    this.pendingD = null;
    this.current = null;
    return [{ type: 'hide' }];
  }
}
