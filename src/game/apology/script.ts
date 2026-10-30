import type { OtherPronoun, SelfPronoun } from '../../state/text';
import { fillPronouns } from '../../state/text';

export interface ApologyInput {
  self: SelfPronoun;
  other: OtherPronoun;
  a: string;
  /** 已填寫的 B：text 與是否勾選「戰鬥中出現」 */
  b: { text: string; inBattle: boolean }[];
  feelings: string[];
  d: string[];
}

/** C 以「、」連接，最後一項前用「和」。 */
export function joinFeelings(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join('、')}和${list[list.length - 1]}`;
}

/**
 * 道歉稿（SPEC 第 14 節）：逐段淡入用的段落。玩家原文不改寫；
 * 未填的 B、C、D 整段略過，不出現變數名稱、空引號或多餘空行。
 */
export function buildApology(i: ApologyInput): string[][] {
  const t = (s: string) => fillPronouns(s, i.self, i.other);
  const paras: string[][] = [];
  const a = i.a.trim();
  if (a) paras.push([t('關於{你}寫下的這件事：'), `「${a}」`]);
  const filledB = i.b.map((x) => ({ ...x, text: x.text.trim() })).filter((x) => x.text);
  const checked = filledB.filter((x) => x.inBattle);
  // B 只列出勾選的；全部取消勾選時列出全部已填的
  const bList = (checked.length ? checked : filledB).map((x) => x.text);
  if (bList.length) paras.push(['我當時還說：', ...bList.map((x) => `「${x}」`)]);
  const feelings = i.feelings.map((x) => x.trim()).filter(Boolean);
  if (feelings.length) paras.push([t(`原來這些話，讓{你}感到${joinFeelings(feelings)}。`)]);
  paras.push([t('我不應該那樣對{你}。'), '我錯了，對不起。']);
  const d = i.d.map((x) => x.trim()).filter(Boolean);
  if (d.length) paras.push(d);
  paras.push([t('原不原諒，由{你}決定。'), t('{你}不需要現在回答。')]);
  return paras;
}
