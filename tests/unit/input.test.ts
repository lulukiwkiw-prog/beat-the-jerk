import { describe, expect, it } from 'vitest';
import { BattleInput, isTyping } from '../../src/game/engine/input';

describe('輸入', () => {
  it('焦點在文字輸入框時不觸發快捷鍵', () => {
    const inp = document.createElement('input');
    const ta = document.createElement('textarea');
    const div = document.createElement('div');
    expect(isTyping(inp)).toBe(true);
    expect(isTyping(ta)).toBe(true);
    expect(isTyping(div)).toBe(false);
    const b = new BattleInput(() => {});
    document.body.append(inp);
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(b.drain()).toEqual([]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(b.drain()).toEqual([{ type: 'move', slot: 0 }]);
    b.dispose();
  });
  it('多指：移動按住與出招互不影響', () => {
    const b = new BattleInput(() => {});
    b.pointerHold('left', 1, true);
    b.push({ type: 'move', slot: 1 });
    expect(b.left).toBe(true);
    expect(b.drain()).toEqual([{ type: 'move', slot: 1 }]);
    b.pointerHold('left', 2, true);
    b.pointerHold('left', 1, false);
    expect(b.left).toBe(true);
    b.pointerHold('left', 2, false);
    expect(b.left).toBe(false);
    b.dispose();
  });
  it('停用時放開所有按住的移動', () => {
    const b = new BattleInput(() => {});
    b.pointerHold('right', 1, true);
    b.setEnabled(false);
    expect(b.right).toBe(false);
    b.dispose();
  });
});
