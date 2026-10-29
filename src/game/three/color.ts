import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three';

/**
 * 色彩管理：設計稿顏色都是 sRGB。three 的 ColorManagement 開啟時，
 * 以 SRGBColorSpace 指定可確保「只轉一次」到線性空間（避免原型舊版 API 的重複轉換）。
 */
export function srgb(hex: string): Color {
  return new Color().setStyle(hex, SRGBColorSpace);
}

const cache = new Map<string, MeshStandardMaterial>();

/** 塑膠材質：低粗糙度、無金屬感。同色共用同一個材質。 */
export function plastic(hex: string): MeshStandardMaterial {
  let m = cache.get(hex);
  if (!m) {
    m = new MeshStandardMaterial({ color: srgb(hex), roughness: 0.32, metalness: 0 });
    cache.set(hex, m);
  }
  return m;
}

/** 不共用的塑膠材質（需要個別貼圖時使用）。 */
export function plasticUnique(hex: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: srgb(hex), roughness: 0.32, metalness: 0 });
}
