import { Color, Fog, Vector3 } from 'three';
import { CAMERA, GAME } from '../../config/game.config';
import { EFFECTS } from '../../config/effects.config';
import { H, MOVE_SETS, MOVES, PLAYER, type DashMove, type MeleeMove, type MoveId, type MoveKind, type ThrowMove } from '../../config/moves.config';
import { PUPPET } from '../../config/puppet.config';
import { EASY_AI, FINISHER, ROUND } from '../../config/round.config';
import { prefersReducedMotion, settingsStore, vibrate } from '../../state/settings';
import { ComicWords } from '../effects/comicWords';
import { EnergyBeam } from '../effects/beam';
import { Particles } from '../effects/particles';
import { EasyAI } from '../enemy/easyAI';
import { BattleInput } from '../engine/input';
import { RoundClock } from '../engine/roundClock';
import { attackFinished, hitIdOf, inMeleeRange, stepAttack, type ActiveAttack } from '../moves/attack';
import { Player } from '../player/Player';
import { buildPlayer, PLAYER_HEAD_RADIUS } from '../player/playerModel';

/** 玩家頭頂高度：軀幹底 1.75＋頸部 1.36＋球頭直徑 */
const PLAYER_TOP = 1.75 + 1.36 + PLAYER_HEAD_RADIUS * 2;
import { APOLOGY } from '../../config/dialogue.config';
import { DialogueBubble } from '../dialogue/bubble';
import { DialogueDirector, type DialogueEvent } from '../dialogue/director';
import { ForgiveFx, LeaveFx } from '../ending/endingFx';
import { Projectiles } from '../projectiles/projectiles';
import type { PaintStore } from '../puppet/paintSurface';
import { Puppet, type PuppetEvent } from '../puppet/Puppet';
import { headCenterY, PART_DEFS } from '../puppet/parts';
import { ScoreLedger, type ScoreLine } from '../scoring/ScoreLedger';
import { ARENA_BACKGROUND, buildArena } from '../three/arena';
import { computeFrame } from '../three/camera';
import { srgb } from '../three/color';
import { projectToScreen } from '../three/project';
import { SceneHost } from '../three/sceneHost';

/** 各近戰招式命中點的高度（離木偶腳底） */
const HIT_Y: Partial<Record<MoveId, number>> = { slap: 4.1, stomp: 1.4, hammer: 4.6, spin: 2.8, club: 3.8 };
/** 大招：特效與鏡頭晃動較大 */
const BIG_HITS = new Set<MoveId>(['uppercut', 'shoe', 'stomp', 'spin', 'flykick', 'bucket', 'chair', 'hammer']);

/** 收尾時間背景轉暖的目標色 */
const WARM_BACKGROUND = '#EFD9C2';
/** 放大絕招時的深藍夜色背景 */
const FINISHER_BACKGROUND = '#121A44';

export type BattlePhase = 'ask' | 'finisher' | 'countdown' | 'fight' | 'ended' | 'apology' | 'worthy' | 'ending';
/** 結局演出：1 原諒、2 到此為止、5 還沒準備好 */
export type EndingShow = 'forgive' | 'leave' | 'later';

export interface BattleScript {
  /** 被打中時說的 D */
  dLines: string[];
}

export interface RoundResult {
  score: number;
  maxCombo: number;
  hits: number;
  early: boolean;
}

const SHOW_PHASES: BattlePhase[] = ['apology', 'worthy', 'ending'];
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export interface HudState {
  phase: BattlePhase;
  timeLeft: number;
  score: number;
  combo: number;
  maxCombo: number;
  kind: MoveKind;
  cooldowns: Partial<Record<MoveId, number>>;
  countdown: string;
  paused: boolean;
  /** 致命一擊演出的字幕：title＝開場標題、ko＝擊倒 */
  cine: '' | 'title' | 'ko';
}

export interface BattleEvents {
  onHud(h: HudState): void;
  onBanner(text: string): void;
  /** 玩家要求暫停（Esc、暫停鍵、切到背景） */
  onRequestPause(): void;
  /** 回合結束（只會呼叫一次） */
  onEnd(result: RoundResult): void;
}

export interface BattleDom {
  stage: HTMLElement;
  fx: HTMLElement;
  flash: HTMLElement;
  alert: HTMLElement;
  bubble: HTMLElement;
}

/**
 * 決鬥：玩家、木偶、招式、投射物、簡單模式 AI、計分、計時、鏡頭與特效。
 */
export class BattleController {
  private host: SceneHost;
  readonly puppet: Puppet;
  readonly player: Player;
  readonly input: BattleInput;
  private particles: Particles;
  private words: ComicWords;
  private shoes: Projectiles;
  private ai = new EasyAI();
  ledger = new ScoreLedger();
  clock: RoundClock;
  kind: MoveKind = 'hand';
  phase: BattlePhase = 'countdown';
  paused = false;
  private round = 0;
  private seq = 0;
  private gameTime = 0;
  private phaseTime = 0;
  private endNotified = false;
  /** 已經問過致命一擊的回合長度（每次延長後在剩 15 秒時再問一次） */
  private askedLen = 0;
  /** 致命一擊演出：已觸發到第幾個節點、目前鏡頭、對手所在方向、連打計數 */
  private fin = { step: 0, shot: -1, side: 1 as 1 | -1, aura: 0, koAt: -1, koT: -1 };
  private beam: EnergyBeam | null = null;
  private camCut = false;
  private shake = 0;
  private flash = 0;
  private cam = { x: 0, dist: 18, lookY: CAMERA.lookY, camY: CAMERA.baseY, yaw: 0 };
  private camInit = false;
  private lastHud = '';
  private disposed = false;
  private bgCool = new Color(ARENA_BACKGROUND);
  private bgWarm = new Color(WARM_BACKGROUND);
  private bgDark = new Color(FINISHER_BACKGROUND);
  /** 環境光原色與絕招時的夜色 */
  private hemiBase = srgb('#FFFFFF');
  private hemiNight = srgb('#2A3C9C');
  private director: DialogueDirector;
  private bubble: DialogueBubble;
  private hits = 0;
  private early = false;
  private showT = 0;
  private warmDuration = 0;
  private endingShow: EndingShow | null = null;
  private forgiveFx: ForgiveFx | null = null;
  private leaveFx: LeaveFx | null = null;
  private walkFrom = { puppet: 0, player: 0 };
  /** 演出用鏡頭；minHalfW＝左右至少要看到的半寬，窄螢幕會自動拉遠 */
  private camOverride: { x: number; dist: number; lookY: number; camY: number; minHalfW?: number; yaw?: number; rate?: number } | null = null;

  constructor(
    private readonly dom: BattleDom,
    private readonly paint: PaintStore,
    private readonly roundLength: number,
    private readonly ev: BattleEvents,
    private readonly script: BattleScript = { dLines: [] },
  ) {
    this.director = new DialogueDirector(script.dLines);
    this.bubble = new DialogueBubble(dom.bubble);
    this.host = new SceneHost(dom.stage, ARENA_BACKGROUND, 11, CAMERA.fov);
    this.host.scene.fog = new Fog(ARENA_BACKGROUND, 30, 60);
    this.host.scene.add(buildArena());
    this.host.renderer.domElement.style.touchAction = 'none';
    this.puppet = new Puppet(paint);
    this.puppet.addTo(this.host.scene);
    const rig = buildPlayer();
    this.host.scene.add(rig.root);
    this.player = new Player(rig);
    this.particles = new Particles(this.host.scene);
    this.words = new ComicWords(dom.fx);
    this.shoes = new Projectiles(this.host.scene);
    this.input = new BattleInput(() => this.requestPause());
    this.clock = new RoundClock(roundLength);
    document.addEventListener('visibilitychange', this.onVis);
    this.restart();
    this.host.start({
      update: (dt) => this.update(dt),
      beforeRender: (dt, size) => this.render(dt, size),
    });
  }

  private onVis = () => {
    if (document.hidden) this.requestPause();
  };

  /** 詢問致命一擊與終結技演出時不開暫停選單（詢問本身已經停住計時） */
  private requestPause() {
    if (this.phase === 'fight' || this.phase === 'countdown') this.ev.onRequestPause();
  }

  /** 重新開始：重設分數、連擊、計時、角色、冷卻、投射物、粒子。 */
  restart() {
    this.round++;
    this.seq = 0;
    this.ledger = new ScoreLedger();
    this.clock = new RoundClock(this.roundLength);
    this.player.reset();
    this.puppet.setStance(true, -1);
    this.puppet.reset(GAME.puppetStartX);
    this.ai.reset();
    this.shoes.clear();
    this.particles.clear();
    this.words.clear();
    this.setWarmth(0);
    this.kind = 'hand';
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.paused = false;
    this.endNotified = false;
    this.askedLen = 0;
    this.player.powerUp = this.player.thrust = 0;
    this.beam?.dispose();
    this.beam = null;
    this.shake = this.flash = 0;
    this.camInit = false;
    this.input.setEnabled(false);
    this.dom.alert.hidden = true;
    this.hits = 0;
    this.early = false;
    this.clearShow();
    this.bubble.hide();
    this.director = new DialogueDirector(this.script.dLines);
    this.emitHud(true);
  }

  private handleDialogue(events: DialogueEvent[]) {
    for (const e of events) {
      if (e.type === 'show') this.bubble.show(e.text);
      else if (e.type === 'shake') this.bubble.shake();
      else this.bubble.hide();
    }
  }

  /** 收尾時間：燈光與背景逐漸轉暖 */
  private setWarmth(k: number) {
    this.host.lights.setWarmth(k);
    const bg = this.host.scene.background as Color;
    bg.copy(this.bgCool).lerp(this.bgWarm, k);
    (this.host.scene.fog as Fog).color.copy(bg);
  }

  setPaused(p: boolean) {
    if (p === this.paused || this.phase === 'ended' || SHOW_PHASES.includes(this.phase)) return;
    this.paused = p;
    if (p) {
      this.clock.pause();
      this.input.setEnabled(false);
      // 暫停時噴飛零件立刻歸位
      this.puppet.forceReassemble();
    } else {
      if (this.phase === 'fight') {
        this.clock.resume();
        this.input.setEnabled(true);
      }
    }
    this.emitHud(true);
  }

  setKind(k: MoveKind) {
    this.kind = k;
    this.emitHud(true);
  }

  /** 畫面按鈕：第 slot 個招式 */
  pressSlot(slot: number) {
    this.input.push({ type: 'move', slot });
  }

  // ---------- 更新 ----------
  private get live() {
    return this.phase === 'fight' && !this.paused;
  }

  private update(dt: number) {
    if (this.paused || this.disposed) return;
    this.gameTime += dt;
    this.phaseTime += dt;
    if (SHOW_PHASES.includes(this.phase)) {
      this.updateShow(dt);
      return;
    }
    // 詢問致命一擊：整個畫面停住等玩家選
    if (this.phase === 'ask') return;
    if (this.phase === 'finisher') {
      this.updateFinisher(dt);
      return;
    }
    this.handleDialogue(this.director.update(this.gameTime));
    if (this.phase === 'countdown') {
      if (this.phaseTime >= ROUND.countdown) {
        this.phase = 'fight';
        this.phaseTime = 0;
        this.clock.start();
        this.input.setEnabled(true);
        this.ev.onBanner('開打！');
      }
    } else if (this.phase === 'fight') {
      // 剩 15 秒：問要不要給致命一擊（回合本身短於 15 秒的開發測試不問）
      const len = this.clock.lengthSec;
      if (len > ROUND.finisherAskAt && this.askedLen !== len && this.clock.remaining() <= ROUND.finisherAskAt) this.askFinisher();
      else if (this.clock.checkExpired()) this.endRound();
    } else if (this.phase === 'ended' && !this.endNotified && this.phaseTime >= ROUND.endDelay) {
      this.endNotified = true;
      this.ev.onEnd(this.result());
    }

    for (const a of this.input.drain()) {
      if (!this.live) break;
      if (a.type === 'toggleKind') this.setKind(this.kind === 'hand' ? 'weapon' : 'hand');
      else if (a.type === 'dodge') this.player.tryDodge();
      else if (a.type === 'move') {
        const id = MOVE_SETS[this.kind][a.slot];
        if (id) this.onAttackStart(this.player.tryAttack(id, ++this.seq));
      }
    }

    const p = this.puppet;
    const pl = this.player;
    const move = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    pl.update(dt, move as -1 | 0 | 1, p.x, this.live);
    if (pl.attack) {
      const att = pl.attack;
      for (const e of stepAttack(att, dt)) {
        if (!this.live) continue;
        if (e.kind === 'check') this.meleeCheck(att, e.segment);
        else if (e.kind === 'dash') this.dashCheck(att);
        else if (e.kind === 'dashEnd') {
          if (!att.landed) this.words.add('揮空', pl.x + att.facing * 1.6, 3.6, '#C9D2F2', 0.55);
        } else this.shoes.throw(att.move as ThrowMove, pl.x, att.facing, hitIdOf(this.round, att.seq, 0), p.x);
      }
      if (attackFinished(att)) {
        pl.attack = null;
        const next = pl.takeBuffered();
        if (next && this.live) this.onAttackStart(pl.tryAttack(next, ++this.seq));
      }
    }

    const hits = this.shoes.update(dt, { x: p.x, halfWidth: PUPPET.halfWidth, bottom: p.lift, top: p.lift + H, active: this.live && !p.invulnerable });
    for (const h of hits) this.applyHit(h.id, h.hitId, 0, new Vector3(h.x, h.y, 0.6));

    // 木偶 AI（簡單模式）
    const side = (Math.sign(pl.x - p.x) || -1) as -1 | 1;
    // 面對面：木偶轉身朝向玩家，擺出前後腳站姿
    if (!p.airborne) p.setStance(true, side);
    // 暈眩（水桶套頭）、手風琴、壓扁中不出拳
    const canAct = !p.invulnerable && !p.airborne && !p.isDown && !p.isStunned && !p.isAccordion && !p.isFlat;
    for (const e of this.ai.update(dt, this.live && canAct, side)) {
      if (e.type === 'windup') {
        p.setAiPose('windup', e.side);
        this.dom.alert.hidden = false;
      } else if (e.type === 'strike') {
        p.setAiPose('punch', e.side);
        this.dom.alert.hidden = true;
        this.puppetStrike();
      } else {
        p.setAiPose('idle', side);
        this.dom.alert.hidden = true;
      }
    }

    for (const e of p.update(dt, { walls: [GAME.wallL, GAME.wallR], reducedMotion: prefersReducedMotion() })) this.onPuppetEvent(e);
    this.blockPuppet();
    this.ledger.tick(this.clock.elapsed());
    this.particles.update(dt);
    this.words.update(dt);
    this.shake = Math.max(0, this.shake - dt * CAMERA.shakeDecay);
    this.flash = Math.max(0, this.flash - dt * EFFECTS.flashDecay);
    this.emitHud(false);
  }

  /** 木偶被打飛、撞牆彈回時不會穿過玩家：碰到就停在玩家面前並稍微反彈。 */
  private blockPuppet() {
    const p = this.puppet;
    const pl = this.player;
    if (p.airborne || p.invulnerable || pl.attack?.move.id === 'stomp') return;
    const toPlayer = Math.sign(pl.x - p.x) || 1;
    const gap = Math.abs(pl.x - p.x) - (PLAYER.halfWidth + PUPPET.halfWidth);
    if (gap < 0 && p.vx * toPlayer > 0) {
      p.x = pl.x - toPlayer * (PLAYER.halfWidth + PUPPET.halfWidth);
      p.vx = -p.vx * 0.3;
    }
  }

  private meleeCheck(att: ActiveAttack, segment: number) {
    const m = att.move as MeleeMove;
    const p = this.puppet;
    const pl = this.player;
    const reach = inMeleeRange({
      playerX: pl.x, facing: att.facing, targetX: p.x, playerHalf: PLAYER.halfWidth, targetHalf: PUPPET.halfWidth,
      range: m.range, backRange: m.backRange, H,
    });
    // 落空：不在範圍、太高打不到，或噴飛／組回中
    if (!reach || p.lift > m.maxTargetLift * H || p.invulnerable) {
      if (segment === 0) this.words.add('揮空', pl.x + att.facing * 1.6, 3.6, '#C9D2F2', 0.55);
      return;
    }
    const at = new Vector3(p.x - att.facing * 0.4, p.lift + (HIT_Y[m.id] ?? 3.2), 0.6);
    this.applyHit(m.id, hitIdOf(this.round, att.seq, segment), segment, at);
  }

  /** 招式開始時的提示（鐵錘蓄力） */
  private onAttackStart(att: ActiveAttack | null) {
    if (att?.move.id === 'hammer') this.words.add('蓄力…', this.player.x, 5.7, '#FFC63A', 0.8);
  }

  /**
   * 飛踢突進：每一步都檢查是否撞到木偶。整段突進只有一個 hitId，
   * 撞到後即使下一步還在範圍內，帳本也只會結算一次。
   */
  private dashCheck(att: ActiveAttack) {
    const m = att.move as DashMove;
    const p = this.puppet;
    const pl = this.player;
    const reach = inMeleeRange({
      playerX: pl.x, facing: att.facing, targetX: p.x, playerHalf: PLAYER.halfWidth, targetHalf: PUPPET.halfWidth,
      range: m.range, backRange: 0, H,
    });
    if (!reach || p.lift > m.maxTargetLift * H || p.invulnerable) return;
    att.landed = true;
    this.applyHit(m.id, hitIdOf(this.round, att.seq, 0), 0, new Vector3(p.x - att.facing * 0.5, p.lift + 2.6, 0.6));
  }

  /** 命中結算：同一 hitId 只算一次（帳本把關），之後才做反應與特效。 */
  private applyHit(id: MoveId, hitId: string, segment: number, at: Vector3) {
    const p = this.puppet;
    const dir = (Math.sign(p.x - this.player.x) || this.player.facing) as 1 | -1;
    const wasAir = p.airborne;
    const m = MOVES[id];
    const extra = m.type === 'melee' && m.airBonus && wasAir ? { points: m.airBonus, label: '空中追擊' } : undefined;
    const res = this.ledger.resolve({ hitId, move: id, base: m.score[Math.min(segment, m.score.length - 1)], at: this.clock.elapsed(), extra });
    if (!res.scored) return;

    if (id === 'jab') p.punch(dir, segment);
    else if (id === 'spin') p.spinKick(dir);
    else if (id === 'uppercut') p.launch(dir);
    else if (id === 'flykick') p.flyKicked(dir);
    else if (id === 'slap') p.slap(dir);
    else if (id === 'stomp') p.flatten();
    else if (id === 'club') p.clubHit(dir, segment);
    else if (id === 'bucket') p.bucketHit(dir);
    else if (id === 'chair') p.chairHit(dir);
    else if (id === 'shoe') p.shoeHit(dir);
    else if (id === 'hammer') p.hammerHit();
    this.ai.interrupt();
    p.setAiPose('idle', dir);
    this.dom.alert.hidden = true;
    this.hits++;
    this.handleDialogue(this.director.onHit(this.gameTime));

    const big = BIG_HITS.has(id) || (id === 'club' && segment === 2);
    const s = 1;
    this.particles.burst(at, 'star', Math.round((big ? 6 : 3) * s));
    this.particles.burst(at, 'chip', Math.round((big ? 10 : 5) * s));
    this.words.add(m.words[segment % m.words.length], at.x, at.y + 0.6, '#E8392B', 1);
    this.kick((big ? 0.9 : 0.4) * s);
    this.showScore(res.lines, at);
    // 連擊達 10 的倍數：木偶在地面上時噴飛（鐵錘本來就會在手風琴後噴飛）
    if (res.comboMilestone && !p.airborne && id !== 'hammer') p.explode(0.8, prefersReducedMotion());
  }

  private showScore(lines: ScoreLine[], at: Vector3) {
    lines.forEach((l, i) => {
      const bonus = l.label !== '';
      this.words.add(`+${l.points}${bonus ? ' ' + l.label : ''}`, bonus ? at.x * 0.3 : at.x, at.y + 1.4 + i * 0.7, bonus ? '#FFC63A' : '#FFFFFF', bonus ? 0.85 : 0.62, 'score');
    });
  }

  private puppetStrike() {
    const p = this.puppet;
    const pl = this.player;
    const dx = Math.abs(pl.x - p.x);
    if (dx < EASY_AI.reach * H && pl.dodge <= 0) {
      pl.knockedBack(Math.sign(pl.x - p.x) || -1);
      this.words.add('唉唷！', pl.x, 4.6, '#FFFFFF', 0.8);
      this.kick(0.5);
    } else if (pl.dodge > 0 && dx < EASY_AI.reach * H * 1.2) {
      this.words.add('閃過！', pl.x, 4.8, '#2FB896', 0.8);
    }
  }

  private onPuppetEvent(e: PuppetEvent) {
    const p = this.puppet;
    if (e.type === 'landHard') {
      this.words.add('嘩啦！', p.x, 1.2, '#FFC63A', 1.1);
      this.kick(1);
    } else if (e.type === 'land') {
      this.words.add('咚！', p.x, 0.8, '#FFC63A', 0.8);
    } else if (e.type === 'wall') {
      this.words.add('碰！', p.x, 3, '#FFC63A', 0.8);
      this.particles.burst(new Vector3(p.x, 3, 0), 'star', 4);
    }
  }

  private kick(power: number) {
    const s = settingsStore.get();
    if (s.shake !== 'off' && !prefersReducedMotion()) this.shake = Math.max(this.shake, CAMERA.shake[s.shake] * power);
    if (s.flash !== 'off') this.flash = Math.max(this.flash, EFFECTS.flash[s.flash] * power);
    vibrate(EFFECTS.vibrateMs);
  }

  private result(): RoundResult {
    return { score: this.ledger.score, maxCombo: this.ledger.maxCombo, hits: this.hits, early: this.early };
  }

  /** 「打夠了，聽他說」：提前結束，直接進入道歉（不經過收尾時間）。 */
  endEarly() {
    if (this.phase === 'ended' || SHOW_PHASES.includes(this.phase)) return;
    this.early = true;
    this.paused = false;
    this.clock.stop();
    this.endRound(false);
    this.endNotified = true;
    this.ev.onEnd(this.result());
  }

  private endRound(banner = true) {
    this.handleDialogue(this.director.stop());
    this.phase = 'ended';
    this.phaseTime = 0;
    this.input.setEnabled(false);
    this.player.attack = null;
    this.shoes.clear();
    this.puppet.forceReassemble();
    this.puppet.clearStatus();
    this.puppet.setAiPose('idle', -1);
    this.dom.alert.hidden = true;
    if (banner) this.ev.onBanner('時間到！');
    this.emitHud(true);
  }

  // ---------- 致命一擊 ----------
  /** 剩 15 秒：停住計時與畫面，問玩家要不要給致命一擊。 */
  private askFinisher() {
    this.askedLen = this.clock.lengthSec;
    this.phase = 'ask';
    this.clock.pause();
    this.input.setEnabled(false);
    this.ai.interrupt();
    this.puppet.setAiPose('idle', -1);
    this.dom.alert.hidden = true;
    this.emitHud(true);
  }

  /** 「繼續打」：回合再延長 1 分鐘，剩 15 秒時再問一次。 */
  chooseContinue() {
    if (this.phase !== 'ask') return;
    this.clock.extend(ROUND.extendBy);
    this.phase = 'fight';
    this.clock.resume();
    this.input.setEnabled(true);
    this.ev.onBanner(`再打 ${ROUND.extendBy / 60} 分鐘！`);
    this.emitHud(true);
  }

  /** 「致命一擊」：集氣、推出正義光波把對手轟上天，摔回地面擊倒後直接進道歉。 */
  chooseFinisher() {
    if (this.phase !== 'ask') return;
    this.handleDialogue(this.director.stop());
    this.clock.stop();
    this.phase = 'finisher';
    this.showT = 0;
    this.input.setEnabled(false);
    this.shoes.clear();
    this.ai.reset();
    const p = this.puppet;
    const pl = this.player;
    p.forceReassemble();
    p.clearStatus();
    p.setAiPose('idle', -1);
    pl.attack = null;
    pl.stun = pl.dodge = 0;
    pl.powerUp = 1;
    pl.thrust = 0;
    const side = (Math.sign(p.x - pl.x) || 1) as 1 | -1;
    // 兩人移到場中央兩側：鏡頭不會被角柱擋住，也留出光波與轟飛的空間
    p.x = side * FINISHER.standX;
    pl.x = -side * FINISHER.standX;
    pl.facing = side;
    p.vx = 0;
    this.beam?.dispose();
    this.beam = new EnergyBeam(this.host.scene);
    this.fin = { step: 0, shot: -1, side, aura: 0, koAt: -1, koT: -1 };
    this.emitHud(true);
  }

  private updateFinisher(dt: number) {
    const F = FINISHER;
    const p = this.puppet;
    const pl = this.player;
    const fin = this.fin;
    const side = fin.side;
    const beam = this.beam!;
    // 光波打中的瞬間放慢動作
    const slow = this.showT >= F.slowFrom && this.showT < F.slowTo ? F.slowRate : 1;
    const sdt = dt * slow;
    this.showT += sdt;
    const t = this.showT;
    const reduced = prefersReducedMotion();
    // 雙手之間（光球、光柱的起點）
    const hands = pl.rig.gloveL.getWorldPosition(new Vector3()).add(pl.rig.gloveR.getWorldPosition(new Vector3())).multiplyScalar(0.5);

    if (t < F.fire) {
      // 集氣：光球越來越大，周圍冒星星
      beam.charge(hands, F.ballMax * Math.min(1, t / (F.fire * 0.85)), sdt);
      fin.aura -= sdt;
      if (fin.aura <= 0) {
        fin.aura = 0.1;
        const a = Math.random() * Math.PI * 2;
        this.particles.burst(new Vector3(pl.x + Math.cos(a) * 1.4, 0.4 + Math.random() * 4.5, Math.sin(a) * 1.4), 'star', 2);
      }
      if (t > 0.5 && fin.step === 0) {
        fin.step = 1;
        this.words.add('正義……', pl.x, 6, '#FFC63A', 0.9);
      }
    } else {
      pl.powerUp = 0;
      pl.thrust = Math.min(1, (t - F.fire) / 0.12);
      if (fin.step < 2) {
        fin.step = 2;
        this.words.add('光波————！', pl.x + side * 2, 6.2, '#FFC63A', 1.3);
        this.kick(0.8);
        this.flash = Math.max(this.flash, reduced ? 0.15 : 0.5);
      }
      // 光柱：射出後延伸到對手；打中後末端跟著被轟飛的對手
      const center = new Vector3(p.x, p.lift + PUPPET.height * 0.55, 0);
      const reach = Math.min(1, (t - F.fire) / (F.hit - F.fire));
      const to = hands.clone().lerp(center, reach);
      const fade = t < F.beamEnd ? 1 : Math.max(0, 1 - (t - F.beamEnd) / 0.35);
      beam.fire(hands, to, F.beamRadius, fade, sdt);
      if (fade > 0 && Math.random() < 0.5) this.particles.burst(new Vector3(pl.x + side * (1 + Math.random() * 2), 0.3, (Math.random() - 0.5) * 2), 'chip', 1);
    }
    if (fin.step === 2 && t >= F.hit) {
      fin.step = 3;
      p.blast(side * F.blastVx, F.blastVy, side);
      this.particles.burst(new Vector3(p.x, 3, 0.6), 'star', 14);
      this.particles.burst(new Vector3(p.x, 2, 0.6), 'chip', 16);
      this.words.add('轟————！', p.x, 4.5, '#E8392B', 1.4);
      this.kick(1.3);
      this.flash = Math.max(this.flash, reduced ? 0.25 : 0.9);
    }
    if (fin.step === 3 && p.vy <= 0 && p.airborne) {
      // 飛到最高點：閃一下變成天邊的星星
      fin.step = 4;
      this.particles.burst(new Vector3(p.x, p.lift + 2.4, 0.6), 'star', 12);
      this.words.add('☆ 閃～', p.x + side * 1.2, p.lift + 3.4, '#FFFFFF', 1);
    }
    if (fin.step === 5 && fin.koAt < 0) fin.koAt = t + 0.35;
    if (fin.step >= 4 && fin.step < 6 && ((fin.koAt >= 0 && t >= fin.koAt) || t >= F.koLatest)) {
      fin.step = 6;
      fin.koT = t;
      this.ledger.bonus(F.score);
      this.words.add(`+${F.score} 致命一擊`, p.x * 0.3, 6, '#FFC63A', 1.1, 'score');
      for (let i = 0; i < 4; i++) this.particles.burst(new Vector3(p.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, 0.6), 'star', 8);
      this.kick(1);
    }

    // 放大絕招時整個場景變暗（深藍夜色），只留主光打在兩人身上，光波更亮眼；K.O. 後慢慢亮回來
    const dark = fin.koT < 0 ? smooth(t / F.darkIn) : 1 - smooth((t - fin.koT) / F.darkOut);
    this.setWarmth(0);
    const bg = this.host.scene.background as Color;
    bg.lerp(this.bgDark, dark * F.darkAmount);
    (this.host.scene.fog as Fog).color.copy(bg);
    const L = this.host.lights;
    L.hemi.color.copy(this.hemiBase).lerp(this.hemiNight, dark);
    L.hemi.intensity *= 1 - 0.55 * dark;
    L.fill.intensity *= 1 - 0.85 * dark;
    L.key.intensity *= 1 - 0.4 * dark;

    // 運鏡：每個鏡頭切一次（cut），鏡頭內平滑推移
    const shot = t < F.fire ? 0 : t < F.hit + 0.25 ? 1 : fin.step < 5 ? 2 : t < (fin.koAt < 0 ? F.koLatest : fin.koAt) + 0.8 ? 3 : 4;
    if (shot !== fin.shot) {
      fin.shot = shot;
      this.camCut = true;
    }
    if (shot === 0) {
      // 低角度特寫集氣，慢慢推近
      const u = Math.min(1, t / F.fire);
      this.camOverride = { x: pl.x + side * 0.5, dist: 8.5 - 2 * u, lookY: 2.7, camY: 1.6, yaw: 0.55 * side, rate: 6 };
    } else if (shot === 1) {
      // 越肩鏡頭：從玩家身後看光波射向對手
      this.camOverride = { x: pl.x + side * 1.2, dist: 7.5, lookY: 2.6, camY: 6.4, yaw: -0.6 * side, rate: 8 };
    } else if (shot === 2) {
      // 仰角跟著被轟上天的對手
      this.camOverride = { x: (pl.x + p.x) / 2, dist: 19, lookY: Math.max(3.4, p.lift * 0.9 + 2), camY: 0.8, yaw: 0.35 * side, rate: 4, minHalfW: 4.5 };
    } else if (shot === 3) {
      // 摔回地面：正面廣角
      this.camOverride = { x: p.x, dist: 15, lookY: 2.2, camY: 4, yaw: 0, rate: 4, minHalfW: 5 };
    } else {
      // 收尾：慢慢環繞、拉遠
      const from = (fin.koAt < 0 ? F.koLatest : fin.koAt) + 0.8;
      const u = Math.min(1, (t - from) / Math.max(0.1, F.total - from));
      this.camOverride = { x: p.x * 0.6 + pl.x * 0.4, dist: 15 + 6 * u, lookY: 2.4, camY: 4.4 + 1.6 * u, yaw: (0.55 - 1.0 * u) * side, rate: 2.5, minHalfW: 5 };
    }

    for (const e of p.update(sdt, { walls: [GAME.wallL, GAME.wallR], reducedMotion: reduced })) {
      this.onPuppetEvent(e);
      if (e.type === 'landHard' || e.type === 'land') fin.step = Math.max(fin.step, 5);
      // 組回來後被擊倒：坐在地上頭暈
      if (e.type === 'reassembled') {
        p.setPoseMode('sit');
        p.daze(F.total);
      }
    }
    pl.update(sdt, 0, p.x, false);
    this.particles.update(sdt);
    this.words.update(dt);
    this.shake = Math.max(0, this.shake - dt * CAMERA.shakeDecay);
    this.flash = Math.max(0, this.flash - dt * EFFECTS.flashDecay);
    this.emitHud(false);
    if (t >= F.total) {
      this.camOverride = null;
      this.camCut = true;
      this.beam?.dispose();
      this.beam = null;
      pl.thrust = 0;
      this.endRound(false);
      this.endNotified = true;
      this.ev.onEnd(this.result());
    }
  }

  // ---------- 道歉與結局演出 ----------
  private clearShow() {
    this.forgiveFx?.dispose();
    this.forgiveFx = null;
    this.leaveFx?.dispose();
    this.leaveFx = null;
    this.endingShow = null;
    this.camOverride = null;
    this.player.script = null;
    this.player.powerUp = this.player.thrust = 0;
    this.beam?.dispose();
    this.beam = null;
    this.player.rig.root.position.z = 0;
    this.host.lights.hemi.visible = this.host.lights.key.visible = this.host.lights.fill.visible = true;
    this.host.lights.hemi.color.copy(this.hemiBase);
  }

  /** 道歉轉場：停止攻擊與 AI、清掉殘留物，積木人走回中央單膝跪地，燈光轉暖、鏡頭推近。 */
  startApology() {
    this.handleDialogue(this.director.stop());
    this.phase = 'apology';
    this.showT = 0;
    this.input.setEnabled(false);
    this.player.attack = null;
    this.shoes.clear();
    this.particles.clear();
    this.words.clear();
    this.dom.alert.hidden = true;
    this.ai.reset();
    const p = this.puppet;
    p.forceReassemble();
    p.clearStatus();
    p.setPoseMode('stand');
    p.setAiPose('idle', -1);
    p.setStance(false);
    this.walkFrom = { puppet: p.x, player: this.player.x };
    this.warmDuration = APOLOGY.warmTime + (this.early ? APOLOGY.earlyExtraWarm : 0);
    this.emitHud(true);
  }

  /** 「值得聽到」：木偶淡出，舞台只剩暖光。 */
  showWorthy() {
    this.phase = 'worthy';
    this.showT = 0;
  }

  /** 結局演出（約 8 秒）。 */
  playEnding(kind: EndingShow) {
    this.clearShow();
    this.phase = 'ending';
    this.endingShow = kind;
    this.showT = 0;
    const p = this.puppet;
    p.setFade(1);
    p.setPoseMode('stand');
    this.walkFrom = { puppet: p.x, player: this.player.x };
    this.player.script = { yaw: this.player.facing * 0.85, walking: false, sit: false };
    if (kind === 'forgive') this.forgiveFx = new ForgiveFx(this.host.scene);
    if (kind === 'leave') this.leaveFx = new LeaveFx(this.host.scene);
  }

  get showProgress() {
    return this.phase === 'ending' ? Math.min(1, this.showT / APOLOGY.endingTime) : 0;
  }

  private updateShow(dt: number) {
    this.showT += dt;
    const p = this.puppet;
    const pl = this.player;
    const t = this.showT;
    const bg = this.host.scene.background as Color;
    if (this.phase === 'apology' || this.phase === 'worthy') {
      const w = smooth(t / APOLOGY.walkTime);
      if (this.phase === 'apology') {
        p.x = this.walkFrom.puppet + (0 - this.walkFrom.puppet) * w;
        pl.x = this.walkFrom.player + (-4 - this.walkFrom.player) * w;
        if (t >= APOLOGY.walkTime) p.setPoseMode('kneel');
        this.setWarmth(Math.min(1, t / this.warmDuration));
        this.host.lights.hemi.intensity *= 1 - 0.2 * Math.min(1, t / this.warmDuration);
      } else {
        p.setFade(Math.max(0, 1 - t / 1.2));
        this.setWarmth(1);
        this.host.lights.hemi.intensity *= 0.6;
      }
      this.camOverride = { x: p.x * 0.4 - 0.6, dist: 13, lookY: 2.3, camY: 3.4, minHalfW: 3.6 };
    } else if (this.phase === 'ending') {
      const u = Math.min(1, t / APOLOGY.endingTime);
      const show = this.endingShow;
      if (show === 'forgive') {
        p.setFade(1);
        p.setStance(true, -1);
        p.x = this.walkFrom.puppet + (1.8 - this.walkFrom.puppet) * smooth(u / 0.2);
        pl.x = this.walkFrom.player + (-1.8 - this.walkFrom.player) * smooth(u / 0.2);
        pl.script = { yaw: 0.85, walking: u < 0.2, sit: false };
        this.setWarmth(0.6);
        bg.lerp(new Color('#F7E8BE'), Math.min(1, u * 2));
        this.forgiveFx?.update(u, pl.x, { x: p.x, y: p.lift + headCenterY() + 0.8 });
        this.camOverride = { x: 0, dist: 15, lookY: 3.2, camY: 4.0, minHalfW: 4.2 };
      } else if (show === 'leave') {
        p.setFade(1);
        p.setStance(true, -1);
        // 玩家轉身離開，燈逐盞熄滅，最後一盞燈照著玩家走向出口外的晨光
        const walkU = smooth((u - 0.1) / 0.85);
        pl.x = this.walkFrom.player + (-9.6 - this.walkFrom.player) * walkU;
        pl.script = { yaw: -Math.PI / 2, walking: u > 0.1 && u < 0.97, sit: false };
        const L = this.host.lights;
        this.setWarmth(0.3);
        L.fill.intensity *= u > 0.2 ? 0 : 1;
        L.hemi.intensity *= u > 0.55 ? 0.08 : u > 0.35 ? 0.35 : 1;
        L.key.intensity *= u > 0.55 ? 0 : 1;
        bg.lerp(new Color('#2E2A36'), smooth((u - 0.3) / 0.3));
        this.leaveFx?.update(u, pl.x);
        this.camOverride = { x: Math.max(-5.5, pl.x * 0.6), dist: 17, lookY: 3, camY: 4, minHalfW: 5 };
      } else if (show === 'later') {
        // 傍晚：木偶在角落安靜坐著，玩家坐在舞台邊緣
        p.setFade(1);
        p.setStance(false);
        p.x = this.walkFrom.puppet + (5.0 - this.walkFrom.puppet) * smooth(u / 0.35);
        if (u > 0.35) p.setPoseMode('sit');
        pl.x = this.walkFrom.player + (-1.6 - this.walkFrom.player) * smooth(u / 0.35);
        pl.rig.root.position.z = 3.3 * smooth((u - 0.3) / 0.15);
        pl.script = { yaw: u < 0.45 ? 0.85 : 0, walking: u < 0.35, sit: u > 0.45 };
        this.setWarmth(1);
        this.host.lights.hemi.intensity *= 0.75;
        bg.lerp(new Color('#E8A27E'), smooth(u / 0.6));
        this.camOverride = { x: 1.4, dist: 22, lookY: 2.4, camY: 4.4, minHalfW: 5.4 };
      }
    }
    p.update(dt, { walls: [GAME.wallL - 6, GAME.wallR], reducedMotion: prefersReducedMotion() });
    pl.update(dt, 0, p.x, false);
    (this.host.scene.fog as Fog).color.copy(bg);
  }

  // ---------- 渲染 ----------
  private render(frameDt: number, size: { width: number; height: number }) {
    this.paint.flush();
    const p = this.puppet;
    const pl = this.player;
    const z = pl.rig.root.position.z;
    pl.pose(frameDt, { x: p.x, faceY: p.lift + headCenterY() * p.squashScaleY, faceFront: PART_DEFS.head.size[2] / 2 });
    pl.rig.root.position.z = z;
    const o = this.camOverride;
    const tv = Math.tan(((this.host.camera.fov / 2) * Math.PI) / 180);
    const f = o ? { ...o, dist: Math.max(o.dist, (o.minHalfW ?? 0) / (tv * this.host.camera.aspect)) } : computeFrame({
      aspect: this.host.camera.aspect,
      fov: this.host.camera.fov,
      actors: [
        { x: pl.rig.root.position.x, halfWidth: 1.0, top: PLAYER_TOP + 0.3 + Math.max(0, pl.rig.root.position.y) },
        { x: p.x, halfWidth: PUPPET.halfWidth + (p.airborne ? 0.6 : 0), top: p.lift + PUPPET.height },
      ],
    });
    const k = this.camInit && !this.camCut ? Math.min(1, frameDt * (o ? (o.rate ?? 1.4) : CAMERA.followRate)) : 1;
    const cut = this.camCut;
    this.camInit = true;
    this.camCut = false;
    this.cam.x += (f.x - this.cam.x) * k;
    const kd = cut ? 1 : f.dist > this.cam.dist ? Math.min(1, frameDt * 10) : k;
    this.cam.yaw += ((o?.yaw ?? 0) - this.cam.yaw) * k;
    this.cam.dist += (f.dist - this.cam.dist) * kd;
    this.cam.lookY += (f.lookY - this.cam.lookY) * kd;
    this.cam.camY += (f.camY - this.cam.camY) * kd;
    const sh = this.shake;
    const cam = this.host.camera;
    // yaw：繞著注視點水平轉動（電影感運鏡）；平常為 0＝正面
    const yaw = this.cam.yaw;
    cam.position.set(this.cam.x + Math.sin(yaw) * this.cam.dist + (Math.random() - 0.5) * sh, this.cam.camY + (Math.random() - 0.5) * sh, Math.cos(yaw) * this.cam.dist);
    cam.lookAt(this.cam.x, this.cam.lookY, 0);
    this.words.layout(cam, size.width, size.height);
    if (this.bubble.visible) {
      // 對話泡泡放在頭部側邊（遠離玩家那一側），不蓋住積木人、不被 HUD 擋住
      const hy = p.lift + headCenterY() * p.squashScaleY;
      const half = 1.55;
      const l = projectToScreen(p.x - half, hy, 0, cam, size.width, size.height);
      const r = projectToScreen(p.x + half, hy, 0, cam, size.width, size.height);
      this.bubble.layout({ headLeft: l.x, headRight: r.x, headY: r.y, prefer: p.x >= pl.x ? 'right' : 'left', topReserve: 58, width: size.width, height: size.height });
    }
    this.dom.flash.style.opacity = String(this.flash);
    if (!this.dom.alert.hidden) {
      const s = projectToScreen(p.x, p.lift + PUPPET.height + 0.7, 0, cam, size.width, size.height);
      this.dom.alert.style.left = `${s.x}px`;
      this.dom.alert.style.top = `${s.y}px`;
    }
  }

  private emitHud(force: boolean) {
    const cds: Partial<Record<MoveId, number>> = {};
    for (const id of MOVE_SETS[this.kind]) cds[id] = Math.ceil(this.player.cooldownOf(id) * 10) / 10;
    const cd = this.phase === 'countdown' ? String(Math.max(1, Math.ceil(ROUND.countdown - this.phaseTime - 0.4))) : '';
    const h: HudState = {
      phase: this.phase,
      timeLeft: Math.ceil(this.clock.remaining()),
      score: this.ledger.score,
      combo: this.ledger.combo,
      maxCombo: this.ledger.maxCombo,
      kind: this.kind,
      cooldowns: cds,
      countdown: cd,
      paused: this.paused,
      cine: this.phase !== 'finisher' ? '' : this.showT < FINISHER.fire ? 'title' : this.fin.step >= 6 ? 'ko' : '',
    };
    const key = JSON.stringify(h);
    if (force || key !== this.lastHud) {
      this.lastHud = key;
      this.ev.onHud(h);
    }
  }

  /** 測試用狀態 */
  debugState() {
    return {
      phase: this.phase,
      paused: this.paused,
      score: this.ledger.score,
      combo: this.ledger.combo,
      maxCombo: this.ledger.maxCombo,
      timeLeft: this.clock.remaining(),
      elapsed: this.clock.elapsed(),
      playerX: this.player.x,
      puppetX: this.puppet.x,
      puppetLift: this.puppet.lift,
      scattered: this.puppet.isScattered,
      projectiles: this.shoes.count,
      particles: this.particles.count,
      decals: this.puppet.decals.count,
      aiPhase: this.ai.phase,
      attacking: !!this.player.attack,
      bubble: this.bubble.visible ? (this.dom.bubble.textContent ?? '') : '',
      hits: this.hits,
      showT: this.showT,
      flat: this.puppet.isFlat,
      clockLength: this.clock.lengthSec,
      stunned: this.puppet.isStunned,
      bucket: this.puppet.hasBucket,
      accordion: this.puppet.isAccordion,
    };
  }

  /** 測試用：把玩家放到指定位置 */
  debugSetPlayerX(x: number) {
    this.player.x = x;
  }

  dispose() {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVis);
    this.input.dispose();
    this.clearShow();
    this.bubble.dispose();
    this.shoes.clear();
    this.particles.clear();
    this.words.clear();
    this.puppet.dispose();
    this.host.dispose(this.paint.textures());
    this.dom.fx.replaceChildren();
  }
}
