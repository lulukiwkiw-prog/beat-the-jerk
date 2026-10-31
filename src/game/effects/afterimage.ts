import { Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { EFFECTS } from '../../config/effects.config';
import { srgb } from '../three/color';

interface Ghost {
  mesh: Mesh;
  life: number;
}

/** 淡出用的共用材質：依剩餘時間分成幾級透明度，不必每個殘影各建一個材質 */
const LEVELS = 6;

/**
 * 殘影：把出招中的拳頭、腿、武器在目前位置複製一份半透明的影子，
 * 很快淡出，看起來像揮拳踢腳的速度線。共用原本的幾何與分級材質，同時最多 maxGhosts 個。
 */
export class AfterImages {
  private list: Ghost[] = [];
  private readonly mats: MeshBasicMaterial[];

  constructor(private readonly parent: Object3D) {
    const A = EFFECTS.afterimage;
    const color = srgb(A.color);
    this.mats = Array.from({ length: LEVELS }, (_, i) => new MeshBasicMaterial({ color, transparent: true, opacity: (A.opacity * (i + 1)) / LEVELS, depthWrite: false }));
  }

  spawn(parts: Object3D[]) {
    const A = EFFECTS.afterimage;
    for (const part of parts) {
      if (!part.visible) continue;
      part.updateWorldMatrix(true, true);
      part.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || !m.visible) return;
        const g = new Mesh(m.geometry, this.mats[LEVELS - 1]);
        g.matrixAutoUpdate = false;
        g.matrix.copy(m.matrixWorld);
        g.renderOrder = 1;
        this.parent.add(g);
        this.list.push({ mesh: g, life: A.life });
      });
    }
    while (this.list.length > A.maxGhosts) this.list.shift()!.mesh.removeFromParent();
  }

  update(dt: number) {
    const A = EFFECTS.afterimage;
    for (const g of this.list) {
      g.life -= dt;
      g.mesh.material = this.mats[Math.max(0, Math.min(LEVELS - 1, Math.ceil((g.life / A.life) * LEVELS) - 1))];
    }
    this.list = this.list.filter((g) => {
      if (g.life > 0) return true;
      g.mesh.removeFromParent();
      return false;
    });
  }

  get count() {
    return this.list.length;
  }

  clear() {
    this.list.forEach((g) => g.mesh.removeFromParent());
    this.list = [];
  }

  dispose() {
    this.clear();
    this.mats.forEach((m) => m.dispose());
  }
}
