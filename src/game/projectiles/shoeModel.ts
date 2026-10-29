import { BoxGeometry, Group, Mesh } from 'three';
import { plastic } from '../three/color';

let geos: BoxGeometry[] | null = null;

/** 丟出去的鞋子（3D 物件，共用幾何與材質）。 */
export function buildShoe(): Group {
  geos ??= [new BoxGeometry(0.9, 0.26, 0.42), new BoxGeometry(0.4, 0.34, 0.42), new BoxGeometry(0.94, 0.08, 0.46)];
  const g = new Group();
  const brown = plastic('#8B5A2B');
  const a = new Mesh(geos[0], brown);
  a.castShadow = true;
  g.add(a);
  const b = new Mesh(geos[1], brown);
  b.position.set(-0.25, 0.28, 0);
  b.castShadow = true;
  g.add(b);
  const s = new Mesh(geos[2], plastic('#FFFFFF'));
  s.position.y = -0.15;
  g.add(s);
  return g;
}
