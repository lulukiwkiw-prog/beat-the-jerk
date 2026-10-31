import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, deleteContent, deleteLook, listLooks, loadContent, MAX_LOOKS, saveContent, saveLook } from '../../src/storage/saves';

const look = { parts: { head: 'data:image/png;base64,AAAA' }, accessories: { hat: 'topHat' as const } };
const content = { savedAt: 1, self: '你' as const, other: '他' as const, a: '原因', feelings: ['生氣'], customFeelings: [], d: ['不是你的錯'], angerBefore: 6 };

describe('儲存（這台裝置）', () => {
  beforeEach(() => window.localStorage.clear());
  it('外觀：存、列出、刪除，自動命名', () => {
    const a = saveLook(look, 1)!;
    const b = saveLook(look, 2)!;
    expect([a.name, b.name]).toEqual(['外觀 1', '外觀 2']);
    expect(listLooks()).toHaveLength(2);
    deleteLook(a.id);
    expect(listLooks().map((l) => l.name)).toEqual(['外觀 2']);
    expect(saveLook(look, 3)!.name).toBe('外觀 1');
  });
  it(`最多 ${MAX_LOOKS} 個`, () => {
    for (let i = 0; i < MAX_LOOKS; i++) expect(saveLook(look, i)).not.toBeNull();
    expect(saveLook(look, 99)).toBeNull();
  });
  it('存不下時回傳失敗，不丟錯', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(saveLook(look)).toBeNull();
      expect(saveContent(content)).toBe(false);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
  it('內容：存、讀、刪', () => {
    expect(loadContent()).toBeNull();
    saveContent(content);
    expect(loadContent()?.a).toBe('原因');
    deleteContent();
    expect(loadContent()).toBeNull();
  });
  it('壞掉的資料會被忽略', () => {
    window.localStorage.setItem('btj.looks', '{oops');
    window.localStorage.setItem('btj.content', JSON.stringify({ a: 3 }));
    expect(listLooks()).toEqual([]);
    expect(loadContent()).toBeNull();
  });
  it('清除所有遊戲資料：只刪本遊戲的鍵', () => {
    saveLook(look);
    saveContent(content);
    window.localStorage.setItem('btj.settings', '{}');
    window.localStorage.setItem('other.app', 'keep');
    expect(clearAllData()).toBe(true);
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith('btj.'))).toEqual([]);
    expect(window.localStorage.getItem('other.app')).toBe('keep');
  });
});
