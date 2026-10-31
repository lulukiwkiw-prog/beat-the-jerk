import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { PUPPET } from '../../config/puppet.config';

interface Item {
  mesh: Object3D;
  parent: Object3D;
  homePos: Vector3;
  homeQuat: Quaternion;
  homeScale: Vector3;
  vel: Vector3;
  ang: Vector3;
  fromPos?: Vector3;
  fromQuat?: Quaternion;
}

export type ScatterPhase = 'fly' | 'return';

const C = PUPPET.scatter;
const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler();
const _dq = new Quaternion();

/**
 * 積木噴飛再自動組回：所有零件脫離骨架、各自拋物線飛散並碰地反彈，
 * flyTime 後在 returnTime 內平滑飛回骨架上的原位。
 */
export class Scatter {
  t = 0;
  private items: Item[];
  private done = false;

  /**
   * hold＝散了就躺在地上不組回（致命一擊擊倒），之後呼叫 release() 才飛回原位。
   */
  constructor(
    meshes: Object3D[],
    private readonly world: Object3D,
    center: Vector3,
    strength: number,
    reduced: boolean,
    rand: () => number = Math.random,
    private hold = false,
  ) {
    const scale = reduced ? C.reducedMotionScale : 1;
    world.updateMatrixWorld(true);
    this.items = meshes.map((mesh) => {
      const it: Item = {
        mesh,
        parent: mesh.parent!,
        homePos: mesh.position.clone(),
        homeQuat: mesh.quaternion.clone(),
        homeScale: mesh.scale.clone(),
        vel: new Vector3(),
        ang: new Vector3(),
      };
      world.attach(mesh);
      const dir = mesh.getWorldPosition(new Vector3()).sub(center);
      dir.z += 0.6;
      dir.normalize();
      it.vel
        .copy(dir)
        .multiplyScalar(C.baseSpeed + rand() * C.randomSpeed * strength)
        .add(new Vector3((rand() - 0.5) * 2, C.upSpeed + rand() * C.randomUp * strength, (rand() - 0.2) * 2.5));
      it.vel.x *= scale;
      it.vel.z *= scale;
      it.vel.y *= reduced ? 0.7 : 1;
      it.ang.set((rand() - 0.5) * C.angular, (rand() - 0.5) * C.angular, (rand() - 0.5) * C.angular);
      return it;
    });
  }

  get phase(): ScatterPhase {
    return this.t < C.flyTime ? 'fly' : 'return';
  }

  get finished() {
    return this.done;
  }

  get held() {
    return this.hold;
  }

  /** 開始飛回原位（returnTime 內組好）。 */
  release() {
    if (!this.hold) return;
    this.hold = false;
    this.t = C.flyTime;
  }

  /** 推進時間；回傳 true 表示已組回完成。 */
  update(dt: number): boolean {
    if (this.done) return true;
    this.t += dt;
    // 擊倒：一直停在飛散階段，落地後慢慢停住
    if (this.hold) this.t = Math.min(this.t, C.flyTime - 0.001);
    if (this.t < C.flyTime) {
      for (const it of this.items) {
        const m = it.mesh;
        it.vel.y -= C.gravity * dt;
        m.position.addScaledVector(it.vel, dt);
        _e.set(it.ang.x * dt, it.ang.y * dt, it.ang.z * dt);
        _dq.setFromEuler(_e);
        m.quaternion.premultiply(_dq);
        if (m.position.y < C.floorY) {
          m.position.y = C.floorY;
          it.vel.y = Math.abs(it.vel.y) * C.bounce;
          it.vel.x *= C.friction;
          it.vel.z *= C.friction;
          it.ang.multiplyScalar(C.spinFriction);
        }
        m.position.z = Math.max(C.zMin, Math.min(C.zMax, m.position.z));
        if (this.hold && m.position.y <= C.floorY + 0.01) {
          // 躺在地上：滑動與翻滾逐漸停下
          const f = Math.pow(0.04, dt);
          it.vel.x *= f;
          it.vel.z *= f;
          it.ang.multiplyScalar(f);
          if (Math.abs(it.vel.y) < 0.6) it.vel.y = 0;
        }
      }
      return false;
    }
    if (this.t < C.flyTime + C.returnTime) {
      const k = (this.t - C.flyTime) / C.returnTime;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // 骨架仍在動，每幀重算原位的世界變換
      this.world.updateMatrixWorld(true);
      for (const it of this.items) {
        if (!it.fromPos) {
          it.fromPos = it.mesh.position.clone();
          it.fromQuat = it.mesh.quaternion.clone();
        }
        _m.compose(it.homePos, it.homeQuat, it.homeScale).premultiply(it.parent.matrixWorld).decompose(_p, _q, _s);
        it.mesh.position.lerpVectors(it.fromPos, _p, e);
        it.mesh.quaternion.copy(it.fromQuat!).slerp(_q, e);
        it.mesh.scale.copy(_s);
      }
      return false;
    }
    this.reassemble();
    return true;
  }

  /** 立刻全部歸位（回合結束、暫停、重新開始、離開畫面時）。 */
  reassemble() {
    if (this.done) return;
    for (const it of this.items) {
      it.parent.add(it.mesh);
      it.mesh.position.copy(it.homePos);
      it.mesh.quaternion.copy(it.homeQuat);
      it.mesh.scale.copy(it.homeScale);
    }
    this.done = true;
  }
}
