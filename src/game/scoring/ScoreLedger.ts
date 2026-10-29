import { SCORING } from '../../config/scoring.config';
import type { MoveId } from '../../config/moves.config';

export type HitId = string;

export interface HitEvent {
  hitId: HitId;
  move: MoveId;
  /** 本段基本分 */
  base: number;
  /** 命中當下的遊戲時間（秒） */
  at: number;
  /** 額外加分（例如空中追擊） */
  extra?: { points: number; label: string };
}

export interface ScoreLine {
  points: number;
  /** 空字串＝一般命中分數；其他為加分原因 */
  label: string;
}

export interface HitResult {
  scored: boolean;
  lines: ScoreLine[];
  combo: number;
  /** 這一擊讓連擊達到 comboStep 的倍數 */
  comboMilestone: boolean;
}

/**
 * 計分帳本：同一 hitId 只結算一次；連擊 2 秒內延續；每 10 連擊 +50；
 * 3 秒內命中 3 種不同招式 +40。落空不經過帳本，所以不得分、不計連擊。
 */
export class ScoreLedger {
  score = 0;
  combo = 0;
  maxCombo = 0;
  private lastHitAt = -Infinity;
  private seen = new Set<HitId>();
  private recent: { move: MoveId; at: number }[] = [];

  resolve(e: HitEvent): HitResult {
    if (this.seen.has(e.hitId)) return { scored: false, lines: [], combo: this.combo, comboMilestone: false };
    this.seen.add(e.hitId);
    const lines: ScoreLine[] = [{ points: e.base, label: '' }];
    if (e.extra) lines.push({ points: e.extra.points, label: e.extra.label });

    this.combo = e.at - this.lastHitAt <= SCORING.comboWindow ? this.combo + 1 : 1;
    this.lastHitAt = e.at;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const milestone = this.combo % SCORING.comboStep === 0;
    if (milestone) lines.push({ points: SCORING.comboBonus, label: `${this.combo} 連擊！` });

    this.recent.push({ move: e.move, at: e.at });
    this.recent = this.recent.filter((r) => e.at - r.at <= SCORING.varietyWindow);
    if (new Set(this.recent.map((r) => r.move)).size >= SCORING.varietyCount) {
      lines.push({ points: SCORING.varietyBonus, label: '招式組合！' });
      this.recent = [];
    }

    for (const l of lines) this.score += l.points;
    return { scored: true, lines, combo: this.combo, comboMilestone: milestone };
  }

  /** 每步呼叫：連擊逾時歸零。 */
  tick(now: number) {
    if (this.combo && now - this.lastHitAt > SCORING.comboWindow) this.combo = 0;
  }

  /** 其他加分（不影響連擊），例如閃避。 */
  bonus(points: number) {
    this.score += points;
  }
}
