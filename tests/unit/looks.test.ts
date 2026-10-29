import { describe, expect, it } from 'vitest';
import { ACCESSORY_IDS, buildAccessory } from '../../src/game/puppet/looks/accessories';
import { LOOKS, looksOf } from '../../src/game/puppet/looks/presets';

describe('範例', () => {
  it('臉部 10、髮型 7、服裝 6 款', () => {
    expect(looksOf('face')).toHaveLength(10);
    expect(looksOf('hair')).toHaveLength(7);
    expect(looksOf('costume')).toHaveLength(6);
  });
  it('名稱不重複、沒有真實人物名稱', () => {
    const labels = LOOKS.map((l) => l.kind + l.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(LOOKS.some((l) => /川普|trump/i.test(l.label + l.id))).toBe(false);
  });
  it('每個 3D 配件都能建出來，且掛在存在的部位', () => {
    const parts = ['head', 'torso', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'thighL', 'thighR', 'shinL', 'shinR', 'handL', 'handR', 'shoeL', 'shoeR'];
    for (const id of ACCESSORY_IDS) {
      const list = buildAccessory(id);
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) expect(parts).toContain(a.part);
    }
  });
  it('範例引用的配件都存在', () => {
    for (const l of LOOKS) if (l.accessory) expect(ACCESSORY_IDS).toContain(l.accessory);
  });
});
