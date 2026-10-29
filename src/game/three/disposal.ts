import type { Material, Mesh, Object3D, Texture } from 'three';

/** 釋放某物件樹下的幾何體、材質（及其貼圖）。keep 內的貼圖（例如玩家彩繪）不釋放。 */
export function disposeTree(root: Object3D, keep: Set<Texture> = new Set()) {
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const list = Array.isArray(m.material) ? m.material : [m.material];
    list.forEach((x) => x && mats.add(x));
  });
  mats.forEach((mat) => {
    for (const val of Object.values(mat)) {
      const t = val as Texture;
      if (t && t.isTexture && !keep.has(t)) t.dispose();
    }
    mat.dispose();
  });
}
