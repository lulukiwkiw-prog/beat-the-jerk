import type { Camera } from 'three';
import { EFFECTS } from '../../config/effects.config';
import { projectToScreen } from '../three/project';

interface Word {
  el: HTMLDivElement;
  x: number;
  y: number;
  life: number;
  max: number;
  rot: number;
}

/** 漫畫狀聲字：HTML 疊層，位置由 3D 座標投影換算（不在 3D 場景內繪製文字）。 */
export class ComicWords {
  private list: Word[] = [];
  constructor(private readonly layer: HTMLElement) {}

  add(text: string, x: number, y: number, color: string, size = 1) {
    const el = document.createElement('div');
    el.className = 'comic-word';
    el.textContent = text;
    el.style.color = color;
    el.style.setProperty('--size', String(size));
    this.layer.appendChild(el);
    this.list.push({ el, x, y, life: EFFECTS.wordLife, max: EFFECTS.wordLife, rot: (Math.random() - 0.5) * 16 });
  }

  update(dt: number) {
    for (const w of this.list) {
      w.life -= dt;
      w.y += 0.6 * dt;
      if (w.life <= 0) w.el.remove();
    }
    this.list = this.list.filter((w) => w.life > 0);
  }

  layout(camera: Camera, width: number, height: number) {
    for (const w of this.list) {
      const s = projectToScreen(w.x, w.y, 0.6, camera, width, height);
      const k = w.life / w.max;
      const pop = 1 + Math.max(0, k - 0.7) * 2;
      w.el.style.left = `${s.x}px`;
      w.el.style.top = `${s.y}px`;
      w.el.style.opacity = String(Math.min(1, k * 2.2));
      w.el.style.transform = `translate(-50%,-50%) rotate(${w.rot}deg) scale(${pop})`;
    }
  }

  clear() {
    this.list.forEach((w) => w.el.remove());
    this.list = [];
  }
}
