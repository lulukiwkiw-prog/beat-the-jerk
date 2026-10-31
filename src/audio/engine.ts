import { AUDIO } from '../config/audio.config';
import { settingsStore, type Settings } from '../state/settings';
import { midiToHz, notesAt, stepSeconds } from './pattern';

export type SfxName =
  | 'hitLight' | 'hitHeavy' | 'whoosh' | 'slap' | 'throw' | 'clang' | 'crash' | 'clatter' | 'bonk' | 'stomp'
  | 'alert' | 'hurt' | 'dodge' | 'combo' | 'beep' | 'go' | 'charge' | 'blast' | 'ko' | 'choir' | 'soft' | 'ask';

type MusicMode = 'battle' | 'calm' | null;

/**
 * 音效與音樂引擎：全部用 Web Audio API 即時合成。
 * 第一次點擊或按鍵之前不建立 AudioContext（瀏覽器限制），這段時間的播放要求直接忽略、不報錯。
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private mode: MusicMode = null;
  private fever = false;
  private paused = false;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private calmIndex = 0;

  /** 由使用者手勢呼叫：建立或喚醒 AudioContext。 */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = AUDIO.master;
        const comp = ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.apply(settingsStore.get());
        settingsStore.subscribe(() => this.apply(settingsStore.get()));
        if (this.mode) this.startScheduler();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private apply(s: Settings) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(s.sfxOn ? s.sfxVolume : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.musicOn && !this.paused ? s.musicVolume : 0, t, 0.08);
  }

  // ---------- 基本合成 ----------
  private env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private tone(bus: AudioNode, o: { type: OscillatorType; f0: number; f1?: number; t: number; dur: number; peak: number; attack?: number; filter?: number }) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, o.t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.t + o.dur);
    const g = ctx.createGain();
    this.env(g, o.t, o.peak, o.attack ?? 0.004, o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(bus);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  private hiss(bus: AudioNode, o: { t: number; dur: number; peak: number; type: BiquadFilterType; freq: number; freq1?: number; q?: number; attack?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, o.t);
    if (o.freq1) f.frequency.exponentialRampToValueAtTime(o.freq1, o.t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    this.env(g, o.t, o.peak, o.attack ?? 0.003, o.dur);
    src.connect(f).connect(g).connect(bus);
    src.start(o.t, Math.random() * 0.5);
    src.stop(o.t + o.dur + 0.05);
  }

  // ---------- 音效 ----------
  play(name: SfxName, strength = 1) {
    if (!this.ready) return;
    const b = this.sfxBus;
    const t = this.ctx!.currentTime + 0.005;
    const k = Math.max(0.2, Math.min(1.5, strength));
    switch (name) {
      case 'hitLight':
        this.tone(b, { type: 'sine', f0: 230, f1: 70, t, dur: 0.12, peak: 0.7 * k });
        this.hiss(b, { t, dur: 0.07, peak: 0.45 * k, type: 'bandpass', freq: 1600, q: 1.2 });
        break;
      case 'hitHeavy':
        this.tone(b, { type: 'sine', f0: 170, f1: 38, t, dur: 0.32, peak: 0.95 * k });
        this.tone(b, { type: 'square', f0: 90, f1: 40, t, dur: 0.12, peak: 0.18 * k, filter: 600 });
        this.hiss(b, { t, dur: 0.22, peak: 0.6 * k, type: 'lowpass', freq: 1800, freq1: 300 });
        break;
      case 'whoosh':
        this.hiss(b, { t, dur: 0.16, peak: 0.16 * k, type: 'bandpass', freq: 500, freq1: 2600, q: 1.6, attack: 0.04 });
        break;
      case 'slap':
        this.hiss(b, { t, dur: 0.08, peak: 0.75 * k, type: 'highpass', freq: 2200 });
        this.tone(b, { type: 'triangle', f0: 900, f1: 400, t, dur: 0.06, peak: 0.25 * k });
        break;
      case 'throw':
        this.hiss(b, { t, dur: 0.22, peak: 0.14 * k, type: 'bandpass', freq: 1800, freq1: 700, q: 2, attack: 0.03 });
        break;
      case 'clang':
        for (const [f, p] of [[523, 0.12], [1308, 0.08], [2036, 0.05]] as const) this.tone(b, { type: 'square', f0: f, t, dur: 0.6, peak: p * k, filter: 5000 });
        this.hiss(b, { t, dur: 0.05, peak: 0.4 * k, type: 'highpass', freq: 3000 });
        break;
      case 'crash':
        this.hiss(b, { t, dur: 0.55, peak: 0.7 * k, type: 'lowpass', freq: 2400, freq1: 400 });
        this.tone(b, { type: 'sine', f0: 120, f1: 40, t, dur: 0.35, peak: 0.8 * k });
        this.play('clatter', 0.6 * k);
        break;
      case 'clatter':
        for (let i = 0; i < 9; i++) {
          const ti = t + Math.random() * 0.45;
          this.hiss(b, { t: ti, dur: 0.03, peak: (0.15 + Math.random() * 0.2) * k, type: 'bandpass', freq: 2000 + Math.random() * 3000, q: 4 });
          this.tone(b, { type: 'triangle', f0: 700 + Math.random() * 900, t: ti, dur: 0.04, peak: 0.06 * k });
        }
        break;
      case 'bonk':
        this.tone(b, { type: 'triangle', f0: 620, f1: 260, t, dur: 0.14, peak: 0.35 * k });
        break;
      case 'stomp':
        this.tone(b, { type: 'sine', f0: 110, f1: 30, t, dur: 0.4, peak: 1 * k });
        this.hiss(b, { t, dur: 0.18, peak: 0.5 * k, type: 'lowpass', freq: 900 });
        this.tone(b, { type: 'sawtooth', f0: 300, f1: 90, t: t + 0.02, dur: 0.22, peak: 0.12 * k, filter: 1500 });
        break;
      case 'alert':
        this.tone(b, { type: 'square', f0: 880, t, dur: 0.07, peak: 0.12, filter: 3000 });
        this.tone(b, { type: 'square', f0: 1175, t: t + 0.08, dur: 0.08, peak: 0.12, filter: 3000 });
        break;
      case 'hurt':
        this.tone(b, { type: 'triangle', f0: 420, f1: 110, t, dur: 0.32, peak: 0.4 * k });
        break;
      case 'dodge':
        this.hiss(b, { t, dur: 0.14, peak: 0.12, type: 'bandpass', freq: 900, freq1: 3200, q: 2, attack: 0.02 });
        this.tone(b, { type: 'sine', f0: 900, f1: 1800, t: t + 0.04, dur: 0.12, peak: 0.12 });
        break;
      case 'combo':
        [72, 76, 79, 84].forEach((m, i) => this.tone(b, { type: 'square', f0: midiToHz(m), t: t + i * 0.06, dur: 0.1, peak: 0.1, filter: 4000 }));
        break;
      case 'beep':
        this.tone(b, { type: 'sine', f0: 660, t, dur: 0.12, peak: 0.25 });
        break;
      case 'go':
        this.tone(b, { type: 'square', f0: 988, t, dur: 0.3, peak: 0.16, filter: 4000 });
        this.tone(b, { type: 'square', f0: 1319, t: t + 0.05, dur: 0.3, peak: 0.12, filter: 4000 });
        break;
      case 'ask':
        this.tone(b, { type: 'triangle', f0: 523, t, dur: 0.25, peak: 0.2 });
        this.tone(b, { type: 'triangle', f0: 784, t: t + 0.12, dur: 0.35, peak: 0.2 });
        break;
      case 'charge': {
        // 集氣：上升的嗡嗡聲（約 1.8 秒）
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(520, t + 1.8);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 14;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.06;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 1.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.95);
        lfo.connect(lfoGain).connect(g.gain);
        osc.connect(f).connect(g).connect(b);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 2);
        lfo.stop(t + 2);
        break;
      }
      case 'blast':
        this.hiss(b, { t, dur: 1.3, peak: 0.9, type: 'lowpass', freq: 3000, freq1: 500, attack: 0.02 });
        this.tone(b, { type: 'sine', f0: 90, f1: 35, t, dur: 1.2, peak: 0.9 });
        this.tone(b, { type: 'sawtooth', f0: 220, f1: 110, t, dur: 0.9, peak: 0.12, filter: 1200 });
        break;
      case 'ko':
        for (const [f, p] of [[880, 0.22], [1320, 0.12], [1760, 0.08], [440, 0.15]] as const) this.tone(b, { type: 'sine', f0: f, t, dur: 1.8, peak: p });
        break;
      case 'choir': {
        // 合唱般的和聲（原諒的金光）
        const chord = [60, 64, 67, 72, 76];
        for (const m of chord) {
          for (const det of [-6, 6]) {
            const ctx = this.ctx!;
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = midiToHz(m);
            osc.detune.value = det;
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 1400;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.035, t + 1.2);
            g.gain.setValueAtTime(0.035, t + 3.5);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
            osc.connect(f).connect(g).connect(b);
            osc.start(t);
            osc.stop(t + 5.6);
          }
        }
        break;
      }
      case 'soft':
        for (const m of [57, 64, 69]) this.tone(b, { type: 'sine', f0: midiToHz(m), t, dur: 4.5, peak: 0.08, attack: 1.2 });
        break;
    }
  }

  // ---------- 音樂 ----------
  /** battle＝打擊樂；calm＝道歉、結局的安靜長音；null＝停 */
  setMusic(mode: MusicMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.step = 0;
    this.calmIndex = 0;
    if (!this.ctx) return;
    if (mode) this.startScheduler();
    else this.stopScheduler();
  }

  setFever(on: boolean) {
    this.fever = on;
  }

  /** 暫停時音樂靜音（不重新開始） */
  setPaused(p: boolean) {
    this.paused = p;
    if (this.ctx) this.apply(settingsStore.get());
  }

  private startScheduler() {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), AUDIO.tick);
  }

  private stopScheduler() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.mode) return;
    if (this.paused) {
      this.nextTime = Math.max(this.nextTime, ctx.currentTime);
      return;
    }
    while (this.nextTime < ctx.currentTime + AUDIO.lookahead) {
      if (this.mode === 'battle') {
        this.playStep(this.step, this.nextTime);
        this.step++;
        this.nextTime += stepSeconds(this.fever);
      } else {
        this.playCalm(this.calmIndex++, this.nextTime);
        this.nextTime += AUDIO.calmChord;
      }
    }
  }

  private playStep(step: number, t: number) {
    const m = this.musicBus;
    const n = notesAt(step, this.fever);
    if (n.kick) this.tone(m, { type: 'sine', f0: 150, f1: 45, t, dur: 0.22, peak: 0.75 });
    if (n.snare) {
      this.hiss(m, { t, dur: 0.14, peak: 0.32, type: 'highpass', freq: 1300 });
      this.tone(m, { type: 'triangle', f0: 190, f1: 140, t, dur: 0.08, peak: 0.2 });
    }
    if (n.clap) for (const d of [0, 0.012, 0.024]) this.hiss(m, { t: t + d, dur: 0.09, peak: 0.28, type: 'bandpass', freq: 1500, q: 1.4 });
    if (n.hat) this.hiss(m, { t, dur: 0.035, peak: this.fever ? 0.09 : 0.11, type: 'highpass', freq: 7000 });
    if (n.bass !== null) this.tone(m, { type: 'sawtooth', f0: midiToHz(n.bass), t, dur: stepSeconds(this.fever) * 1.6, peak: 0.22, filter: 650 });
    if (n.stab) for (const s of n.stab) this.tone(m, { type: 'square', f0: midiToHz(s), t, dur: 0.09, peak: 0.045, filter: 2600 });
  }

  private playCalm(i: number, t: number) {
    const root = AUDIO.progression[i % AUDIO.progression.length];
    const third = root === 45 ? 3 : 4;
    for (const m of [root, root + third + 12, root + 19]) this.tone(this.musicBus, { type: 'sine', f0: midiToHz(m), t, dur: AUDIO.calmChord * 1.3, peak: 0.07, attack: 0.9 });
  }
}

export const audio = new AudioEngine();

/** 第一次點擊或按鍵時啟動音訊（瀏覽器規定），之後每次手勢也確保沒有被暫停。 */
export function installAudioUnlock() {
  const go = () => audio.unlock();
  window.addEventListener('pointerdown', go, { passive: true });
  window.addEventListener('keydown', go);
}
