import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';

export type DecalKind = 'palm' | 'shoe' | 'silly' | 'nosebleed';

function makeTex(draw: (c: CanvasRenderingContext2D) => void): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  draw(cv.getContext('2d')!);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

let texCache: Record<DecalKind, CanvasTexture> | null = null;
function textures(): Record<DecalKind, CanvasTexture> {
  if (texCache) return texCache;
  texCache = {
    palm: makeTex((x) => {
      x.fillStyle = '#E8546A';
      x.beginPath();
      x.ellipse(64, 76, 30, 34, 0, 0, Math.PI * 2);
      x.fill();
      for (let i = 0; i < 4; i++) {
        x.beginPath();
        x.ellipse(36 + i * 18, 30, 8, 22, (-1.5 + i) * 0.12, 0, Math.PI * 2);
        x.fill();
      }
      x.beginPath();
      x.ellipse(100, 70, 8, 20, -0.9, 0, Math.PI * 2);
      x.fill();
    }),
    shoe: makeTex((x) => {
      x.fillStyle = '#4A3A2A';
      x.beginPath();
      x.ellipse(64, 44, 26, 34, 0, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.ellipse(64, 100, 19, 22, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 5; i++) x.fillRect(42, 22 + i * 10, 44, 3);
    }),
    // 漫畫鼻血：兩道往下流的紅線，末端圓滴
    nosebleed: makeTex((x) => {
      x.fillStyle = '#D9212C';
      for (const cx of [50, 78]) {
        x.beginPath();
        x.moveTo(cx - 5, 10);
        x.quadraticCurveTo(cx - 7, 60, cx - 3, 96);
        x.lineTo(cx + 3, 96);
        x.quadraticCurveTo(cx + 6, 60, cx + 5, 10);
        x.closePath();
        x.fill();
        x.beginPath();
        x.arc(cx, 100, 8, 0, Math.PI * 2);
        x.fill();
      }
    }),
    // 滑稽表情：挑眉＋吐舌（不使用任何文字）
    silly: makeTex((x) => {
      x.lineCap = 'round';
      x.strokeStyle = '#1E1E1E';
      x.lineWidth = 7;
      x.beginPath();
      x.moveTo(22, 34);
      x.quadraticCurveTo(36, 18, 52, 30);
      x.moveTo(78, 38);
      x.lineTo(104, 38);
      x.stroke();
      x.fillStyle = '#1E1E1E';
      x.beginPath();
      x.arc(38, 52, 7, 0, Math.PI * 2);
      x.arc(90, 54, 7, 0, Math.PI * 2);
      x.fill();
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(36, 84);
      x.quadraticCurveTo(64, 96, 94, 80);
      x.stroke();
      x.fillStyle = '#F06A86';
      x.beginPath();
      x.ellipse(70, 100, 12, 16, 0.2, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#B8405A';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(70, 92);
      x.lineTo(71, 108);
      x.stroke();
    }),
  };
  return texCache;
}

interface Decal {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  life: number;
}

/** 掌印、鞋印、表情貼片：透明平面跟著部位動，不寫入玩家的彩繪貼圖。 */
export class DecalLayer {
  private list: Decal[] = [];

  add(target: Object3D, kind: DecalKind, w: number, h: number, frontZ: number, life: number, jitter: [number, number]) {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ map: textures()[kind], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    mesh.position.set((Math.random() - 0.5) * jitter[0], (Math.random() - 0.5) * jitter[1], frontZ + 0.012);
    mesh.rotation.z = kind === 'silly' || kind === 'nosebleed' ? 0 : (Math.random() - 0.5) * 0.6;
    mesh.renderOrder = 2;
    target.add(mesh);
    this.list.push({ mesh, life });
    return mesh;
  }

  update(dt: number) {
    for (const d of this.list) {
      d.life -= dt;
      d.mesh.material.opacity = Math.max(0, Math.min(1, d.life / 0.4));
      if (d.life <= 0) this.dispose(d);
    }
    this.list = this.list.filter((d) => d.life > 0);
  }

  get count() {
    return this.list.length;
  }

  private dispose(d: Decal) {
    d.mesh.removeFromParent();
    d.mesh.geometry.dispose();
    d.mesh.material.dispose();
  }

  clear() {
    this.list.forEach((d) => this.dispose(d));
    this.list = [];
  }
}
