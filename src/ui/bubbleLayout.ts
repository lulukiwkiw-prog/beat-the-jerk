export interface BubbleSideInput {
  /** 畫面寬（px） */
  screenWidth: number;
  /** 木偶頭部左右緣的螢幕 x（px） */
  headLeft: number;
  headRight: number;
  /** 優先放的方向（遠離玩家那一側） */
  prefer: 'left' | 'right';
  gap: number;
  edge: number;
  /** 最寬為畫面寬度的比例（SPEC：70%） */
  maxFrac: number;
}

export interface BubbleSide {
  side: 'left' | 'right';
  maxWidth: number;
}

/**
 * 對話泡泡放在頭部側邊（優先遠離玩家那一側，空間不足時改到另一側），
 * 寬度＝min(畫面 70%, 該側可用寬度)，不蓋住木偶身體。
 */
export function chooseBubbleSide(i: BubbleSideInput): BubbleSide {
  const cap = i.screenWidth * i.maxFrac;
  const room = {
    left: Math.max(0, i.headLeft - i.gap - i.edge),
    right: Math.max(0, i.screenWidth - i.edge - (i.headRight + i.gap)),
  };
  const other = i.prefer === 'left' ? 'right' : 'left';
  const comfortable = Math.min(cap, 160);
  const side = room[i.prefer] >= comfortable || room[i.prefer] >= room[other] ? i.prefer : other;
  return { side, maxWidth: Math.min(cap, room[side]) };
}

/** 依可用高度逐步縮小字級（最多縮到 minScale）。 */
export function fitFontScale(contentHeight: number, maxHeight: number, scale: number, minScale = 0.6): number {
  if (contentHeight <= maxHeight || scale <= minScale) return scale;
  return Math.max(minScale, scale * Math.max(0.85, Math.sqrt(maxHeight / contentHeight)));
}
