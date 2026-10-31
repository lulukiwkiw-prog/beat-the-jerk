import { EVENTS } from '../../config/round.config';

export type MiniEvent = 'fever' | 'shoe' | 'bounce';

export interface MinutePlan {
  shoe: number | null;
  bounce: number | null;
}

/** 安排某一分鐘的鞋子時間、彈墊時間（開始秒數；不出現為 null）。一個放前段、一個放後段。 */
export function planMinute(rand: () => number): MinutePlan {
  const at = (slot: readonly [number, number]) => slot[0] + rand() * (slot[1] - slot[0]);
  const shoeEarly = rand() < 0.5;
  const shoe = rand() < EVENTS.chance ? at(shoeEarly ? EVENTS.earlySlot : EVENTS.lateSlot) : null;
  const bounce = rand() < EVENTS.chance ? at(shoeEarly ? EVENTS.lateSlot : EVENTS.earlySlot) : null;
  return { shoe, bounce };
}

/**
 * 小型活動排程：依回合已經過的秒數算出目前有哪些活動，以及這一步剛開始的活動（顯示 2 秒提示用）。
 */
export class MiniEvents {
  private plans = new Map<number, MinutePlan>();
  private active = new Set<MiniEvent>();

  constructor(private readonly rand: () => number = Math.random) {}

  reset() {
    this.plans.clear();
    this.active.clear();
  }

  private plan(minute: number) {
    let p = this.plans.get(minute);
    if (!p) {
      p = planMinute(this.rand);
      this.plans.set(minute, p);
    }
    return p;
  }

  update(elapsed: number): { active: Set<MiniEvent>; started: MiniEvent[] } {
    const minute = Math.floor(elapsed / 60);
    const sec = elapsed - minute * 60;
    const p = this.plan(minute);
    const now = new Set<MiniEvent>();
    if (sec >= EVENTS.fever.from && sec < EVENTS.fever.to) now.add('fever');
    if (p.shoe !== null && sec >= p.shoe && sec < p.shoe + EVENTS.shoe.duration) now.add('shoe');
    if (p.bounce !== null && sec >= p.bounce && sec < p.bounce + EVENTS.bounce.duration) now.add('bounce');
    const started = [...now].filter((e) => !this.active.has(e));
    this.active = now;
    return { active: now, started };
  }

  /** 測試用：指定某一分鐘的安排 */
  setPlan(minute: number, plan: MinutePlan) {
    this.plans.set(minute, plan);
  }

  /** 全部結束（回合結束、致命一擊） */
  stop() {
    this.active.clear();
  }

  get current(): MiniEvent[] {
    return [...this.active];
  }
}
