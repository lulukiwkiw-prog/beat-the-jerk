import { AUDIO, PATTERN } from '../config/audio.config';

export interface StepNotes {
  kick: boolean;
  snare: boolean;
  clap: boolean;
  hat: boolean;
  /** 貝斯 MIDI 音高，沒有則為 null */
  bass: number | null;
  /** 和弦刷奏（三個 MIDI 音），沒有則為 null */
  stab: number[] | null;
}

/** 第 step 步（從 0 起算，跨小節連續）要演奏的聲部。純函式，方便測試。 */
export function notesAt(step: number, fever: boolean): StepNotes {
  const s = step % 16;
  const bar = Math.floor(step / 16) % AUDIO.progression.length;
  const root = AUDIO.progression[bar];
  const bassHit = PATTERN.bass.find(([st]) => st === s);
  // 小和弦（A）用小三度，其餘大三度
  const third = root === 45 ? 3 : 4;
  return {
    kick: ((fever ? PATTERN.feverKick : PATTERN.kick) as readonly number[]).includes(s),
    snare: !fever && (PATTERN.snare as readonly number[]).includes(s),
    clap: fever && (PATTERN.feverClap as readonly number[]).includes(s),
    // 一般每兩步一下，狂熱時間每一步
    hat: fever ? true : s % 2 === 0,
    bass: bassHit ? root - 12 + bassHit[1] : null,
    stab: fever && (PATTERN.stab as readonly number[]).includes(s) ? [root + 12, root + 12 + third, root + 19] : null,
  };
}

/** 一步的秒數（16 分音符） */
export const stepSeconds = (fever: boolean) => 60 / (fever ? AUDIO.feverBpm : AUDIO.bpm) / 4;

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
