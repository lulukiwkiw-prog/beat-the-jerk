import { Box3, Raycaster, Vector2, Vector3, type Mesh } from 'three';
import { PAINT } from '../config/paint.config';
import { PUPPET } from '../config/puppet.config';
import { prefersReducedMotion } from '../state/settings';
import { layoutBubble } from '../ui/bubble';
import { faceFromUV, uvToFacePoint, type Face, type FacePoint } from './puppet/faces';
import type { BrushSpec, PaintStore } from './puppet/paintSurface';
import { PART_DEFS, type PaintPartId } from './puppet/parts';
import { Puppet } from './puppet/Puppet';
import { buildPaintRoom, PAINT_ROOM_BACKGROUND } from './three/paintRoom';
import { projectToScreen } from './three/project';
import { SceneHost } from './three/sceneHost';

export interface PaintRoomEvents {
  onStatus(text: string): void;
  onZoomChange(part: PaintPartId | null): void;
  onPickModeChange(on: boolean): void;
}

interface Stroke {
  pointerId: number;
  part: PaintPartId;
  face: Face;
  last: FacePoint | null;
}

const FULL_TARGET = new Vector3(0, 2.45, 0);
const BODY_HALF_WIDTH = 1.75;

/**
 * 彩繪室的 3D 端：在積木人表面作畫、轉向、點選部位放大。
 */
export class PaintRoomController {
  private host: SceneHost;
  readonly puppet: Puppet;
  private ray = new Raycaster();
  private ndc = new Vector2();
  private stroke: Stroke | null = null;
  private brush: BrushSpec = { color: PAINT.colors[0].hex, width: PAINT.brushes[1].width, eraser: false };
  private turn: number = PAINT.initialTurn;
  private turnTarget: number = PAINT.initialTurn;
  private zoomPart: PaintPartId | null = null;
  private pickMode = false;
  private camTarget = FULL_TARGET.clone();
  private camDist = 11;
  private locked = false;
  private bubbleEl: HTMLElement | null = null;
  private readonly canvas: HTMLCanvasElement;

  constructor(container: HTMLElement, private readonly paint: PaintStore, private readonly ev: PaintRoomEvents) {
    this.host = new SceneHost(container, PAINT_ROOM_BACKGROUND, 6);
    this.host.scene.add(buildPaintRoom());
    this.puppet = new Puppet(paint);
    this.puppet.addTo(this.host.scene);
    this.canvas = this.host.renderer.domElement;
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.camDist = this.fullDistance();
    this.host.start({
      update: (dt) => this.update(dt),
      beforeRender: (_dt, size) => this.render(size),
    });
  }

  setBrush(b: BrushSpec) {
    this.brush = b;
  }

  turnBy(dir: -1 | 1) {
    this.turnTarget += dir * PAINT.turnStep;
  }

  faceFront() {
    // 回到最接近的正面角度，平滑過渡
    this.turnTarget = Math.round(this.turnTarget / (Math.PI * 2)) * Math.PI * 2;
  }

  setPickMode(on: boolean) {
    this.pickMode = on;
    this.ev.onPickModeChange(on);
  }

  zoomTo(part: PaintPartId | null) {
    this.zoomPart = part;
    this.ev.onZoomChange(part);
  }

  setBubble(el: HTMLElement | null) {
    this.bubbleEl = el;
  }

  /** 完成動畫：得意晃動；沒有 B 時顯示滑稽表情。 */
  playFinish(hasLine: boolean) {
    this.locked = true;
    this.stroke = null;
    this.zoomTo(null);
    this.setPickMode(false);
    this.turnTarget = Math.round(this.turnTarget / (Math.PI * 2)) * Math.PI * 2 + 0.25;
    this.puppet.gloat();
    if (!hasLine) this.puppet.sillyFace(PUPPET.finishAnimTime);
  }

  private fullDistance() {
    const tv = Math.tan((this.host.camera.fov / 2) * (Math.PI / 180));
    const halfH = 3.1;
    const halfW = 2.2;
    return Math.max(halfH / tv, halfW / (tv * this.host.camera.aspect)) + 1.2;
  }

  private update(dt: number) {
    this.turn += (this.turnTarget - this.turn) * Math.min(1, dt * PAINT.turnRate);
    this.puppet.root.rotation.y = this.turn;
    this.puppet.update(dt, { reducedMotion: prefersReducedMotion(), freezeIdle: !!this.stroke || !!this.zoomPart });
    // 鏡頭：全身或放大到選定部位
    let target = FULL_TARGET;
    let dist = this.fullDistance();
    if (this.zoomPart) {
      const m = this.puppet.meshes[this.zoomPart];
      const box = new Box3().setFromObject(m);
      target = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const tv = Math.tan((this.host.camera.fov / 2) * (Math.PI / 180));
      const r = Math.max(size.x, size.y, size.z) * 0.95 + 0.4;
      dist = Math.max(r / tv, r / (tv * this.host.camera.aspect));
    }
    const k = Math.min(1, dt * 5);
    this.camTarget.lerp(target, k);
    this.camDist += (dist - this.camDist) * k;
    const cam = this.host.camera;
    cam.position.set(this.camTarget.x, this.camTarget.y + 0.15 + this.camDist * 0.012, this.camTarget.z + this.camDist);
    cam.lookAt(this.camTarget);
  }

  private render(size: { width: number; height: number }) {
    this.paint.flush();
    if (this.bubbleEl && !this.bubbleEl.hidden) {
      // 以頭部高度、身體（含舉起的手臂）最外緣為界，泡泡不蓋住積木人
      const head = this.puppet.meshes.head.getWorldPosition(new Vector3());
      const cam = this.host.camera;
      const l = projectToScreen(head.x - BODY_HALF_WIDTH, head.y + 0.2, head.z, cam, size.width, size.height);
      const r = projectToScreen(head.x + BODY_HALF_WIDTH, head.y + 0.2, head.z, cam, size.width, size.height);
      layoutBubble(this.bubbleEl, {
        headLeft: l.x,
        headRight: r.x,
        headY: r.y,
        prefer: 'right',
        topReserve: 0,
        screenWidth: size.width,
        screenHeight: size.height,
      });
    }
  }

  // ---------- 作畫 ----------
  private pick(e: PointerEvent): { part: PaintPartId; face: Face; u: number; v: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.host.camera);
    const hit = this.ray.intersectObjects(this.puppet.paintTargets() as Mesh[], false)[0];
    if (!hit || !hit.uv) return null;
    return { part: hit.object.userData.part as PaintPartId, face: faceFromUV(hit.uv.x, hit.uv.y), u: hit.uv.x, v: hit.uv.y };
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (this.locked || this.stroke || this.puppet.isScattered) return;
    const h = this.pick(e);
    if (!h) {
      this.ev.onStatus(this.pickMode ? '點一下積木人的某個部位來放大' : '要畫在積木人身上喔');
      return;
    }
    if (this.pickMode) {
      this.setPickMode(false);
      this.zoomTo(h.part);
      this.ev.onStatus(`放大：${PART_DEFS[h.part].label}`);
      return;
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 測試環境可能不支援 */
    }
    this.paint.beginStroke(h.part, h.face);
    const p = uvToFacePoint(h.u, h.v, h.face, PART_DEFS[h.part].size);
    this.stroke = { pointerId: e.pointerId, part: h.part, face: h.face, last: p };
    this.paint.segment(h.part, h.face, p, p, this.brush);
    this.ev.onStatus(`正在畫：${PART_DEFS[h.part].label}`);
  };

  private onMove = (e: PointerEvent) => {
    const s = this.stroke;
    if (!s || e.pointerId !== s.pointerId) return;
    const h = this.pick(e);
    // 一筆只留在起筆的部位與那一面；滑出去先暫停，回到原面再接續
    if (!h || h.part !== s.part || h.face !== s.face) {
      s.last = null;
      return;
    }
    const p = uvToFacePoint(h.u, h.v, h.face, PART_DEFS[h.part].size);
    this.paint.segment(h.part, h.face, s.last ?? p, p, this.brush);
    s.last = p;
  };

  private onUp = (e: PointerEvent) => {
    if (this.stroke && e.pointerId === this.stroke.pointerId) this.stroke = null;
  };

  /** 測試用：某部位某面中心的螢幕座標（CSS px，相對視窗）。 */
  screenPointOf(part: PaintPartId, face: Face = 4, a = 0.5, b = 0.5): { x: number; y: number } | null {
    const m = this.puppet.meshes[part];
    m.updateWorldMatrix(true, false);
    const [w, h, d] = PART_DEFS[part].size;
    const local = new Vector3();
    if (face === 4) local.set((a - 0.5) * w, (0.5 - b) * h, d / 2);
    else if (face === 5) local.set((0.5 - a) * w, (0.5 - b) * h, -d / 2);
    else if (face === 0) local.set(w / 2, (0.5 - b) * h, (0.5 - a) * d);
    else if (face === 1) local.set(-w / 2, (0.5 - b) * h, (a - 0.5) * d);
    else return null;
    const world = m.localToWorld(local);
    const s = projectToScreen(world.x, world.y, world.z, this.host.camera, this.host.width, this.host.height);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + s.x, y: rect.top + s.y };
  }

  get isSettled() {
    return Math.abs(this.turnTarget - this.turn) < 0.01;
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.puppet.dispose();
    this.host.dispose(this.paint.textures());
  }
}
