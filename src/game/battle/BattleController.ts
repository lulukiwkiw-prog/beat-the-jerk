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
import { buildPlayer } from '../player/playerModel';
import { ShoeProjectiles } from '../projectiles/shoes';
import type { PaintStore } from '../puppet/paintSurface';
import { Puppet, type PuppetEvent } from '../puppet/Puppet';
import { ScoreLedger, type ScoreLine } from '../scoring/ScoreLedger';
import { ARENA_BACKGROUND, buildArena } from '../three/arena';
import { computeFrame } from '../three/camera';
import { projectToScreen } from '../three/project';
import { SceneHost } from '../three/sceneHost';

/** 收尾時間背景轉暖的目標色 */
const WARM_BACKGROUND = '#EFD9C2';

export type BattlePhase = 'countdown' | 'fight' | 'ended';

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
}

export interface BattleEvents {
  onHud(h: HudState): void;
  onBanner(text: string): void;
  /** 玩家要求暫停（Esc、暫停鍵、切到背景） */
  onRequestPause(): void;
  /** 回合結束（只會呼叫一次） */
  onEnd(result: { score: number; maxCombo: number }): void;
}

export interface BattleDom {
  stage: HTMLElement;
  fx: HTMLElement;
  flash: HTMLElement;
  alert: HTMLElement;
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

  constructor(
    private readonly dom: BattleDom,
    private readonly paint: PaintStore,
    private readonly roundLength: number,
    private readonly ev: BattleEvents,
  ) {
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
    this.emitHud(true);
  }

  /** 收尾時間：燈光與背景逐漸轉暖 */
  private setWarmth(k: number) {
    this.host.lights.setWarmth(k);
    const bg = this.host.scene.background as Color;
    bg.copy(this.bgCool).lerp(this.bgWarm, k);
    (this.host.scene.fog as Fog).color.copy(bg);
  }

  setPaused(p: boolean) {
    if (p === this.paused || this.phase === 'ended') return;
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
      this.ev.onEnd({ score: this.ledger.score, maxCombo: this.ledger.maxCombo });
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

  private endRound() {
    this.phase = 'ended';
    this.phaseTime = 0;
    this.input.setEnabled(false);
    this.player.attack = null;
    this.shoes.clear();
    this.puppet.forceReassemble();
    this.puppet.setAiPose('idle', -1);
    this.dom.alert.hidden = true;
    this.ev.onBanner('時間到！');
    this.emitHud(true);
  }

  // ---------- 渲染 ----------
  private render(frameDt: number, size: { width: number; height: number }) {
    this.paint.flush();
    const p = this.puppet;
    const pl = this.player;
    pl.pose(frameDt);
    const f = computeFrame({
      aspect: this.host.camera.aspect,
      fov: this.host.camera.fov,
      actors: [
        { x: pl.x, halfWidth: 0.9, top: PUPPET.height + 0.2 + 0.8 },
        { x: p.x, halfWidth: PUPPET.halfWidth + (p.airborne ? 0.6 : 0), top: p.lift + PUPPET.height },
      ],
    });
    const k = this.camInit ? Math.min(1, frameDt * CAMERA.followRate) : 1;
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
    this.shoes.clear();
    this.particles.clear();
    this.words.clear();
    this.puppet.dispose();
    this.host.dispose(this.paint.textures());
    this.dom.fx.replaceChildren();
  }
}
