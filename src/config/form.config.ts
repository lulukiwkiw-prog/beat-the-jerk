/** 步驟 0 通緝單欄位限制（SPEC 第 6 節） */
export const FORM = {
  aMax: 300,
  bMax: 80,
  bDefaultRows: 3,
  bMaxRows: 8,
  dMax: 80,
  dDefaultRows: 1,
  dMaxRows: 5,
  feelings: ['生氣', '委屈', '難過', '羞辱', '無助', '害怕', '失望', '被背叛'],
  customFeelingMax: 10,
  customFeelingsMaxCount: 5,
  angerMin: 0,
  angerMax: 10,
} as const;
