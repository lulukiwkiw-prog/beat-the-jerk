import { PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { settingsStore } from '../../state/settings';
import { QualityGovernor, type QualityLevel } from './quality';

let renderer: WebGLRenderer | null = null;
let failed = false;
export const governor = new QualityGovernor(settingsStore.get().quality);
const qualityListeners = new Set<(q: QualityLevel) => void>();

settingsStore.subscribe(() => {
  const mode = settingsStore.get().quality;
  if (mode !== governor.mode) {
    governor.setMode(mode);
    applyQuality();
  }
});

/** 裝置是否支援 WebGL。 */
export function webglSupported(): boolean {
  if (failed) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 全站共用單一 WebGLRenderer：彩繪室與擂台輪流使用同一個畫布，
 * 避免行動裝置 WebGL context 數量上限。不支援時回傳 null。
 */
export function getRenderer(): WebGLRenderer | null {
  if (renderer) return renderer;
  if (failed || !webglSupported()) return null;
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.domElement.className = 'gl-canvas';
    renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
    applyQuality();
    return renderer;
  } catch {
    failed = true;
    return null;
  }
}

export function currentQuality(): QualityLevel {
  return governor.current(window.devicePixelRatio || 1);
}

export function applyQuality() {
  const q = currentQuality();
  if (renderer) {
    renderer.setPixelRatio(q.pixelRatio);
  }
  qualityListeners.forEach((fn) => fn(q));
}

export function onQualityChange(fn: (q: QualityLevel) => void) {
  qualityListeners.add(fn);
  return () => qualityListeners.delete(fn);
}

/** 每個渲染畫格回報耗時，交給自動畫質判斷。 */
export function reportFrame(frameDt: number) {
  if (governor.sample(frameDt)) applyQuality();
}
