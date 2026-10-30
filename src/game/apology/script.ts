import type { OtherPronoun, SelfPronoun } from '../../state/text';
import { fillPronouns } from '../../state/text';

export interface ApologyInput {
  self: SelfPronoun;
  other: OtherPronoun;
  a: string;
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
 * 未填的心情、想聽的話整段略過，不出現變數名稱、空引號或多餘空行。
 */
export function buildApology(i: ApologyInput): string[][] {
  const t = (s: string) => fillPronouns(s, i.self, i.other);
  const paras: string[][] = [];
  const a = i.a.trim();
  if (a) paras.push([t('關於{你}寫下的這件事：'), `「${a}」`]);
  const feelings = i.feelings.map((x) => x.trim()).filter(Boolean);
  if (feelings.length) paras.push([t(`原來這件事，讓{你}感到${joinFeelings(feelings)}。`)]);
  paras.push([t('我不應該那樣對{你}。'), '我錯了，對不起。']);
  const d = i.d.map((x) => x.trim()).filter(Boolean);
  if (d.length) paras.push(d);
  paras.push([t('原不原諒，由{你}決定。'), t('{你}不需要現在回答。')]);
  return paras;
}
