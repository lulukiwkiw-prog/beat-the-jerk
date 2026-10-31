import { describe, expect, it } from 'vitest';
import { buildApology, joinFeelings } from '../../src/game/apology/script';

const base = { self: '你' as const, other: '他' as const, a: '明明是他沒做事，卻當眾怪我。', feelings: [], d: [] };
const text = (p: string[][]) => p.map((x) => x.join('\n')).join('\n\n');

describe('道歉稿', () => {
  it('心情的連接：一項、兩項、多項', () => {
    expect(joinFeelings(['生氣'])).toBe('生氣');
    expect(joinFeelings(['生氣', '委屈'])).toBe('生氣和委屈');
    expect(joinFeelings(['生氣', '委屈', '難過'])).toBe('生氣、委屈和難過');
  });
  it('心情、想聽的話全空：用通用台詞補上，沒有空引號或變數名稱', () => {
    const p = buildApology(base);
    expect(p).toHaveLength(5);
    const s = text(p);
    expect(s).not.toMatch(/「」|\{|\}|undefined|null/);
    expect(s).not.toContain('我當時還說');
    expect(s).toContain('「明明是他沒做事，卻當眾怪我。」');
    expect(s).toContain('我知道，那讓你很不好受。');
    expect(s).toContain('這不是你的錯。');
    expect(s).toContain('原不原諒，由你決定。');
  });
  it('通緝單整個沒填：每一段都用通用台詞，讀起來通順', () => {
    const p = buildApology({ ...base, a: '', self: '妳', other: '她' });
    expect(p.map((x) => x[0])).toEqual(['那件讓妳難受的事，', '我知道，那讓妳很不好受。', '我不應該那樣對妳。', '這不是妳的錯。', '原不原諒，由妳決定。']);
    expect(text(p)).not.toMatch(/「|」|\{|\}|undefined|null/);
  });
  it('完整填寫：段落順序與內容', () => {
    const p = buildApology({
      ...base,
      self: '妳',
      feelings: ['生氣', '委屈'],
      d: ['不是妳的錯', ''],
    });
    expect(p.map((x) => x[0])).toEqual(['關於妳寫下的這件事：', '原來這件事，讓妳感到生氣和委屈。', '我不應該那樣對妳。', '不是妳的錯', '原不原諒，由妳決定。']);
    expect(text(p)).not.toContain('我當時還說');
  });
  it('只有心情、只有想聽的話的組合', () => {
    expect(buildApology({ ...base, feelings: ['失望'] }).map((x) => x[0])).toContain('原來這件事，讓你感到失望。');
    const p = buildApology({ ...base, d: ['我不應該那樣對你', '對不起'] });
    expect(p[3]).toEqual(['我不應該那樣對你', '對不起']);
  });
  it('保留原文（含 <script>、表情符號），不改寫', () => {
    const p = buildApology({ ...base, a: '<script>alert(1)</script>😡' });
    expect(p[0][1]).toBe('「<script>alert(1)</script>😡」');
  });
});
