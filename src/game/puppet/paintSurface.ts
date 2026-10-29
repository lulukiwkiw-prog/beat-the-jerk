import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { PAINT } from '../../config/paint.config';
import { PUPPET } from '../../config/puppet.config';
import { History } from './history';
import { PAINT_PARTS, PART_DEFS, type PaintPartId } from './parts';
import { atlasHeight, atlasWidth, cellOrigin, DEFAULT_LAYOUT, faceDims, FACES, type Face, type FacePoint } from './faces';

export interface Surface {
  part: PaintPartId;
  size: [number, number, number];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
  dirty: boolean;
}

export interface BrushSpec {
  color: string;
  width: number;
  eraser: boolean;
}

type FaceKey = `${PaintPartId}:${Face}`;

/**
 * 十個部位的彩繪貼圖（每部位一張 3×2 格）。彩繪室與擂台共用同一份。
 */
export class PaintStore {
  readonly surfaces: Record<PaintPartId, Surface>;
  readonly history: History<FaceKey, ImageData>;
  /** 曾被畫過的面（清空時只需記錄這些） */
  private touched = new Set<FaceKey>();
  private listeners = new Set<() => void>();

  constructor() {
    const surfaces = {} as Record<PaintPartId, Surface>;
    for (const part of PAINT_PARTS) {
      const canvas = document.createElement('canvas');
      canvas.width = atlasWidth();
      canvas.height = atlasHeight();
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = PUPPET.baseColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      surfaces[part] = { part, size: PART_DEFS[part].size, canvas, ctx, texture, dirty: false };
    }
    this.surfaces = surfaces;
    this.history = new History<FaceKey, ImageData>(
      PAINT.undoSteps,
      (key) => this.captureFace(key),
      (key, data) => this.restoreFace(key, data),
    );
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private faceRect(f: Face) {
    const o = cellOrigin(f);
    const g = DEFAULT_LAYOUT.gutter;
    return { x: o.x - g, y: o.y - g, w: DEFAULT_LAYOUT.cell + 2 * g, h: DEFAULT_LAYOUT.cell + 2 * g };
  }

  private parse(key: FaceKey): [PaintPartId, Face] {
    const [p, f] = key.split(':');
    return [p as PaintPartId, Number(f) as Face];
  }

  private captureFace(key: FaceKey): ImageData {
    const [part, f] = this.parse(key);
    const r = this.faceRect(f);
    return this.surfaces[part].ctx.getImageData(r.x, r.y, r.w, r.h);
  }

  private restoreFace(key: FaceKey, data: ImageData) {
    const [part, f] = this.parse(key);
    const r = this.faceRect(f);
    this.surfaces[part].ctx.putImageData(data, r.x, r.y);
    this.markDirty(part);
    this.touched.add(key);
  }

  private markDirty(part: PaintPartId) {
    this.surfaces[part].dirty = true;
  }

  /** 每幀呼叫：只更新被畫到的貼圖。 */
  flush() {
    for (const part of PAINT_PARTS) {
      const s = this.surfaces[part];
      if (s.dirty) {
        s.texture.needsUpdate = true;
        s.dirty = false;
      }
    }
  }

  /** 在某部位某一面上，以「該面的實際尺寸」為座標作畫。 */
  withFace(part: PaintPartId, f: Face, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    const s = this.surfaces[part];
    const o = cellOrigin(f);
    const [fw, fh] = faceDims(s.size, f);
    const r = this.faceRect(f);
    const c = s.ctx;
    c.save();
    // 剪裁到「格子＋留白」：筆畫可延伸到留白，邊緣取樣時仍是同一面的顏色
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.translate(o.x, o.y);
    c.scale(DEFAULT_LAYOUT.cell / fw, DEFAULT_LAYOUT.cell / fh);
    fn(c, fw, fh);
    c.restore();
    this.markDirty(part);
  }

  /** 開始一筆前呼叫，記錄復原點。 */
  beginStroke(part: PaintPartId, f: Face) {
    const key: FaceKey = `${part}:${f}`;
    this.history.record([key]);
    this.touched.add(key);
    this.emit();
  }

  /** 畫一段線。橡皮擦以預設底色覆蓋，不會擦出透明洞。 */
  segment(part: PaintPartId, f: Face, a: FacePoint, b: FacePoint, brush: BrushSpec) {
    this.withFace(part, f, (c) => {
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = brush.eraser ? PUPPET.baseColor : brush.color;
      c.lineWidth = brush.eraser ? brush.width * PAINT.eraserScale : brush.width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x + 0.0001, b.y);
      c.stroke();
    });
  }

  /** 清空全部彩繪（可復原，算 1 步）。 */
  clearAll() {
    const keys = [...this.touched];
    this.history.record(keys);
    for (const part of PAINT_PARTS) {
      const s = this.surfaces[part];
      s.ctx.fillStyle = PUPPET.baseColor;
      s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
      this.markDirty(part);
    }
    this.emit();
  }

  textures(): Set<Texture> {
    return new Set(PAINT_PARTS.map((p) => this.surfaces[p].texture));
  }

  /** 是否已被畫過（不是全空白）。 */
  get hasPaint(): boolean {
    return this.touched.size > 0;
  }

  undo() {
    const ok = this.history.undo();
    this.emit();
    return ok;
  }
  redo() {
    const ok = this.history.redo();
    this.emit();
    return ok;
  }

  /** 測試用：計算某部位不是底色的像素數。 */
  paintedPixels(part: PaintPartId, face?: Face): number {
    const s = this.surfaces[part];
    const faces = face === undefined ? FACES : [face];
    let n = 0;
    const base = hexToRgb(PUPPET.baseColor);
    for (const f of faces) {
      const o = cellOrigin(f);
      const d = s.ctx.getImageData(o.x, o.y, DEFAULT_LAYOUT.cell, DEFAULT_LAYOUT.cell).data;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - base[0]) + Math.abs(d[i + 1] - base[1]) + Math.abs(d[i + 2] - base[2]) > 30) n++;
      }
    }
    return n;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

let store: PaintStore | null = null;
/** 全域共用的彩繪貼圖（只存在記憶體）。 */
export function getPaintStore(): PaintStore {
  if (!store) store = new PaintStore();
  return store;
}
