import { Color, PerspectiveCamera, Scene, type Texture, type WebGLRenderer } from 'three';
import { disposeTree } from './disposal';
import { startLoop } from '../engine/loop';
import { addLights, type Lights } from './lights';
import { applyQuality, currentQuality, getRenderer, onQualityChange, reportFrame } from './renderer';

export interface HostCallbacks {
  update(dt: number): void;
  /** 渲染前呼叫（更新鏡頭、HTML 疊層） */
  beforeRender?(frameDt: number, size: { width: number; height: number }): void;
}

/**
 * 把共用的 WebGLRenderer 掛到某個容器上，負責尺寸、畫質與渲染迴圈。
 */
export class SceneHost {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly lights: Lights;
  readonly renderer: WebGLRenderer;
  width = 1;
  height = 1;
  private stopLoop: (() => void) | null = null;
  private ro: ResizeObserver;
  private offQuality: () => void;

  constructor(private readonly container: HTMLElement, background: string, shadowRange: number, fov = 30) {
    const r = getRenderer();
    if (!r) throw new Error('WebGL unavailable');
    this.renderer = r;
    this.scene.background = new Color(background);
    this.camera = new PerspectiveCamera(fov, 1, 0.1, 120);
    this.lights = addLights(this.scene, shadowRange);
    container.appendChild(r.domElement);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.offQuality = onQualityChange((q) => {
      this.lights.setShadows(q.shadows);
      this.renderer.setPixelRatio(q.pixelRatio);
      this.resize();
    });
    applyQuality();
    this.lights.setShadows(currentQuality().shadows);
    this.resize();
  }

  resize() {
    const w = Math.max(1, Math.round(this.container.clientWidth));
    const h = Math.max(1, Math.round(this.container.clientHeight));
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(cb: HostCallbacks) {
    this.stopLoop = startLoop({
      update: cb.update,
      render: (frameDt) => {
        reportFrame(frameDt);
        cb.beforeRender?.(frameDt, { width: this.width, height: this.height });
        this.renderer.render(this.scene, this.camera);
      },
    });
  }

  /** 停止迴圈並釋放場景資源；keep 內的貼圖（玩家彩繪）保留。 */
  dispose(keep?: Set<Texture>) {
    this.stopLoop?.();
    disposeTree(this.scene, keep);
    this.ro.disconnect();
    this.offQuality();
    if (this.renderer.domElement.parentElement === this.container) this.container.removeChild(this.renderer.domElement);
  }
}
