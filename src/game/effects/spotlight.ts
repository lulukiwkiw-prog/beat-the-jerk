import {
  AdditiveBlending, CanvasTexture, CircleGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial, Object3D, SpotLight, SRGBColorSpace,
} from 'three';
import { APOLOGY_SPOT } from '../../config/dialogue.config';
import { srgb } from '../three/color';

function poolTexture(): CanvasTexture | null {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  if (!c) return null;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,200,1)');
  g.addColorStop(0.55, 'rgba(255,220,170,0.55)');
  g.addColorStop(1, 'rgba(255,210,160,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * 道歉時的舞台聚光燈：一盞燈從正上方（略偏前方）照在積木人頭上，
 * 加上看得見的光柱與地上的光圈。背景全黑時才看得出光的形狀。
 */
export class StageSpot {
  private readonly root = new Group();
  private readonly light: SpotLight;
  private readonly target = new Object3D();
  private readonly beam: Mesh<ConeGeometry, MeshBasicMaterial>;
  private readonly pool: Mesh<CircleGeometry, MeshBasicMaterial>;

  constructor(parent: Object3D) {
    const S = APOLOGY_SPOT;
    this.light = new SpotLight(srgb(S.color), 0, 0, S.angle, S.penumbra, 0);
    this.light.target = this.target;
    this.root.add(this.light, this.target);
    const beamH = S.height;
    const r = Math.tan(S.angle) * beamH * 0.8;
    this.beam = new Mesh(
      new ConeGeometry(r, beamH, 40, 1, true),
      new MeshBasicMaterial({ color: srgb(S.color), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.beam.position.y = beamH / 2;
    this.root.add(this.beam);
    const tex = poolTexture();
    this.pool = new Mesh(
      new CircleGeometry(S.poolRadius, 48),
      new MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : srgb(S.color), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.03;
    this.root.add(this.pool);
    parent.add(this.root);
  }

  /** x＝積木人位置、headY＝頭的高度、k＝亮度 0～1 */
  update(x: number, headY: number, k: number) {
    const S = APOLOGY_SPOT;
    this.light.position.set(x, S.height, S.forward);
    this.target.position.set(x, headY, 0);
    this.light.intensity = S.intensity * k;
    this.beam.position.x = x;
    this.beam.material.opacity = S.beamOpacity * k;
    this.pool.position.x = x;
    this.pool.material.opacity = S.poolOpacity * k;
  }

  dispose() {
    this.root.removeFromParent();
    this.light.dispose();
    this.beam.geometry.dispose();
    this.beam.material.dispose();
    this.pool.geometry.dispose();
    this.pool.material.map?.dispose();
    this.pool.material.dispose();
  }
}
