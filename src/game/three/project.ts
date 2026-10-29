import { Vector3, type Camera } from 'three';

const v = new Vector3();
/** 3D 座標 → 畫布上的 CSS px（給 HTML 疊層用）。 */
export function projectToScreen(x: number, y: number, z: number, camera: Camera, width: number, height: number) {
  v.set(x, y, z).project(camera);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
}
