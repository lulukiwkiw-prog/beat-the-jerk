/**
 * 回合計時：以實際經過時間（performance.now）累計；暫停時停止累計。
 * 時間到只會觸發一次。
 */
export class RoundClock {
  private elapsedMs = 0;
  private startedAt: number | null = null;
  private fired = false;

  constructor(
    public lengthSec: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get running() {
    return this.startedAt !== null;
  }

  start() {
    if (this.startedAt === null && !this.fired) this.startedAt = this.now();
  }

  pause() {
    if (this.startedAt === null) return;
    this.elapsedMs += this.now() - this.startedAt;
    this.startedAt = null;
  }

  resume() {
    this.start();
  }

  elapsed(): number {
    const live = this.startedAt === null ? 0 : this.now() - this.startedAt;
    return Math.min(this.lengthSec, (this.elapsedMs + live) / 1000);
  }

  remaining(): number {
    return Math.max(0, this.lengthSec - this.elapsed());
  }

  /** 時間到時回傳 true，之後永遠回傳 false（防重入）。 */
  checkExpired(): boolean {
    if (this.fired || this.remaining() > 0) return false;
    this.fired = true;
    this.pause();
    return true;
  }

  /** 延長回合（「繼續打」再 1 分鐘）。時間到之後不可延長。 */
  extend(sec: number) {
    if (this.fired) return;
    this.lengthSec += sec;
  }

  /** 提前結束（不再觸發時間到）。 */
  stop() {
    this.pause();
    this.fired = true;
  }
}

/** 讀取開發用網址參數 ?round=30。 */
export function devRoundOverride(search: string, min: number, max: number): number | null {
  const v = new URLSearchParams(search).get('round');
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}
