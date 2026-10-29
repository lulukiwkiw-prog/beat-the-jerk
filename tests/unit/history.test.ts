import { describe, expect, it } from 'vitest';
import { History } from '../../src/game/puppet/history';

function setup(limit = 30) {
  const data: Record<string, number> = { a: 0, b: 0 };
  const h = new History<string, number>(limit, (k) => data[k], (k, v) => (data[k] = v));
  const edit = (k: string, v: number) => {
    h.record([k]);
    data[k] = v;
  };
  return { data, h, edit };
}

describe('復原／重做', () => {
  it('復原後重做回到修改後的狀態', () => {
    const { data, h, edit } = setup();
    edit('a', 1);
    edit('a', 2);
    h.undo();
    expect(data.a).toBe(1);
    h.undo();
    expect(data.a).toBe(0);
    h.redo();
    expect(data.a).toBe(1);
    h.redo();
    expect(data.a).toBe(2);
    expect(h.canRedo).toBe(false);
  });
  it('至少保留 30 步，超過時捨棄最舊的', () => {
    const { data, h, edit } = setup(30);
    for (let i = 1; i <= 35; i++) edit('a', i);
    let n = 0;
    while (h.undo()) n++;
    expect(n).toBe(30);
    expect(data.a).toBe(5);
  });
  it('新的修改會清掉重做', () => {
    const { h, edit } = setup();
    edit('a', 1);
    h.undo();
    edit('b', 1);
    expect(h.canRedo).toBe(false);
  });
  it('一步可包含多個 key（清空）', () => {
    const { data, h } = setup();
    data.a = 3;
    data.b = 4;
    h.record(['a', 'b']);
    data.a = data.b = 0;
    h.undo();
    expect(data).toEqual({ a: 3, b: 4 });
  });
});
