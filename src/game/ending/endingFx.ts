import {
  AdditiveBlending, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PointLight, SpotLight, Sprite, SpriteMaterial,
  SRGBColorSpace, TorusGeometry, type Object3D,
} from 'three';
import { srgb } from '../three/color';

function glowTexture(color: string): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, color);
    g.addColorStop(0.45, 'rgba(255,214,120,.55)');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** 結局 1「原諒」：金色光束從天而降、玩家背後發光成剪影、木偶頭上出現小光環。 */
export class ForgiveFx {
  readonly group = new Group();
  private beam: Mesh<CylinderGeometry, MeshBasicMaterial>;
  private glow: Sprite;
  private halo: Mesh<TorusGeometry, MeshBasicMaterial>;
  private light: PointLight;

  constructor(parent: Object3D) {
    this.beam = new Mesh(
      new CylinderGeometry(1.1, 1.9, 16, 32, 1, true),
      new MeshBasicMaterial({ color: srgb('#FFE08A'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.beam.position.y = 8;
    this.glow = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(255,236,170,1)'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.glow.scale.set(7, 7, 1);
    this.glow.position.set(0, 3, -1.2);
    this.halo = new Mesh(new TorusGeometry(0.55, 0.08, 10, 36), new MeshBasicMaterial({ color: srgb('#FFD54F'), transparent: true, opacity: 0 }));
    this.halo.rotation.x = Math.PI / 2;
    this.light = new PointLight(srgb('#FFD27A'), 0, 14, 1.5);
    this.light.position.set(0, 5, 2);
    this.group.add(this.beam, this.glow, this.halo, this.light);
    parent.add(this.group);
  }

  /** t：0～1 的演出進度 */
  update(t: number, playerX: number, haloAt: { x: number; y: number }) {
    const ease = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    this.beam.position.x = playerX;
    this.beam.material.opacity = 0.3 * ease(0.08, 0.35);
    this.glow.position.x = playerX;
    this.glow.material.opacity = 0.75 * ease(0.25, 0.55);
    const s = 5 + 3 * ease(0.25, 0.7);
    this.glow.scale.set(s, s, 1);
    this.light.position.x = playerX;
    this.light.intensity = 12 * ease(0.1, 0.5);
    const h = ease(0.45, 0.6);
    this.halo.material.opacity = h;
    this.halo.position.set(haloAt.x, haloAt.y + 0.25 + Math.sin(t * 20) * 0.04, 0);
    this.halo.scale.setScalar(0.4 + 0.6 * h);
  }

  dispose() {
    this.group.removeFromParent();
    this.beam.geometry.dispose();
    this.beam.material.dispose();
    this.glow.material.map?.dispose();
    this.glow.material.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
  }
}

/** 結局 2「到此為止」：燈逐盞熄滅後，最後一盞燈照著玩家。 */
export class LeaveFx {
  readonly light: SpotLight;
  constructor(parent: Object3D) {
    this.light = new SpotLight(srgb('#FFF1D6'), 0, 30, 0.38, 0.6, 1);
    this.light.position.set(0, 12, 6);
    parent.add(this.light);
    parent.add(this.light.target);
  }
  update(t: number, playerX: number) {
    this.light.target.position.set(playerX, 1, 0);
    this.light.position.x = playerX + 2;
    this.light.intensity = 160 * Math.max(0, Math.min(1, (t - 0.45) / 0.15));
  }
  dispose() {
    this.light.target.removeFromParent();
    this.light.removeFromParent();
    this.light.dispose();
  }
}
