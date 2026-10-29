import { Fog, Vector3 } from 'three';
import { CAMERA, GAME } from '../config/game.config';
import { EFFECTS } from '../config/effects.config';
import { PUPPET } from '../config/puppet.config';
import { prefersReducedMotion, settingsStore, vibrate } from '../state/settings';
import { ComicWords } from './effects/comicWords';
import { Particles } from './effects/particles';
import { buildPlayer, posePlayerIdle, type PlayerRig } from './player/playerModel';
import type { PaintStore } from './puppet/paintSurface';
import { Puppet, type PuppetEvent } from './puppet/Puppet';
import { ARENA_BACKGROUND, buildArena } from './three/arena';
import { computeFrame } from './three/camera';
import { SceneHost } from './three/sceneHost';

export type PreviewAction = 'punch' | 'slap' | 'launch' | 'shoe' | 'smash' | 'explode';

/**
 * 階段 1 擂台預覽：玩家彩繪的積木人在擂台上待機，可用測試按鈕觸發受擊與噴飛。
 * 階段 2 由正式戰鬥取代。
 */
export class ArenaPreviewController {
  private host: SceneHost;
  readonly puppet: Puppet;
  private player: PlayerRig;
  private playerX: number = GAME.playerStartX;
  private particles: Particles;
  private words: ComicWords;
  private time = 0;
  private shake = 0;
  private flash = 0;
  private cam = { x: 0, dist: 18, lookY: CAMERA.lookY, camY: CAMERA.baseY };
  private camInit = false;
  private punchN = 0;

  constructor(
    container: HTMLElement,
    private readonly fxLayer: HTMLElement,
    private readonly flashEl: HTMLElement,
    private readonly paint: PaintStore,
  ) {
    this.host = new SceneHost(container, ARENA_BACKGROUND, 11, CAMERA.fov);
    this.host.scene.fog = new Fog(ARENA_BACKGROUND, 30, 60);
    this.host.scene.add(buildArena());
    this.puppet = new Puppet(paint);
    this.puppet.addTo(this.host.scene);
    this.puppet.reset(GAME.puppetStartX);
    this.player = buildPlayer();
    this.host.scene.add(this.player.root);
    this.particles = new Particles(this.host.scene);
    this.words = new ComicWords(fxLayer);
    document.addEventListener('visibilitychange', this.onVis);
    this.host.start({
      update: (dt) => this.update(dt),
      beforeRender: (dt, size) => this.render(dt, size),
    });
  }

  private onVis = () => {
    // 切到背景時立刻把零件歸位，不殘留
    if (document.hidden) this.puppet.forceReassemble();
  };

  private get dir(): 1 | -1 {
    return this.puppet.x >= this.playerX ? 1 : -1;
  }

  trigger(a: PreviewAction) {
    const p = this.puppet;
    if (p.invulnerable) {
      this.words.add('揮空', p.x, 3.6, '#C9D2F2', 0.55);
      return;
    }
    const dir = this.dir;
    const hit = new Vector3(p.x - dir * 0.4, p.lift + 3.2, 0.6);
    const reduced = prefersReducedMotion();
    switch (a) {
      case 'punch':
        p.punch(dir, this.punchN++);
        this.impact(hit, this.punchN % 2 ? '砰！' : '啪！', 3, 5, 0.4);
        break;
      case 'slap':
        p.slap(dir);
        this.impact(hit.setY(p.lift + 4.1), '啪！！', 3, 4, 0.4);
        break;
      case 'launch':
        p.launch(dir);
        this.impact(hit, '咻碰！', 6, 10, 1);
        break;
      case 'shoe':
        p.shoeHit(dir);
        this.impact(hit, '咚！', 3, 5, 0.8);
        break;
      case 'smash':
        p.smash(dir);
        this.impact(hit, '碰！', 4, 6, 1);
        break;
      case 'explode':
        p.explode(1, reduced);
        this.impact(hit, '嘩啦！', 5, 8, 1);
        break;
    }
  }

  private impact(at: Vector3, word: string, stars: number, chips: number, power: number) {
    this.particles.burst(at, 'star', stars);
    this.particles.burst(at, 'chip', chips);
    this.words.add(word, at.x, at.y + 0.6, '#E8392B', 1);
    this.kick(power);
  }

  private kick(power: number) {
    const s = settingsStore.get();
    if (s.shake !== 'off' && !prefersReducedMotion()) this.shake = Math.max(this.shake, CAMERA.shake[s.shake] * power);
    if (s.flash !== 'off') this.flash = Math.max(this.flash, EFFECTS.flash[s.flash] * power);
    vibrate(EFFECTS.vibrateMs);
  }

  private handle(ev: PuppetEvent) {
    const p = this.puppet;
    if (ev.type === 'landHard') {
      this.words.add('嘩啦！', p.x, 1.2, '#FFC63A', 1.1);
      this.kick(1);
    } else if (ev.type === 'land') {
      this.words.add('咚！', p.x, 0.8, '#FFC63A', 0.8);
    } else if (ev.type === 'wall') {
      this.words.add('碰！', p.x, 3, '#FFC63A', 0.8);
      this.particles.burst(new Vector3(p.x, 3, 0), 'star', 4);
      this.kick(0.6);
    }
  }

  private update(dt: number) {
    this.time += dt;
    const evs = this.puppet.update(dt, { walls: [GAME.wallL, GAME.wallR], reducedMotion: prefersReducedMotion() });
    evs.forEach((e) => this.handle(e));
    this.particles.update(dt);
    this.words.update(dt);
    this.shake = Math.max(0, this.shake - dt * CAMERA.shakeDecay);
    this.flash = Math.max(0, this.flash - dt * EFFECTS.flashDecay);
    this.player.root.position.x = this.playerX;
    posePlayerIdle(this.player, this.time, this.dir);
  }

  private render(frameDt: number, size: { width: number; height: number }) {
    this.paint.flush();
    const p = this.puppet;
    const f = computeFrame({
      aspect: this.host.camera.aspect,
      fov: this.host.camera.fov,
      actors: [
        { x: this.playerX, halfWidth: 0.9, top: PUPPET.height + 0.2 },
        { x: p.x, halfWidth: PUPPET.halfWidth + (p.airborne ? 0.6 : 0), top: p.lift + PUPPET.height },
      ],
    });
    const k = this.camInit ? Math.min(1, frameDt * CAMERA.followRate) : 1;
    this.camInit = true;
    this.cam.x += (f.x - this.cam.x) * k;
    // 拉遠要快（避免角色出框），拉近要慢
    const kd = f.dist > this.cam.dist ? Math.min(1, frameDt * 10) : k;
    this.cam.dist += (f.dist - this.cam.dist) * kd;
    this.cam.lookY += (f.lookY - this.cam.lookY) * kd;
    this.cam.camY += (f.camY - this.cam.camY) * kd;
    const sh = this.shake;
    const cam = this.host.camera;
    cam.position.set(this.cam.x + (Math.random() - 0.5) * sh, this.cam.camY + (Math.random() - 0.5) * sh, this.cam.dist);
    cam.lookAt(this.cam.x, this.cam.lookY, 0);
    this.words.layout(cam, size.width, size.height);
    this.flashEl.style.opacity = String(this.flash);
  }

  /** 測試用狀態 */
  debugState() {
    return {
      x: this.puppet.x,
      lift: this.puppet.lift,
      scattered: this.puppet.isScattered,
      particles: this.particles.count,
      decals: this.puppet.decals.count,
    };
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVis);
    this.particles.clear();
    this.words.clear();
    this.puppet.dispose();
    this.host.dispose(this.paint.textures());
    this.fxLayer.replaceChildren();
  }
}

