import { describe, expect, it } from 'vitest';
import { buildApology, joinFeelings } from '../../src/game/apology/script';

const base = { self: '你' as const, other: '他' as const, a: '明明是他沒做事，卻當眾怪我。', b: [], feelings: [], d: [] };
const text = (p: string[][]) => p.map((x) => x.join('\n')).join('\n\n');

describe('道歉稿', () => {
  it('C 的連接：一項、兩項、多項', () => {
    expect(joinFeelings(['生氣'])).toBe('生氣');
    expect(joinFeelings(['生氣', '委屈'])).toBe('生氣和委屈');
    expect(joinFeelings(['生氣', '委屈', '難過'])).toBe('生氣、委屈和難過');
  });
  it('B、C、D 全空：只有 A 段、道歉段、結語，沒有空引號或變數名稱', () => {
    const p = buildApology(base);
    expect(p).toHaveLength(3);
    const s = text(p);
    expect(s).not.toMatch(/「」|\{|\}|undefined|null/);
    expect(s).not.toContain('我當時還說');
    expect(s).not.toContain('原來這些話');
    expect(s).toContain('「明明是他沒做事，卻當眾怪我。」');
    expect(s).toContain('原不原諒，由你決定。');
  });
  it('完整填寫：段落順序與內容', () => {
    const p = buildApology({
      ...base,
      self: '妳',
      b: [{ text: '這點小事都做不好？', inBattle: true }, { text: '  ', inBattle: true }, { text: '沒勾的', inBattle: false }],
      feelings: ['生氣', '委屈'],
      d: ['不是妳的錯', ''],
    });
    expect(p.map((x) => x[0])).toEqual(['關於妳寫下的這件事：', '我當時還說：', '原來這些話，讓妳感到生氣和委屈。', '我不應該那樣對妳。', '不是妳的錯', '原不原諒，由妳決定。']);
    expect(p[1]).toEqual(['我當時還說：', '「這點小事都做不好？」']);
  });
  it('B 全部取消勾選時列出全部已填的', () => {
    const p = buildApology({ ...base, b: [{ text: '甲', inBattle: false }, { text: '乙', inBattle: false }] });
    expect(p[1]).toEqual(['我當時還說：', '「甲」', '「乙」']);
  });
  it('只有 C、只有 D 的組合', () => {
    expect(buildApology({ ...base, feelings: ['失望'] }).map((x) => x[0])).toContain('原來這些話，讓你感到失望。');
    const p = buildApology({ ...base, d: ['我不應該那樣對你', '對不起'] });
    expect(p[2]).toEqual(['我不應該那樣對你', '對不起']);
  });
  it('保留原文（含 <script>、表情符號），不改寫', () => {
    const p = buildApology({ ...base, a: '<script>alert(1)</script>😡' });
    expect(p[0][1]).toBe('「<script>alert(1)</script>😡」');
  });
});
