import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { plastic, srgb } from './color';
import { roundedBox, studGeometry } from './geometry';

export const PAINT_ROOM_BACKGROUND = '#E9E8DF';

/** 彩繪室：灰色展示底座（四角凸點）。 */
export function buildPaintRoom(): Group {
  const g = new Group();
  const floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: srgb('#E1DFD4'), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.36;
  floor.receiveShadow = true;
  g.add(floor);
  const grey = plastic('#A9B3AE');
  const stand = new Mesh(roundedBox(3.4, 0.34, 2.4, 0.06), grey);
  stand.position.y = -0.17;
  stand.receiveShadow = true;
  stand.castShadow = true;
  g.add(stand);
  for (const [x, z] of [[-1.35, -0.85], [1.35, -0.85], [-1.35, 0.85], [1.35, 0.85]]) {
    const s = new Mesh(studGeometry(), grey);
    s.position.set(x, 0.055, z);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}
