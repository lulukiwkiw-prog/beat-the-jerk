import { Color, Fog, Vector3 } from 'three';
import { CAMERA, GAME } from '../../config/game.config';
import { EFFECTS } from '../../config/effects.config';
import { H, MOVE_SETS, MOVES, PLAYER, type MeleeMove, type MoveId, type MoveKind, type ThrowMove } from '../../config/moves.config';
import { PUPPET } from '../../config/puppet.config';
import { EASY_AI, ROUND } from '../../config/round.config';
import { prefersReducedMotion, settingsStore, vibrate } from '../../state/settings';
import { ComicWords } from '../effects/comicWords';
import { Particles } from '../effects/particles';
import { EasyAI } from '../enemy/easyAI';
import { BattleInput } from '../engine/input';
import { RoundClock } from '../engine/roundClock';
import { attackFinished, hitIdOf, inMeleeRange, stepAttack, type ActiveAttack } from '../moves/attack';
import { Player } from '../player/Player';
import { buildPlayer, PLAYER_HEAD_RADIUS } from '../player/playerModel';

/** 玩家頭頂高度：軀幹底 1.75＋頸部 1.36＋球頭直徑 */
const PLAYER_TOP = 1.75 + 1.36 + PLAYER_HEAD_RADIUS * 2;
import { APOLOGY, DIALOGUE } from '../../config/dialogue.config';
import { DialogueBubble } from '../dialogue/bubble';
import { DialogueDirector, type DialogueEvent } from '../dialogue/director';
import { ForgiveFx, LeaveFx } from '../ending/endingFx';
import { ShoeProjectiles } from '../projectiles/shoes';
import type { PaintStore } from '../puppet/paintSurface';
import { Puppet, type PuppetEvent } from '../puppet/Puppet';
import { headCenterY, PART_DEFS } from '../puppet/parts';
import { ScoreLedger, type ScoreLine } from '../scoring/ScoreLedger';
import { ARENA_BACKGROUND, buildArena } from '../three/arena';
import { computeFrame } from '../three/camera';
import { projectToScreen } from '../three/project';
import { SceneHost } from '../three/sceneHost';

/** 收尾時間背景轉暖的目標色 */
const WARM_BACKGROUND = '#EFD9C2';

export type BattlePhase = 'taunt' | 'countdown' | 'fight' | 'ended' | 'apology' | 'worthy' | 'ending';
/** 結局演出：1 原諒、2 到此為止、5 還沒準備好 */
export type EndingShow = 'forgive' | 'leave' | 'later';

export interface BattleScript {
  /** 開場挑釁與「賤話：開」用的 B（已啟用） */
  taunts: string[];
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
  chatter: boolean;
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
  private shoes: ShoeProjectiles;
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
  private windDownShown = false;
  private shake = 0;
  private flash = 0;
  private cam = { x: 0, dist: 18, lookY: CAMERA.lookY, camY: CAMERA.baseY };
  private camInit = false;
  private lastHud = '';
  private disposed = false;
  private bgCool = new Color(ARENA_BACKGROUND);
  private bgWarm = new Color(WARM_BACKGROUND);
  private director: DialogueDirector;
  private bubble: DialogueBubble;
  chatter = false;
  private hits = 0;
  private early = false;
  private showT = 0;
  private warmDuration = 0;
  private endingShow: EndingShow | null = null;
  private forgiveFx: ForgiveFx | null = null;
  private leaveFx: LeaveFx | null = null;
  private walkFrom = { puppet: 0, player: 0 };
  private camOverride: { x: number; dist: number; lookY: number; camY: number } | null = null;

  constructor(
    private readonly dom: BattleDom,
    private readonly paint: PaintStore,
    private readonly roundLength: number,
    private readonly ev: BattleEvents,
    private readonly script: BattleScript = { taunts: [], dLines: [] },
  ) {
    this.director = new DialogueDirector(script.taunts, script.dLines);
    this.bubble = new DialogueBubble(dom.bubble, dom.fx);
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
    this.shoes = new ShoeProjectiles(this.host.scene);
    this.input = new BattleInput(() => this.ev.onRequestPause());
    this.clock = new RoundClock(roundLength);
    document.addEventListener('visibilitychange', this.onVis);
    this.restart();
    this.host.start({
      update: (dt) => this.update(dt),
      beforeRender: (dt, size) => this.render(dt, size),
    });
  }

  private onVis = () => {
    if (document.hidden) this.ev.onRequestPause();
  };

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
    this.windDownShown = false;
    this.shake = this.flash = 0;
    this.camInit = false;
    this.input.setEnabled(false);
    this.dom.alert.hidden = true;
    this.hits = 0;
    this.early = false;
    this.clearShow();
    this.bubble.hide();
    // 開場挑釁：倒數前依序說出啟用的 B
    this.phase = 'taunt';
    this.director = new DialogueDirector(this.script.taunts, this.script.dLines);
    this.handleDialogue(this.director.startTaunt(this.gameTime));
    this.emitHud(true);
  }

  /** 「賤話：開／關」 */
  setChatter(on: boolean) {
    this.chatter = on;
    this.emitHud(true);
  }

  /** 略過開場挑釁 */
  skipTaunt() {
    this.handleDialogue(this.director.skipTaunt());
  }

  private handleDialogue(events: DialogueEvent[]) {
    for (const e of events) {
      if (e.type === 'show') this.bubble.show(e.text, e.kind);
      else if (e.type === 'shake') this.bubble.shake();
      else if (e.type === 'hide') this.bubble.hide();
      else if (e.type === 'shatter') {
        this.bubble.shatter(prefersReducedMotion());
        if (e.bonus) {
          this.ledger.bonus(DIALOGUE.shatterBonus);
          const hy = this.puppet.lift + headCenterY() + 1.2;
          this.words.add(`+${DIALOGUE.shatterBonus} 打碎！`, this.puppet.x, hy, '#FFC63A', 0.85, 'score');
        }
      } else if (e.type === 'tauntDone' && this.phase === 'taunt') {
        this.phase = 'countdown';
        this.phaseTime = 0;
      }
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

  private fxScale(): number {
    const rem = this.clock.remaining();
    if (this.phase !== 'fight' || rem > ROUND.windDown) return 1;
    const k = 1 - rem / ROUND.windDown;
    return 1 - (1 - ROUND.windDownMinFx) * k;
  }

  private update(dt: number) {
    if (this.paused || this.disposed) return;
    this.gameTime += dt;
    this.phaseTime += dt;
    if (SHOW_PHASES.includes(this.phase)) {
      this.updateShow(dt);
      return;
    }
    this.handleDialogue(this.director.update(this.gameTime, this.chatter, this.live, dt));
    if (this.phase === 'countdown') {
      if (this.phaseTime >= ROUND.countdown) {
        this.phase = 'fight';
        this.phaseTime = 0;
        this.clock.start();
        this.input.setEnabled(true);
        this.ev.onBanner('開打！');
      }
    } else if (this.phase === 'fight') {
      const rem = this.clock.remaining();
      if (rem <= ROUND.windDown && !this.windDownShown && this.roundLength > ROUND.windDown) {
        this.windDownShown = true;
        this.ev.onBanner('最後 30 秒，慢慢收拳');
      }
      if (rem <= ROUND.windDown) this.setWarmth(1 - rem / ROUND.windDown);
      if (this.clock.checkExpired()) this.endRound();
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
        if (id) this.player.tryAttack(id, ++this.seq);
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
        else this.shoes.throw(att.move as ThrowMove, pl.x, att.facing, hitIdOf(this.round, att.seq, 0));
      }
      if (attackFinished(att)) {
        pl.attack = null;
        const next = pl.takeBuffered();
        if (next && this.live) pl.tryAttack(next, ++this.seq);
      }
    }

    const hits = this.shoes.update(dt, { x: p.x, halfWidth: PUPPET.halfWidth, bottom: p.lift, top: p.lift + H, active: this.live && !p.invulnerable });
    for (const h of hits) this.applyHit('shoe', h.hitId, 0, new Vector3(h.x, h.y, 0.6));

    // 木偶 AI（簡單模式）
    const side = (Math.sign(pl.x - p.x) || -1) as -1 | 1;
    // 面對面：木偶轉身朝向玩家，擺出前後腳站姿
    if (!p.airborne) p.setStance(true, side);
    for (const e of this.ai.update(dt, this.live && !p.invulnerable && !p.airborne && !p.isDown, side)) {
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
    this.ledger.tick(this.clock.elapsed());
    this.particles.update(dt);
    this.words.update(dt);
    this.shake = Math.max(0, this.shake - dt * CAMERA.shakeDecay);
    this.flash = Math.max(0, this.flash - dt * EFFECTS.flashDecay);
    this.emitHud(false);
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
    const at = new Vector3(p.x - att.facing * 0.4, p.lift + (m.id === 'slap' ? 4.1 : 3.2), 0.6);
    this.applyHit(m.id, hitIdOf(this.round, att.seq, segment), segment, at);
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
    else if (id === 'uppercut') p.launch(dir);
    else if (id === 'slap') p.slap(dir);
    else if (id === 'shoe') p.shoeHit(dir);
    this.ai.interrupt();
    p.setAiPose('idle', dir);
    this.dom.alert.hidden = true;
    this.hits++;
    this.handleDialogue(this.director.onHit(this.gameTime));

    const big = id === 'uppercut' || id === 'shoe';
    const s = this.fxScale();
    this.particles.burst(at, 'star', Math.round((big ? 6 : 3) * s));
    this.particles.burst(at, 'chip', Math.round((big ? 10 : 5) * s));
    this.words.add(m.words[segment % m.words.length], at.x, at.y + 0.6, '#E8392B', 1);
    this.kick((big ? 0.9 : 0.4) * s);
    this.showScore(res.lines, at);
    // 連擊達 10 的倍數：木偶在地面上時噴飛
    if (res.comboMilestone && !p.airborne) p.explode(0.8, prefersReducedMotion());
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
      this.kick(this.fxScale());
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
    this.puppet.setAiPose('idle', -1);
    this.dom.alert.hidden = true;
    if (banner) this.ev.onBanner('時間到！');
    this.emitHud(true);
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
    this.player.rig.root.position.z = 0;
    this.host.lights.hemi.visible = this.host.lights.key.visible = this.host.lights.fill.visible = true;
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
      this.camOverride = { x: p.x * 0.4 - 0.6, dist: 13, lookY: 2.3, camY: 3.4 };
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
        this.camOverride = { x: 0, dist: 15, lookY: 3.2, camY: 4.0 };
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
        this.camOverride = { x: Math.max(-5.5, pl.x * 0.6), dist: 17, lookY: 3, camY: 4 };
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
        this.camOverride = { x: 1.4, dist: 22, lookY: 2.4, camY: 4.4 };
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
    const f = this.camOverride ?? computeFrame({
      aspect: this.host.camera.aspect,
      fov: this.host.camera.fov,
      actors: [
        { x: pl.x, halfWidth: 1.0, top: PLAYER_TOP + 0.3 },
        { x: p.x, halfWidth: PUPPET.halfWidth + (p.airborne ? 0.6 : 0), top: p.lift + PUPPET.height },
      ],
    });
    const k = this.camInit ? Math.min(1, frameDt * (this.camOverride ? 1.4 : CAMERA.followRate)) : 1;
    this.camInit = true;
    this.cam.x += (f.x - this.cam.x) * k;
    const kd = f.dist > this.cam.dist ? Math.min(1, frameDt * 10) : k;
    this.cam.dist += (f.dist - this.cam.dist) * kd;
    this.cam.lookY += (f.lookY - this.cam.lookY) * kd;
    this.cam.camY += (f.camY - this.cam.camY) * kd;
    const sh = this.shake;
    const cam = this.host.camera;
    cam.position.set(this.cam.x + (Math.random() - 0.5) * sh, this.cam.camY + (Math.random() - 0.5) * sh, this.cam.dist);
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
      chatter: this.chatter,
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
