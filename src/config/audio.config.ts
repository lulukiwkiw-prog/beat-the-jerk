/** 音效與音樂（SPEC 第 2、5 節：Web Audio API 程式合成，不使用外部音檔） */
export const AUDIO = {
  /** 預設音量（0～1） */
  defaultSfx: 0.8,
  defaultMusic: 0.5,
  /** 總音量上限，避免多個音效疊加時爆音 */
  master: 0.85,
  /** 音樂：每分鐘拍數（一般、狂熱時間）、排程提前量（秒）、排程間隔（毫秒） */
  bpm: 122,
  feverBpm: 150,
  lookahead: 0.12,
  tick: 25,
  /** 和弦進行（MIDI 根音，每小節一個）：C、Am、F、G */
  progression: [48, 45, 41, 43],
  /** 道歉、結局時的安靜長音（每個和弦秒數） */
  calmChord: 3.2,
  /** 音樂淡入淡出（秒） */
  fade: 0.6,
} as const;

/** 一小節 16 步的鼓與貝斯（打擊樂風格）。狂熱時間加密鼓點、加和弦刷奏。 */
export const PATTERN = {
  kick: [0, 4, 8, 12],
  feverKick: [0, 4, 8, 10, 12],
  snare: [4, 12],
  feverClap: [4, 12, 14],
  /** 貝斯：步數與相對根音的半音 */
  bass: [
    [0, 0],
    [3, 0],
    [6, 7],
    [8, 0],
    [11, 12],
    [14, 7],
  ] as [number, number][],
  /** 狂熱時間的和弦刷奏（反拍） */
  stab: [2, 6, 10],
} as const;
