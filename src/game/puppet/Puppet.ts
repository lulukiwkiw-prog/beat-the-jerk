import { Group, Mesh, MeshStandardMaterial, Object3D, Vector3, type Material } from 'three';
import { GAME } from '../../config/game.config';
import { PUPPET } from '../../config/puppet.config';
import { plastic } from '../three/color';
import { atlasBox, cachedRoundedBox, studGeometry } from '../three/geometry';
import { DecalLayer } from './decals';
import type { PaintStore } from './paintSurface';
import { PART_DEFS, type FixedPartId, type PaintPartId } from './parts';
import { Scatter } from './scatter';
import { DelayBuffer, spring0, stepSpring, type Spring } from './spring';

const R = PUPPET.reactions;
const CH = ['torsoZ', 'torsoX', 'headX', 'headY', 'headZ', 'shL', 'elL', 'shR', 'elR', 'hipL', 'hipR', 'knL', 'knR'] as const;
type Channel = (typeof CH)[number];
type Pose = Record<Channel, number>;

export type PuppetEvent = { type: 'land'; impact: number } | { type: 'landHard'; impact: number } | { type: 'wall'; speed: number; side: -1 | 1 } | { type: 'reassembled' };

export interface PuppetEnv {
  /** 場地邊界；彩繪室不傳 */
  walls?: [number, number];
  reducedMotion: boolean;
  /** 彩繪中：停止待機晃動，避免筆下的積木跑掉 */
  freezeIdle?: boolean;
}

type Act = 'gloat' | null;

/**
 * 積木人（對手）：骨架、彩繪部位、彈簧姿勢、受擊反應、噴飛再組回。
 */
export class Puppet {
  readonly root = new Group();
  private readonly spinPivot = new Group();
  private readonly squashG = new Group();
  readonly meshes = {} as Record<PaintPartId, Mesh>;
  readonly fixed = {} as Record<FixedPartId, Mesh>;
  private readonly joints: Record<string, Group> = {};
  private readonly flyables: Object3D[] = [];
  readonly decals = new DecalLayer();

  x = 0;
  vx = 0;
  lift = 0;
  vy = 0;
  airborne = false;
  private spin = spring0();
  private sx = spring0(1);
  private sy = spring0(1);
  private pose = Object.fromEntries(CH.map((c) => [c, spring0()])) as Record<Channel, Spring>;
  private delayed = new DelayBuffer<{ torso: number; vx: number }>(PUPPET.limbDelay, { torso: 0, vx: 0 });
  private time = 0;
  private idleTime = 0;
  private waveT = 0;
  private downT = 0;
  private act: Act = null;
  private actT = 0;
  private scatter: Scatter | null = null;
  private world: Object3D | null = null;

  constructor(paint: PaintStore, opts: { shadows?: boolean } = {}) {
    const shadows = opts.shadows ?? true;
    this.spinPivot.position.y = PUPPET.height / 2;
    this.root.add(this.spinPivot);
    const off = new Group();
    off.position.y = -PUPPET.height / 2;
    this.spinPivot.add(off);
    off.add(this.squashG);
    const pelvis = new Group();
    pelvis.position.y = 2.15;
    this.squashG.add(pelvis);
    const studMat = plastic(PUPPET.baseColor);

    const part = (name: PaintPartId, parent: Object3D, y: number) => {
      const def = PART_DEFS[name];
      const [w, h, d] = def.size;
      const mat = new MeshStandardMaterial({ map: paint.surfaces[name].texture, roughness: 0.32, metalness: 0 });
      const m = new Mesh(atlasBox(w, h, d, def.radius), mat);
      m.position.y = y;
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.userData.part = name;
      m.name = name;
      if (name === 'head') {
        for (let i = 0; i < 2; i++) {
          const s = new Mesh(studGeometry(), studMat);
          s.position.set((i - 0.5) * 0.42, h / 2 + 0.05, 0);
          s.castShadow = shadows;
          m.add(s);
        }
      }
      parent.add(m);
      this.meshes[name] = m;
      this.flyables.push(m);
      return m;
    };
    const joint = (name: string, parent: Object3D, x: number, y: number) => {
      const g = new Group();
      g.position.set(x, y, 0);
      parent.add(g);
      this.joints[name] = g;
      return g;
    };
    const fixedMesh = (name: FixedPartId, m: Mesh) => {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.name = name;
      this.fixed[name] = m;
      this.flyables.push(m);
      return m;
    };

    const torsoJ = joint('torso', pelvis, 0, 0);
    part('torso', torsoJ, 0.75);
    const neck = joint('neck', torsoJ, 0, 1.47);
    part('head', neck, 0.53);
    for (const s of ['L', 'R'] as const) {
      const sx = s === 'L' ? -1.13 : 1.13;
      const sh = joint('sh' + s, torsoJ, sx, 1.32);
      part(s === 'L' ? 'upperArmL' : 'upperArmR', sh, -0.4);
      const el = joint('el' + s, sh, 0, -0.82);
      part(s === 'L' ? 'foreArmL' : 'foreArmR', el, -0.375);
      // 連指手套形的手（含拇指）
      const skin = plastic(PUPPET.handColor);
      const hand = fixedMesh(s === 'L' ? 'handL' : 'handR', new Mesh(cachedRoundedBox(0.5, 0.48, 0.52, 0.2), skin));
      hand.position.y = -0.98;
      const thumb = new Mesh(cachedRoundedBox(0.16, 0.26, 0.2, 0.07), skin);
      thumb.position.set(s === 'L' ? 0.27 : -0.27, 0.06, 0.08);
      thumb.rotation.z = s === 'L' ? -0.35 : 0.35;
      thumb.castShadow = shadows;
      hand.add(thumb);
      el.add(hand);
    }
    for (const s of ['L', 'R'] as const) {
      const hx = s === 'L' ? -0.43 : 0.43;
      const hip = joint('hip' + s, pelvis, hx, 0);
      part(s === 'L' ? 'thighL' : 'thighR', hip, -0.475);
      const kn = joint('kn' + s, hip, 0, -0.97);
      part(s === 'L' ? 'shinL' : 'shinR', kn, -0.475);
      // 圓角鞋
      const shoe = fixedMesh(s === 'L' ? 'shoeL' : 'shoeR', new Mesh(cachedRoundedBox(0.74, 0.28, 1.08, 0.12), plastic(PUPPET.shoeColor)));
      shoe.position.set(0, -1.07, 0.15);
      kn.add(shoe);
    }
  }

  /** 加入場景（噴飛時零件掛到這個物件下）。 */
  addTo(world: Object3D) {
    this.world = world;
    world.add(this.root);
  }

  get isScattered() {
    return this.scatter !== null;
  }
  /** 噴飛或組回期間不能被命中 */
  get invulnerable() {
    return this.scatter !== null;
  }
  get isDown() {
    return this.downT > 0;
  }

  /** 身體中心的世界座標 */
  center(out = new Vector3()) {
    return this.spinPivot.getWorldPosition(out);
  }

  reset(x: number) {
    this.forceReassemble();
    this.x = x;
    this.vx = this.vy = this.lift = 0;
    this.airborne = false;
    this.spin = spring0();
    this.sx = spring0(1);
    this.sy = spring0(1);
    for (const c of CH) this.pose[c] = spring0();
    this.waveT = this.downT = 0;
    this.act = null;
    this.decals.clear();
    this.delayed.reset();
    this.apply();
  }

  // ---------- 受擊反應 ----------
  punch(dir: number, n = 0) {
    const r = R.punch;
    const side = n % 2 ? -1 : 1;
    this.pose.headZ.vel += side * dir * -(r.headZ + Math.random() * 4);
    this.pose.headX.vel += r.headX;
    this.pose.torsoZ.vel -= dir * r.torso;
    this.sx.vel += r.squashX;
    this.sy.vel += r.squashY;
    this.pose.shL.vel += dir * -r.shoulder;
    this.pose.shR.vel += dir * -r.shoulder;
    this.vx += dir * r.push;
    if (this.airborne) this.vy = Math.max(this.vy, 4);
  }

  slap(dir: number) {
    const r = R.slap;
    this.pose.headY.vel += dir * r.headY;
    this.pose.headZ.vel -= dir * r.headZ;
    this.waveT = r.waveTime;
    this.vx += dir * r.push;
    const [w, h, d] = PART_DEFS.head.size;
    this.decals.add(this.meshes.head, 'palm', 0.6, 0.7, d / 2, r.decalLife, [w * 0.45, h * 0.35]);
    if (this.airborne) this.vy = Math.max(this.vy, 3.5);
  }

  /** 打上天（上勾拳）：浮空約 1.5H、空翻。 */
  launch(dir: number) {
    const r = R.launch;
    this.airborne = true;
    this.vy = r.vy;
    this.spin.vel = -dir * r.spin;
    this.vx += dir * r.push;
    this.sy.vel += r.squashY;
  }

  shoeHit(dir: number) {
    const r = R.shoe;
    this.vx += dir * r.push;
    this.sx.vel += r.squashX;
    this.sy.vel += r.squashY;
    this.pose.torsoZ.vel -= dir * r.torso;
    const [w, h, d] = PART_DEFS.torso.size;
    this.decals.add(this.meshes.torso, 'shoe', 0.55, 0.75, d / 2, r.decalLife, [w * 0.45, h * 0.35]);
  }

  /** 強力擊退（撞牆回彈測試）。 */
  smash(dir: number) {
    this.vx += dir * R.wallSmash.push;
    this.sy.vel += R.wallSmash.squashY;
    this.pose.torsoZ.vel -= dir * 6;
  }

  gloat() {
    this.act = 'gloat';
    this.actT = 0;
  }

  sillyFace(life: number) {
    const [, , d] = PART_DEFS.head.size;
    this.decals.add(this.meshes.head, 'silly', 1.0, 0.92, d / 2, life, [0, 0]);
  }

  /** 噴飛再組回。 */
  explode(strength: number, reduced: boolean) {
    if (this.scatter || !this.world) return;
    this.world.updateMatrixWorld(true);
    this.scatter = new Scatter(this.flyables, this.world, this.center(), strength, reduced);
  }

  /** 立刻把所有零件歸位。 */
  forceReassemble() {
    if (!this.scatter) return;
    this.scatter.reassemble();
    this.scatter = null;
  }

  // ---------- 每步更新 ----------
  update(dt: number, env: PuppetEnv): PuppetEvent[] {
    const ev: PuppetEvent[] = [];
    this.time += dt;
    if (!env.freezeIdle) this.idleTime += dt;
    if (this.act) {
      this.actT += dt;
      if (this.actT > PUPPET.finishAnimTime) this.act = null;
    }
    this.waveT = Math.max(0, this.waveT - dt);
    this.downT = Math.max(0, this.downT - dt);
    this.decals.update(dt);

    const S = PUPPET.springs;
    if (this.airborne || this.lift > 0) {
      this.vy -= GAME.gravity * dt;
      this.lift += this.vy * dt;
      this.spin.v += this.spin.vel * dt;
      if (this.lift <= 0) {
        this.lift = 0;
        const impact = -this.vy;
        this.vy = 0;
        this.airborne = false;
        this.spin.v = Math.atan2(Math.sin(this.spin.v), Math.cos(this.spin.v));
        this.spin.vel = 0;
        if (impact > R.landing.scatterImpact) {
          this.explode(1, env.reducedMotion);
          ev.push({ type: 'landHard', impact });
        } else if (impact > R.landing.softImpact) {
          this.sy.vel -= impact * R.landing.squash;
          this.sx.vel += impact * 0.5;
          this.downT = R.getUpTime;
          ev.push({ type: 'land', impact });
        }
      }
    } else {
      stepSpring(this.spin, 0, S.spin.k, S.spin.d, dt);
    }

    this.x += this.vx * dt;
    this.vx *= Math.pow(this.airborne ? PUPPET.airFriction : PUPPET.groundFriction, dt);
    if (env.walls) {
      const [l, r] = env.walls;
      if (this.x < l) {
        this.x = l;
        if (Math.abs(this.vx) > PUPPET.wallBumpSpeed) ev.push({ type: 'wall', speed: Math.abs(this.vx), side: -1 });
        this.vx = Math.abs(this.vx) * PUPPET.wallRestitution;
      }
      if (this.x > r) {
        this.x = r;
        if (Math.abs(this.vx) > PUPPET.wallBumpSpeed) ev.push({ type: 'wall', speed: Math.abs(this.vx), side: 1 });
        this.vx = -Math.abs(this.vx) * PUPPET.wallRestitution;
      }
    }

    stepSpring(this.sx, 1, S.squash.k, S.squash.d, dt);
    stepSpring(this.sy, 1, S.squash.k, S.squash.d, dt);
    const L = PUPPET.squashLimits;
    this.sx.v = Math.max(L.minX, Math.min(L.maxX, this.sx.v));
    this.sy.v = Math.max(L.minY, Math.min(L.maxY, this.sy.v));

    this.delayed.push(this.time, { torso: this.pose.torsoZ.v, vx: this.vx });
    const T = this.targets();
    for (const c of CH) {
      const sp = c.startsWith('head') ? S.head : S.joint;
      stepSpring(this.pose[c], T[c], sp.k, sp.d, dt);
    }

    if (this.scatter && this.scatter.update(dt)) {
      this.scatter = null;
      this.sx.vel -= 4;
      this.sy.vel += 6;
      ev.push({ type: 'reassembled' });
    }
    this.apply();
    return ev;
  }

  private targets(): Pose {
    const t = this.idleTime;
    const T: Pose = {
      torsoZ: Math.sin(t * 1.6) * 0.03,
      torsoX: 0,
      headX: 0,
      headY: Math.sin(t * 0.9) * 0.12,
      headZ: Math.sin(t * 1.3 + 1) * 0.05,
      shL: -0.12,
      elL: -0.05,
      shR: 0.12,
      elR: 0.05,
      hipL: -0.04,
      hipR: 0.04,
      knL: 0,
      knR: 0,
    };
    // 四肢延遲擺動：跟隨約 90ms 前的軀幹與移動
    const lagged = this.delayed.get(this.time);
    const lag = Math.max(-0.8, Math.min(0.8, lagged.vx * 0.05)) - lagged.torso * 0.9;
    T.shL += lag;
    T.shR += lag;
    T.elL += lag * 0.5;
    T.elR += lag * 0.5;
    T.hipL += lag * 0.2;
    T.hipR += lag * 0.2;
    if (this.airborne) {
      T.shL = -2.2;
      T.shR = 2.2;
      T.elL = -0.4;
      T.elR = 0.4;
      T.hipL = -0.45;
      T.hipR = 0.45;
    }
    if (this.downT > 0) {
      T.torsoX = 0.35;
      T.knL = -0.6;
      T.knR = -0.6;
      T.headX = 0.2;
    }
    if (this.act === 'gloat') {
      const a = this.actT;
      T.torsoZ = Math.sin(a * 9) * 0.14;
      T.headZ = Math.sin(a * 9 + 0.6) * 0.22;
      T.headY = 0.25;
      // 雙手叉腰得意晃動（手不舉到頭旁邊，對話泡泡才不會蓋到身體）
      T.shL = -0.65 + Math.sin(a * 9) * 0.08;
      T.elL = 1.75;
      T.shR = 0.65 + Math.sin(a * 9) * 0.08;
      T.elR = -1.75;
      T.hipL = -0.12 + Math.sin(a * 9) * 0.06;
      T.hipR = 0.12 + Math.sin(a * 9) * 0.06;
    }
    return T;
  }

  private apply() {
    const p = this.pose;
    const j = this.joints;
    this.root.position.set(this.x, this.lift, 0);
    this.spinPivot.rotation.z = this.spin.v;
    this.squashG.scale.set(this.sx.v, this.sy.v, this.sx.v);
    j.torso.rotation.set(p.torsoX.v, 0, p.torsoZ.v);
    j.neck.rotation.set(p.headX.v, p.headY.v, p.headZ.v);
    j.shL.rotation.z = p.shL.v;
    j.elL.rotation.z = p.elL.v;
    j.shR.rotation.z = p.shR.v;
    j.elR.rotation.z = p.elR.v;
    j.hipL.rotation.z = p.hipL.v;
    j.hipR.rotation.z = p.hipR.v;
    j.knL.rotation.x = p.knL.v;
    j.knR.rotation.x = p.knR.v;
    const head = this.meshes.head;
    if (!this.scatter) {
      if (this.waveT > 0) {
        // 臉部左右波浪變形
        const k = this.waveT / R.slap.waveTime;
        const w = Math.sin(this.time * 48);
        head.scale.set(1 + w * R.slap.waveAmount * k, 1 - w * 0.1 * k, 1);
      } else head.scale.set(1, 1, 1);
    }
  }

  /** 所有可被點選彩繪的部位 mesh。 */
  paintTargets(): Mesh[] {
    return Object.values(this.meshes);
  }

  setShadows(on: boolean) {
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = on;
    });
  }

  dispose() {
    this.forceReassemble();
    this.decals.clear();
    this.root.removeFromParent();
    for (const m of Object.values(this.meshes)) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
  }
}

