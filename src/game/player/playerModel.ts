import { CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, type Object3D } from 'three';
import { plastic } from '../three/color';
import { srgb } from '../three/color';
import { cachedRoundedBox } from '../three/geometry';

/** 玩家球形頭半徑（原 0.62 的 1.5 倍） */
export const PLAYER_HEAD_RADIUS = 0.93;

export const PLAYER_COLORS = {
  /** 上半身米白、下半身馬卡龍藍 */
  top: '#F4F0E6',
  bottom: '#A9CBEA',
  trim: '#8DB4DD',
  skin: '#F2D29B',
  red: '#D8322A',
  dark: '#1D2740',
} as const;

export interface PlayerRig {
  root: Group;
  body: Group;
  torso: Group;
  legL: Group;
  legR: Group;
  shL: Group;
  shR: Group;
  elL: Group;
  elR: Group;
  gloveL: Mesh;
  gloveR: Mesh;
}

let faceMat: MeshStandardMaterial | null = null;
/** 正義臉 (・`_´・)：畫在球面貼圖的正面（u＝0.25 是 +Z） */
function justiceFaceMaterial(): MeshStandardMaterial {
  if (faceMat) return faceMat;
  const skin = PLAYER_COLORS.skin;
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext('2d');
  if (!c) return (faceMat = new MeshStandardMaterial({ color: srgb(skin), roughness: 0.32, metalness: 0 }));
  c.fillStyle = skin;
  c.fillRect(0, 0, 512, 256);
  const cx = 128;
  c.strokeStyle = '#1E1E1E';
  c.fillStyle = '#1E1E1E';
  c.lineCap = 'round';
  // 往中間壓低的濃眉 ` ´
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(cx - 44, 106);
  c.lineTo(cx - 14, 118);
  c.moveTo(cx + 44, 106);
  c.lineTo(cx + 14, 118);
  c.stroke();
  // 黑豆眼 ・ ・
  for (const dx of [-28, 28]) {
    c.beginPath();
    c.arc(cx + dx, 132, 7, 0, Math.PI * 2);
    c.fill();
  }
  // 緊閉的一字嘴 _
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(cx - 12, 160);
  c.lineTo(cx + 12, 160);
  c.stroke();
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return (faceMat = new MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0 }));
}

/** 玩家角色：上半身米白、下半身馬卡龍藍、紅色拳套；球形大頭、正義臉。 */
export function buildPlayer(shadows = true): PlayerRig {
  const C = PLAYER_COLORS;
  const root = new Group();
  root.name = 'player';
  const body = new Group();
  root.add(body);
  const box = (w: number, h: number, d: number, r: number, color: string, parent: Object3D, x: number, y: number, z = 0) => {
    const m = new Mesh(cachedRoundedBox(w, h, d, r), plastic(color));
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    parent.add(m);
    return m;
  };
  const legs: Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new Group();
    leg.position.set(s * 0.34, 1.75, 0);
    body.add(leg);
    box(0.62, 1.5, 0.68, 0.12, C.bottom, leg, 0, -0.78);
    box(0.66, 0.26, 0.98, 0.1, C.dark, leg, 0, -1.6, 0.12);
    legs.push(leg);
  }
  const torso = new Group();
  torso.position.y = 1.75;
  body.add(torso);
  box(1.4, 1.36, 0.88, 0.16, C.top, torso, 0, 0.68);
  box(1.42, 0.14, 0.9, 0.05, C.trim, torso, 0, 0.08);
  // 球形大頭＋正義臉 (・`_´・)
  const neck = new Mesh(new CylinderGeometry(0.26, 0.28, 0.2, 18), plastic(C.skin));
  neck.position.y = 1.44;
  torso.add(neck);
  const R = PLAYER_HEAD_RADIUS;
  const head = new Mesh(new SphereGeometry(R, 40, 28), justiceFaceMaterial());
  head.position.set(0, 1.36 + R, 0);
  head.castShadow = shadows;
  torso.add(head);
  const arms: Group[] = [];
  const elbows: Group[] = [];
  const gloves: Mesh[] = [];
  for (const s of [-1, 1]) {
    const sh = new Group();
    sh.position.set(s * 0.92, 1.18, 0);
    torso.add(sh);
    box(0.44, 0.72, 0.44, 0.12, C.top, sh, 0, -0.35);
    const el = new Group();
    el.position.y = -0.7;
    sh.add(el);
    box(0.4, 0.56, 0.4, 0.12, C.skin, el, 0, -0.27);
    const glove = new Mesh(new SphereGeometry(0.4, 24, 16), plastic(C.red));
    glove.scale.set(1, 1.05, 1.1);
    glove.position.y = -0.74;
    glove.castShadow = shadows;
    el.add(glove);
    gloves.push(glove);
    arms.push(sh);
    elbows.push(el);
  }
  return { root, body, torso, legL: legs[0], legR: legs[1], shL: arms[0], shR: arms[1], elL: elbows[0], elR: elbows[1], gloveL: gloves[0], gloveR: gloves[1] };
}

/** 待機拳架（階段 1 只有待機）。 */
export function posePlayerIdle(rig: PlayerRig, t: number, facing: 1 | -1) {
  rig.body.rotation.y = facing > 0 ? 0.85 : -0.85;
  const bob = Math.sin(t * 5) * 0.06;
  rig.shL.rotation.set(-0.5 + bob, 0, 0);
  rig.shR.rotation.set(-0.35 - bob, 0, 0);
  rig.elL.rotation.x = -1.9;
  rig.elR.rotation.x = -1.7;
  rig.root.position.y = Math.abs(Math.sin(t * 2.5)) * 0.04;
}
