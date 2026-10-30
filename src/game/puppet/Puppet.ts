import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Vector3, type Material } from 'three';
import { GAME } from '../../config/game.config';
import { PUPPET } from '../../config/puppet.config';
import { plastic, plasticUnique, srgb } from '../three/color';
import { atlasBox, cachedRoundedBox, roundedCylinderAtlas, studGeometry } from '../three/geometry';
import { DecalLayer } from './decals';
import type { PaintStore } from './paintSurface';
import { PART_DEFS, SKELETON as SK, type FixedPartId, type PaintPartId } from './parts';
import { Scatter } from './scatter';
import { buildAccessory, type AccessorySlot } from './looks/accessories';
import { buildBucket } from '../projectiles/weaponModels';
import { DelayBuffer, spring0, stepSpring, type Spring } from './spring';

const R = PUPPET.reactions;
/** 地面摩擦下滑行 dist 所需的初速（每秒保留比例 f → 衰減率 -ln f） */
const knockSpeed = (dist: number) => dist * -Math.log(PUPPET.groundFriction);
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const CH = ['torsoZ', 'torsoX', 'headX', 'headY', 'headZ', 'shL', 'elL', 'shR', 'elR', 'hipL', 'hipR', 'hipLx', 'hipRx', 'knL', 'knR'] as const;
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
export type AiPose = 'idle' | 'windup' | 'punch';

/**
 * 積木人（對手）：骨架、彩繪部位、彈簧姿勢、受擊反應、噴飛再組回。
 */
export class Puppet {
  readonly root = new Group();
  private readonly spinPivot = new Group();
  private readonly squashG = new Group();
  private readonly yawG = new Group();
  private yaw = spring0();
  private yawTarget = 0;
  private stance = false;
  private stanceFront: 'L' | 'R' = 'L';
  private extraPaint: Mesh[] = [];
  /** 演出姿勢：站、單膝跪地（道歉）、坐（結局） */
  private poseMode: 'stand' | 'kneel' | 'sit' = 'stand';
  private drop = spring0();
  private fadeLevel = 1;
  private flatT = 0;
  /** 迴旋踢轉圈、暈眩、手風琴的剩餘時間 */
  private spinT = 0;
  private spinDir: 1 | -1 = 1;
  private stunT = 0;
  private accT = 0;
  private explodeAfterAcc = false;
  private bucket: Object3D | null = null;
  private fadeMats: MeshStandardMaterial[] | null = null;
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
  private aiPose: AiPose = 'idle';
  private aiSide: -1 | 1 = -1;
  private accObjects: Object3D[] = [];
  private neckMesh!: Mesh;
  private offPaint: () => void = () => {};
  private offAcc: () => void;
  private readonly shadows: boolean;

  constructor(paint: PaintStore, opts: { shadows?: boolean } = {}) {
    const shadows = opts.shadows ?? true;
    this.shadows = shadows;
    this.spinPivot.position.y = PUPPET.height / 2;
    this.root.add(this.spinPivot);
    const off = new Group();
    off.position.y = -PUPPET.height / 2;
    this.spinPivot.add(off);
    off.add(this.squashG);
    // 轉身面向對手（只轉身體，空翻仍在畫面平面上）
    this.squashG.add(this.yawG);
    const pelvis = new Group();
    pelvis.position.y = SK.pelvisY;
    this.yawG.add(pelvis);
    const studMat = plastic(PUPPET.baseColor);

    const part = (name: PaintPartId, parent: Object3D, y: number) => {
      const def = PART_DEFS[name];
      const [w, h, d] = def.size;
      const mat = new MeshStandardMaterial({ map: paint.surfaces[name].texture, roughness: 0.32, metalness: 0 });
      const geo = def.shape === 'cylinder' ? roundedCylinderAtlas(w / 2, h, def.radius) : atlasBox(w, h, d, def.radius);
      const m = new Mesh(geo, mat);
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
    part('torso', torsoJ, SK.torsoY);
    const neck = joint('neck', torsoJ, 0, SK.neckJointY);
    // 短脖子（固定零件，顏色跟著頭底部）
    this.neckMesh = fixedMesh('neck', new Mesh(new CylinderGeometry(SK.neck.radius, SK.neck.radius * 1.08, SK.neck.height, 20), plasticUnique(PUPPET.baseColor)));
    this.neckMesh.position.y = SK.neck.y;
    neck.add(this.neckMesh);
    part('head', neck, SK.headY);
    for (const s of ['L', 'R'] as const) {
      const sx = s === 'L' ? -SK.shoulder.x : SK.shoulder.x;
      const sh = joint('sh' + s, torsoJ, sx, SK.shoulder.y);
      part(s === 'L' ? 'upperArmL' : 'upperArmR', sh, SK.upperArmY);
      const el = joint('el' + s, sh, 0, SK.elbowY);
      part(s === 'L' ? 'foreArmL' : 'foreArmR', el, SK.foreArmY);
      // 連指手套形的手（含拇指）
      const skin = plastic(PUPPET.handColor);
      const hand = fixedMesh(s === 'L' ? 'handL' : 'handR', new Mesh(cachedRoundedBox(0.5, 0.48, 0.52, 0.2), skin));
      hand.position.y = SK.handY;
      const thumb = new Mesh(cachedRoundedBox(0.16, 0.26, 0.2, 0.07), skin);
      thumb.position.set(s === 'L' ? 0.27 : -0.27, 0.06, 0.08);
      thumb.rotation.z = s === 'L' ? -0.35 : 0.35;
      thumb.castShadow = shadows;
      hand.add(thumb);
      el.add(hand);
    }
    for (const s of ['L', 'R'] as const) {
      const hx = s === 'L' ? -SK.hipX : SK.hipX;
      const hip = joint('hip' + s, pelvis, hx, 0);
      part(s === 'L' ? 'thighL' : 'thighR', hip, SK.thighY);
      const kn = joint('kn' + s, hip, 0, SK.kneeY);
      part(s === 'L' ? 'shinL' : 'shinR', kn, SK.shinY);
      // 圓角鞋
      const shoe = fixedMesh(s === 'L' ? 'shoeL' : 'shoeR', new Mesh(cachedRoundedBox(0.74, 0.28, 1.08, 0.12), plastic(PUPPET.shoeColor)));
      shoe.position.set(0, SK.shoe.y, SK.shoe.z);
      kn.add(shoe);
    }
    this.syncAccessories(paint);
    this.offAcc = paint.onAccessories(() => this.syncAccessories(paint));
    this.syncNeck(paint);
    this.offPaint = paint.onChange(() => this.syncNeck(paint));
  }

  /** 依目前選的範例重建 3D 配件（掛在部位 mesh 底下，會跟著噴飛）。 */
  private syncAccessories(paint: PaintStore) {
    this.accObjects.forEach((o) => o.removeFromParent());
    this.accObjects = [];
    this.extraPaint = [];
    for (const slot of ['face', 'hair', 'costume'] as AccessorySlot[]) {
      const id = paint.accessories[slot];
      if (!id) continue;
      for (const a of buildAccessory(id)) {
        const target = (this.meshes as Record<string, Mesh>)[a.part] ?? (this.fixed as Record<string, Mesh>)[a.part];
        if (!target) continue;
        a.object.traverse((o) => {
          if ((o as Mesh).isMesh) (o as Mesh).castShadow = this.shadows;
        });
        target.add(a.object);
        this.accObjects.push(a.object);
        // 可彩繪的配件（立體肚子）：換成所屬部位的材質，並列入作畫目標
        a.object.traverse((o) => {
          const pp = o.userData.paintPart as PaintPartId | undefined;
          if (pp && (o as Mesh).isMesh) {
            (o as Mesh).material = this.meshes[pp].material;
            o.userData.part = pp;
            this.extraPaint.push(o as Mesh);
          }
        });
      }
    }
  }

  /** 脖子取頭部底面的顏色，看起來和頭是同一塊 */
  private syncNeck(paint: PaintStore) {
    const hex = paint.sampleColor('head', 3);
    (this.neckMesh.material as MeshStandardMaterial).color.copy(srgb(hex));
  }

  /** 目前戴著幾種 3D 配件（一種配件可能由好幾塊組成） */
  get accessoryCount() {
    return new Set(this.accObjects.map((o) => o.userData.accessory)).size;
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
  get squashScaleY() {
    return this.sy.v;
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
    this.yaw = spring0(this.yawTarget);
    this.sx = spring0(1);
    this.sy = spring0(1);
    for (const c of CH) this.pose[c] = spring0();
    this.waveT = this.downT = 0;
    this.flatT = 0;
    this.clearStatus();
    this.act = null;
    this.aiPose = 'idle';
    this.poseMode = 'stand';
    this.drop = spring0();
    this.setFade(1);
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

  /** 致命一擊：被光波轟上天（摔回地面時速度夠大就噴飛）。 */
  blast(vx: number, vy: number, dir: number) {
    this.airborne = true;
    this.vx = vx;
    this.vy = vy;
    this.spin.vel = -dir * 9;
    this.sy.vel += 8;
  }

  /** 被踩扁：整個壓成一片，時間到彈回。 */
  flatten() {
    this.flatT = R.flatten.time;
    this.sy.v = R.flatten.y;
    this.sx.v = R.flatten.x;
    this.sy.vel = this.sx.vel = 0;
  }

  get isFlat() {
    return this.flatT > 0;
  }

  /** 迴旋踢：原地轉一圈並後退 1H。 */
  spinKick(dir: number) {
    const r = R.spinKick;
    this.spinT = r.time;
    this.spinDir = dir < 0 ? -1 : 1;
    this.vx += dir * knockSpeed(r.distance * PUPPET.height);
    this.sy.vel += r.squashY;
  }

  /** 飛踢：擊退 2H（撞牆回彈，由場地邊界處理），倒地後起身。 */
  flyKicked(dir: number) {
    const r = R.flyKick;
    this.vx += dir * knockSpeed(r.distance * PUPPET.height);
    this.pose.torsoZ.vel -= dir * r.torso;
    this.sx.vel += r.squashX;
    if (!this.airborne) this.downT = R.getUpTime;
    else this.vy = Math.max(this.vy, 4);
  }

  /** 棍棒連打：前兩下輕敲，第 3 下強烈壓縮。 */
  clubHit(dir: number, segment: number) {
    const r = R.club;
    if (segment < 2) {
      this.sy.vel += r.light.squashY;
      this.pose.headX.vel += r.light.headX;
      this.vx += dir * r.light.push;
    } else {
      this.sy.v = r.strong.y;
      this.sx.v = r.strong.x;
      this.sy.vel = this.sx.vel = 0;
      this.vx += dir * r.strong.push;
    }
    if (this.airborne) this.vy = Math.max(this.vy, 3);
  }

  /** 水桶套頭：暈眩 1.5 秒（不出拳），桶子跟著頭動。 */
  bucketHit(dir: number) {
    const r = R.bucket;
    this.stunT = r.stun;
    this.vx += dir * r.push;
    this.pose.headZ.vel -= dir * 10;
    if (!this.bucket) {
      const b = buildBucket();
      const [w, h] = PART_DEFS.head.size;
      const k = ((w / 2) * r.scale) / 0.56;
      b.scale.setScalar(k);
      b.rotation.x = Math.PI;
      b.position.y = h * 0.28;
      this.meshes.head.add(b);
      this.bucket = b;
    }
  }

  /** 頭暈（不套水桶）：被擊倒後坐在地上晃 */
  daze(sec: number) {
    this.stunT = sec;
  }

  get isStunned() {
    return this.stunT > 0;
  }

  get hasBucket() {
    return this.bucket !== null;
  }

  /** 桌椅砸中：大力擊退與壓扁。 */
  chairHit(dir: number) {
    const r = R.chair;
    this.vx += dir * r.push;
    this.sx.vel += r.squashX;
    this.sy.vel += r.squashY;
    this.pose.torsoZ.vel -= dir * r.torso;
    if (!this.airborne) this.downT = R.getUpTime;
  }

  /** 鐵錘敲頭：壓成手風琴 0.5 秒後彈回，接著噴飛再組回。 */
  hammerHit() {
    this.accT = R.hammer.time;
    this.explodeAfterAcc = true;
    this.flatT = 0;
  }

  get isAccordion() {
    return this.accT > 0;
  }

  /** 清除暫時狀態（暈眩、套頭水桶、手風琴、轉圈）：重新開始、道歉轉場時呼叫。 */
  clearStatus() {
    this.spinT = this.stunT = this.accT = 0;
    this.explodeAfterAcc = false;
    this.bucket?.removeFromParent();
    this.bucket = null;
  }

  /** 強力擊退（撞牆回彈測試）。 */
  smash(dir: number) {
    this.vx += dir * R.wallSmash.push;
    this.sy.vel += R.wallSmash.squashY;
    this.pose.torsoZ.vel -= dir * 6;
  }

  /** 木偶出拳的姿勢：預備（明顯可見）與出拳。side＝玩家所在方向。 */
  setAiPose(pose: AiPose, side: -1 | 1) {
    this.aiPose = pose;
    this.aiSide = side;
  }

  setPoseMode(m: 'stand' | 'kneel' | 'sit') {
    this.poseMode = m;
  }

  /** 淡出／淡入（1＝完全不透明）。第一次呼叫時複製材質，不影響其他共用材質的物件。 */
  setFade(alpha: number) {
    if (alpha === this.fadeLevel) return;
    this.fadeLevel = alpha;
    if (!this.fadeMats) {
      const list: MeshStandardMaterial[] = [];
      this.root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const cloned = mats.map((x) => {
          const c = (x as MeshStandardMaterial).clone();
          list.push(c);
          return c;
        });
        m.material = Array.isArray(m.material) ? cloned : cloned[0];
      });
      this.fadeMats = list;
    }
    for (const m of this.fadeMats) {
      m.transparent = alpha < 1;
      m.opacity = alpha;
      m.depthWrite = alpha > 0.5;
    }
    this.root.visible = alpha > 0.01;
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
    this.spinT = Math.max(0, this.spinT - dt);
    if (this.stunT > 0) {
      this.stunT = Math.max(0, this.stunT - dt);
      if (this.stunT === 0) {
        this.bucket?.removeFromParent();
        this.bucket = null;
      }
    }
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

    stepSpring(this.yaw, this.yawTarget, S.spin.k * 0.5, S.spin.d, dt);
    // 跪下、坐下時身體往下沉，膝蓋或屁股碰到地板
    stepSpring(this.drop, this.poseMode === 'kneel' ? PUPPET.kneelDrop : this.poseMode === 'sit' ? PUPPET.sitDrop : 0, 60, 14, dt);
    if (this.accT > 0) {
      // 手風琴：壓扁並上下起伏，時間到用力彈回，接著噴飛
      const H = R.hammer;
      this.accT -= dt;
      this.sy.v = H.y + Math.sin(this.time * H.rippleSpeed) * H.ripple;
      this.sx.v = H.x - Math.sin(this.time * H.rippleSpeed) * H.ripple * 0.5;
      if (this.accT <= 0) {
        this.accT = 0;
        this.sy.vel = H.bounce;
        this.sx.vel = -H.bounce * 0.4;
        if (this.explodeAfterAcc) {
          this.explodeAfterAcc = false;
          this.explode(1, env.reducedMotion);
        }
      }
    } else if (this.flatT > 0) {
      // 壓扁中：維持扁扁一片，時間到用力彈回
      this.flatT -= dt;
      this.sy.v = R.flatten.y;
      this.sx.v = R.flatten.x;
      if (this.flatT <= 0) {
        this.sy.vel = R.flatten.bounce;
        this.sx.vel = -R.flatten.bounce * 0.5;
      }
    } else {
      stepSpring(this.sx, 1, S.squash.k, S.squash.d, dt);
      stepSpring(this.sy, 1, S.squash.k, S.squash.d, dt);
      const L = PUPPET.squashLimits;
      this.sx.v = Math.max(L.minX, Math.min(L.maxX, this.sx.v));
      // 不設下限：被踩扁後才能從扁扁一片自然彈回
      this.sy.v = Math.min(L.maxY, this.sy.v);
    }

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
      hipLx: 0,
      hipRx: 0,
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
    if (this.stance) {
      const st = PUPPET.stance;
      const front = this.stanceFront;
      T[front === 'L' ? 'hipLx' : 'hipRx'] = -st.frontHip;
      T[front === 'L' ? 'hipRx' : 'hipLx'] = st.backHip;
      T.knL = st.knee;
      T.knR = st.knee;
      T.torsoX += st.lean;
    }
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
      T.knL = 0.6;
      T.knR = 0.6;
      T.headX = 0.2;
    }
    if (this.stunT > 0) {
      // 暈頭轉向：頭與身體繞圈晃、雙手垂下
      const w = R.bucket.wobble;
      T.headZ = Math.sin(this.time * 7) * w;
      T.headX = Math.cos(this.time * 7) * w * 0.6;
      T.torsoZ = Math.sin(this.time * 7 + 0.8) * w * 0.35;
      T.shL = -0.05;
      T.shR = 0.05;
      T.elL = T.elR = 0;
    }
    if (this.aiPose !== 'idle' && !this.airborne) {
      const k = this.aiSide < 0 ? 1 : -1;
      const sh = this.aiSide < 0 ? 'shL' : 'shR';
      const el = this.aiSide < 0 ? 'elL' : 'elR';
      if (this.aiPose === 'windup') {
        T[sh] = 0.5 * k;
        T[el] = 1.6 * k;
        T.torsoZ = -0.14 * k;
        T.headZ = -0.08 * k;
      } else {
        T[sh] = -1.6 * k;
        T[el] = 0;
        T.torsoZ = 0.16 * k;
      }
    }
    if (this.poseMode === 'kneel') {
      // 單膝跪地、低頭
      T.hipLx = -1.45;
      T.knL = 1.5;
      T.hipRx = 0.1;
      T.knR = 1.55;
      T.torsoX = 0.12;
      T.headX = 0.5;
      T.headY = 0;
      T.headZ = 0;
      T.shL = -0.05;
      T.shR = 0.05;
      T.elL = -0.2;
      T.elR = 0.2;
    } else if (this.poseMode === 'sit') {
      // 坐在地上、腿往前伸、手放膝上
      T.hipLx = -1.5;
      T.hipRx = -1.5;
      T.knL = 0.25;
      T.knR = 0.25;
      T.torsoX = -0.05;
      T.headX = 0.15;
      T.shL = -0.25;
      T.shR = 0.25;
      T.elL = -0.3;
      T.elR = 0.3;
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
    this.root.position.set(this.x, this.lift - this.drop.v, 0);
    this.spinPivot.rotation.z = this.spin.v;
    this.squashG.scale.set(this.sx.v, this.sy.v, this.sx.v);
    j.torso.rotation.set(p.torsoX.v, 0, p.torsoZ.v);
    j.neck.rotation.set(p.headX.v, p.headY.v, p.headZ.v);
    j.shL.rotation.z = p.shL.v;
    j.elL.rotation.z = p.elL.v;
    j.shR.rotation.z = p.shR.v;
    j.elR.rotation.z = p.elR.v;
    j.hipL.rotation.set(p.hipLx.v, 0, p.hipL.v);
    j.hipR.rotation.set(p.hipRx.v, 0, p.hipR.v);
    // 迴旋踢：在站姿朝向上額外轉一整圈
    const spin = this.spinT > 0 ? this.spinDir * Math.PI * 2 * easeOut(1 - this.spinT / R.spinKick.time) : 0;
    this.yawG.rotation.y = this.yaw.v + spin;
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
    return [...Object.values(this.meshes), ...this.extraPaint];
  }

  /**
   * 對戰站姿：身體轉向對手（dir＝對手所在方向），一腳前一腳後。
   * 彩繪室不開，維持正面站直方便作畫。
   */
  setStance(on: boolean, dir: -1 | 1 = -1) {
    this.stance = on;
    this.yawTarget = on ? dir * PUPPET.stance.yaw : 0;
    this.stanceFront = dir < 0 ? 'L' : 'R';
  }

  setShadows(on: boolean) {
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = on;
    });
  }

  dispose() {
    this.clearStatus();
    this.offAcc();
    this.offPaint();
    this.accObjects.forEach((o) => o.removeFromParent());
    this.forceReassemble();
    this.decals.clear();
    this.root.removeFromParent();
    for (const m of Object.values(this.meshes)) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
  }
}

