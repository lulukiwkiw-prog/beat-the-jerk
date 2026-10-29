export type InputAction = { type: 'move'; slot: number } | { type: 'dodge' } | { type: 'toggleKind' } | { type: 'pause' };

/** 焦點在文字輸入框時不觸發任何遊戲快捷鍵。 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/**
 * 戰鬥輸入：鍵盤與畫面按鈕共用。移動是「按住」狀態，其他是一次性動作。
 * 觸控以 pointerId 追蹤，每顆按鈕各自管理自己的手指，可同時移動與攻擊。
 */
export class BattleInput {
  private heldKeys = { left: false, right: false };
  private heldPointers = { left: new Set<number>(), right: new Set<number>() };
  private queue: InputAction[] = [];
  private enabled = true;

  constructor(private readonly onPause: () => void) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  get left() {
    return this.heldKeys.left || this.heldPointers.left.size > 0;
  }
  get right() {
    return this.heldKeys.right || this.heldPointers.right.size > 0;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.releaseAll();
      this.queue = [];
    }
  }

  push(a: InputAction) {
    if (a.type === 'pause') {
      this.onPause();
      return;
    }
    if (this.enabled) this.queue.push(a);
  }

  /** 取出本步所有一次性動作。 */
  drain(): InputAction[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  pointerHold(dir: 'left' | 'right', pointerId: number, down: boolean) {
    if (down && this.enabled) this.heldPointers[dir].add(pointerId);
    else this.heldPointers[dir].delete(pointerId);
  }

  releaseAll = () => {
    this.heldKeys.left = this.heldKeys.right = false;
    this.heldPointers.left.clear();
    this.heldPointers.right.clear();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      this.onPause();
      return;
    }
    if (!this.enabled) return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.heldKeys.left = true;
      e.preventDefault();
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.heldKeys.right = true;
      e.preventDefault();
    } else if (k === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.push({ type: 'dodge' });
    } else if (k === 'q' || k === 'Q') {
      if (!e.repeat) this.push({ type: 'toggleKind' });
    } else if (/^[1-5]$/.test(k)) {
      if (!e.repeat) this.push({ type: 'move', slot: Number(k) - 1 });
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.heldKeys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') this.heldKeys.right = false;
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
  }
}
