import { Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { EFFECTS } from '../../config/effects.config';
import { srgb } from '../three/color';

interface Ghost {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  life: number;
}

/**
 * 殘影：把出招中的拳頭、腿、武器在目前位置複製一份半透明的影子，
 * 很快淡出，看起來像揮拳踢腳的速度線。共用原本的幾何，不另外建模。
 */
export class AfterImages {
  private list: Ghost[] = [];
  private readonly color = srgb(EFFECTS.afterimage.color);

  constructor(private readonly parent: Object3D) {}

  spawn(parts: Object3D[]) {
    const A = EFFECTS.afterimage;
    for (const part of parts) {
      if (!part.visible) continue;
      part.updateWorldMatrix(true, true);
      part.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || !m.visible) return;
        const mat = new MeshBasicMaterial({ color: this.color, transparent: true, opacity: A.opacity, depthWrite: false });
        const g = new Mesh(m.geometry, mat);
        g.matrixAutoUpdate = false;
        g.matrix.copy(m.matrixWorld);
        g.renderOrder = 1;
        this.parent.add(g);
        this.list.push({ mesh: g, mat, life: A.life });
      });
    }
  }

  update(dt: number) {
    const A = EFFECTS.afterimage;
    for (const g of this.list) {
      g.life -= dt;
      g.mat.opacity = Math.max(0, (g.life / A.life) * A.opacity);
    }
    this.list = this.list.filter((g) => {
      if (g.life > 0) return true;
      g.mesh.removeFromParent();
      g.mat.dispose();
      return false;
    });
  }

  get count() {
    return this.list.length;
  }

  clear() {
    this.list.forEach((g) => {
      g.mesh.removeFromParent();
      g.mat.dispose();
    });
    this.list = [];
  }
}
