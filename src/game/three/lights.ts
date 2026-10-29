import { DirectionalLight, HemisphereLight, type Object3D } from 'three';
import { srgb } from './color';

export interface Lights {
  hemi: HemisphereLight;
  key: DirectionalLight;
  fill: DirectionalLight;
  setShadows(on: boolean): void;
}

/** 半球環境光＋主平行光（柔和陰影）＋淡藍補光。 */
export function addLights(scene: Object3D, range: number): Lights {
  const hemi = new HemisphereLight(srgb('#FFFFFF'), srgb('#BDB6A4'), 2.2);
  scene.add(hemi);
  const key = new DirectionalLight(srgb('#FFF6E8'), 2.1);
  key.position.set(5, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3;
  Object.assign(key.shadow.camera, { left: -range, right: range, top: range, bottom: -range, near: 1, far: 40 });
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);
  const fill = new DirectionalLight(srgb('#BCD0FF'), 0.8);
  fill.position.set(-6, 4, 6);
  scene.add(fill);
  return {
    hemi,
    key,
    fill,
    setShadows(on) {
      key.castShadow = on;
    },
  };
}
