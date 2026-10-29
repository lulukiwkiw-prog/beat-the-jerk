export interface Spring {
  v: number;
  vel: number;
}

export const spring0 = (v = 0): Spring => ({ v, vel: 0 });

/** 半隱式彈簧：往 target 逼近並帶回彈。 */
export function stepSpring(s: Spring, target: number, k: number, d: number, dt: number) {
  s.vel += ((target - s.v) * k - s.vel * d) * dt;
  s.v += s.vel * dt;
}

/** 固定長度的時間延遲緩衝：取得約 delay 秒前的值。 */
export class DelayBuffer<T> {
  private buf: { t: number; v: T }[] = [];
  constructor(private readonly delay: number, private readonly initial: T) {}
  push(t: number, v: T) {
    this.buf.push({ t, v });
    while (this.buf.length > 2 && this.buf[1].t <= t - this.delay) this.buf.shift();
  }
  get(t: number): T {
    for (let i = this.buf.length - 1; i >= 0; i--) if (this.buf[i].t <= t - this.delay) return this.buf[i].v;
    return this.buf.length ? this.buf[0].v : this.initial;
  }
  reset() {
    this.buf = [];
  }
}
