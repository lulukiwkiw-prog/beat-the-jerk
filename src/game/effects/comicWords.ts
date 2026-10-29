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
  rise: number;
  pop: boolean;
}

/** 漫畫狀聲字：HTML 疊層，位置由 3D 座標投影換算（不在 3D 場景內繪製文字）。 */
export class ComicWords {
  private list: Word[] = [];
  constructor(private readonly layer: HTMLElement) {}

  add(text: string, x: number, y: number, color: string, size = 1, kind: 'word' | 'score' = 'word') {
    const el = document.createElement('div');
    el.className = kind === 'score' ? 'comic-word score' : 'comic-word';
    el.textContent = text;
    el.style.color = color;
    el.style.setProperty('--size', String(size));
    this.layer.appendChild(el);
    const life = kind === 'score' ? EFFECTS.scoreLife : EFFECTS.wordLife;
    this.list.push({ el, x, y, life, max: life, rot: kind === 'score' ? 0 : (Math.random() - 0.5) * 16, rise: kind === 'score' ? 1.6 : 0.6, pop: kind === 'word' });
  }

  update(dt: number) {
    for (const w of this.list) {
      w.life -= dt;
      w.y += w.rise * dt;
      if (w.life <= 0) w.el.remove();
    }
    this.list = this.list.filter((w) => w.life > 0);
  }

  layout(camera: Camera, width: number, height: number) {
    for (const w of this.list) {
      const s = projectToScreen(w.x, w.y, 0.6, camera, width, height);
      const k = w.life / w.max;
      const pop = w.pop ? 1 + Math.max(0, k - 0.7) * 2 : 1;
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
