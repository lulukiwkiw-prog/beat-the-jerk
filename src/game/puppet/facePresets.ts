/**
 * 搞笑臉部範例：以頭部正面的實際尺寸（場景單位，原點左上、y 向下）作畫。
 * 套用時直接畫進玩家的彩繪貼圖，之後可以用筆刷、橡皮擦修改或復原。
 */
export type FacePresetId = 'crossEyed' | 'smirk' | 'crying' | 'eyeRoll';

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const INK = '#1E1E1E';
const WHITE = '#FFFFFF';

function line(c: CanvasRenderingContext2D, width: number, color = INK) {
  c.lineWidth = width;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

function eyeWhite(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  dot(c, x, y, r, WHITE);
  line(c, 0.035);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

function blush(c: CanvasRenderingContext2D, w: number, y: number) {
  dot(c, 0.17, y, 0.08, 'rgba(244,143,177,.8)');
  dot(c, w - 0.17, y, 0.08, 'rgba(244,143,177,.8)');
}

const PRESETS: Record<FacePresetId, Draw> = {
  // 鬥雞眼＋暴牙
  crossEyed(c, w) {
    const ex = [w * 0.3, w * 0.7];
    for (const x of ex) eyeWhite(c, x, 0.44, 0.15);
    dot(c, ex[0] + 0.07, 0.47, 0.065, INK);
    dot(c, ex[1] - 0.07, 0.47, 0.065, INK);
    line(c, 0.045);
    c.beginPath();
    c.moveTo(w * 0.3, 0.76);
    c.quadraticCurveTo(w * 0.5, 0.86, w * 0.7, 0.76);
    c.stroke();
    // 兩顆大門牙
    for (const x of [w * 0.5 - 0.12, w * 0.5]) {
      c.fillStyle = WHITE;
      c.fillRect(x, 0.81, 0.12, 0.16);
      line(c, 0.03);
      c.strokeRect(x, 0.81, 0.12, 0.16);
    }
  },
  // 得意歪嘴笑＋挑眉
  smirk(c, w) {
    line(c, 0.055);
    c.beginPath();
    c.moveTo(0.16, 0.32);
    c.quadraticCurveTo(0.3, 0.14, 0.48, 0.26);
    c.moveTo(w - 0.46, 0.38);
    c.lineTo(w - 0.16, 0.35);
    c.stroke();
    // 半瞇的眼睛
    dot(c, 0.33, 0.47, 0.065, INK);
    dot(c, w - 0.31, 0.49, 0.065, INK);
    line(c, 0.04);
    c.beginPath();
    c.moveTo(w - 0.44, 0.45);
    c.lineTo(w - 0.18, 0.45);
    c.stroke();
    // 歪一邊的嘴
    line(c, 0.05);
    c.beginPath();
    c.moveTo(w * 0.32, 0.82);
    c.quadraticCurveTo(w * 0.6, 0.86, w * 0.78, 0.68);
    c.moveTo(w * 0.74, 0.66);
    c.lineTo(w * 0.82, 0.72);
    c.stroke();
    blush(c, w, 0.72);
  },
  // 哭哭臉＋鼻涕
  crying(c, w) {
    line(c, 0.05);
    c.beginPath();
    c.moveTo(0.16, 0.36);
    c.lineTo(0.48, 0.26);
    c.moveTo(w - 0.16, 0.36);
    c.lineTo(w - 0.48, 0.26);
    c.stroke();
    // 緊閉的眼
    for (const x of [0.33, w - 0.33]) {
      c.beginPath();
      c.arc(x, 0.5, 0.09, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
    // 兩行眼淚
    for (const x of [0.33, w - 0.33]) {
      line(c, 0.08, '#64B5F6');
      c.beginPath();
      c.moveTo(x, 0.52);
      c.quadraticCurveTo(x + (x < w / 2 ? -0.05 : 0.05), 0.8, x, 1.1);
      c.stroke();
    }
    // 張開的哭嘴
    c.beginPath();
    c.moveTo(w * 0.36, 0.92);
    c.quadraticCurveTo(w * 0.5, 0.66, w * 0.64, 0.92);
    c.closePath();
    c.fillStyle = '#5A2230';
    c.fill();
    line(c, 0.035);
    c.stroke();
    // 鼻涕
    line(c, 0.06, '#9CCC65');
    c.beginPath();
    c.moveTo(w * 0.53, 0.6);
    c.quadraticCurveTo(w * 0.56, 0.68, w * 0.54, 0.74);
    c.stroke();
    dot(c, w * 0.55, 0.77, 0.045, '#9CCC65');
    dot(c, w * 0.42, 0.6, 0.05, 'rgba(156,204,101,.55)');
  },
  // 翻白眼＋吐舌頭
  eyeRoll(c, w) {
    for (const x of [w * 0.3, w * 0.7]) {
      eyeWhite(c, x, 0.44, 0.15);
      // 眼珠翻到最上面，只露一點點
      c.save();
      c.beginPath();
      c.arc(x, 0.44, 0.13, 0, Math.PI * 2);
      c.clip();
      dot(c, x, 0.3, 0.07, INK);
      c.restore();
    }
    line(c, 0.045);
    c.beginPath();
    c.moveTo(w * 0.32, 0.76);
    c.lineTo(w * 0.68, 0.76);
    c.stroke();
    // 舌頭
    c.beginPath();
    c.moveTo(w * 0.46, 0.76);
    c.lineTo(w * 0.46, 0.9);
    c.arc(w * 0.53, 0.9, w * 0.07, Math.PI, 0, true);
    c.lineTo(w * 0.6, 0.76);
    c.closePath();
    c.fillStyle = '#F06A86';
    c.fill();
    line(c, 0.03);
    c.stroke();
    line(c, 0.02, '#B8405A');
    c.beginPath();
    c.moveTo(w * 0.53, 0.78);
    c.lineTo(w * 0.53, 0.9);
    c.stroke();
  },
};

export const FACE_PRESETS: { id: FacePresetId; label: string }[] = [
  { id: 'crossEyed', label: '鬥雞眼暴牙' },
  { id: 'smirk', label: '歪嘴挑眉' },
  { id: 'crying', label: '哭哭鼻涕' },
  { id: 'eyeRoll', label: '翻白眼吐舌' },
];

export function drawFacePreset(id: FacePresetId, c: CanvasRenderingContext2D, w: number, h: number) {
  c.save();
  PRESETS[id](c, w, h);
  c.restore();
}
