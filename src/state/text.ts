/** 文字工具：以「字素」計算字數（表情符號、組合字算 1 字）。 */
const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }) : null;

export function graphemes(s: string): string[] {
  if (!s) return [];
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

export function charCount(s: string): number {
  return graphemes(s).length;
}

export interface LimitResult {
  value: string;
  /** 被擋下沒有輸入的字數（>0 時要提示玩家） */
  dropped: number;
}

/**
 * 依上限合併一次編輯：只截掉「這次新插入」的超出部分，絕不刪除已輸入的內容。
 * 以前後共同字串找出插入片段。
 */
export function applyLimit(prev: string, next: string, max: number): LimitResult {
  const nextCount = charCount(next);
  if (nextCount <= max) return { value: next, dropped: 0 };
  const a = graphemes(prev);
  const b = graphemes(next);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  // 保留下來的舊內容＝前綴＋後綴；中間是這次插入的新字
  const inserted = b.slice(pre, b.length - suf);
  const room = Math.max(0, max - (pre + suf));
  const allowed = inserted.slice(0, room);
  return {
    value: [...b.slice(0, pre), ...allowed, ...b.slice(b.length - suf)].join(''),
    dropped: inserted.length - allowed.length,
  };
}

export type SelfPronoun = '你' | '妳';
export type OtherPronoun = '他' | '她';

/** 把 {你}、{他} 換成玩家選的稱謂。 */
export function fillPronouns(template: string, self: SelfPronoun, other: OtherPronoun): string {
  return template.replaceAll('{你}', self).replaceAll('{他}', other);
}
