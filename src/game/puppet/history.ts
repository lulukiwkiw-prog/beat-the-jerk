/**
 * 復原／重做堆疊。每一步記錄若干「補丁」，復原時先擷取目前狀態供重做使用。
 * 與畫布無關，方便單元測試。
 */
export interface Patch<K, D> {
  key: K;
  before: D;
  after?: D;
}

export class History<K, D> {
  private undoStack: Patch<K, D>[][] = [];
  private redoStack: Patch<K, D>[][] = [];

  constructor(
    private readonly limit: number,
    private readonly capture: (key: K) => D,
    private readonly apply: (key: K, data: D) => void,
  ) {}

  /** 在修改前呼叫：記錄這些 key 目前的內容。 */
  record(keys: K[]): void {
    if (!keys.length) return;
    this.undoStack.push(keys.map((key) => ({ key, before: this.capture(key) })));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): boolean {
    const step = this.undoStack.pop();
    if (!step) return false;
    for (const p of step) p.after = this.capture(p.key);
    for (let i = step.length - 1; i >= 0; i--) this.apply(step[i].key, step[i].before);
    this.redoStack.push(step);
    return true;
  }

  redo(): boolean {
    const step = this.redoStack.pop();
    if (!step) return false;
    for (const p of step) {
      const now = this.capture(p.key);
      if (p.after !== undefined) this.apply(p.key, p.after);
      p.before = now;
    }
    this.undoStack.push(step);
    return true;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get size() {
    return this.undoStack.length;
  }
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
