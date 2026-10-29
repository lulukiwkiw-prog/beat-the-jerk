import { Group, Mesh, SphereGeometry, type Object3D } from 'three';
import { plastic } from '../three/color';
import { cachedRoundedBox, studGeometry } from '../three/geometry';

export const PLAYER_COLORS = {
  suit: '#24408E',
  trim: '#F4F1EA',
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
  gloveR: Mesh;
}

/** 玩家角色：深藍運動服、白色腰線、紅色拳套與頭帶，臉部不畫五官。 */
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
    box(0.62, 1.5, 0.68, 0.12, C.suit, leg, 0, -0.78);
    box(0.66, 0.26, 0.98, 0.1, C.dark, leg, 0, -1.6, 0.12);
    legs.push(leg);
  }
  const torso = new Group();
  torso.position.y = 1.75;
  body.add(torso);
  box(1.4, 1.36, 0.88, 0.16, C.suit, torso, 0, 0.68);
  box(1.42, 0.14, 0.9, 0.05, C.trim, torso, 0, 0.08);
  const head = box(1.08, 1.0, 1.0, 0.22, C.skin, torso, 0, 1.92);
  for (let i = 0; i < 2; i++) {
    const s = new Mesh(studGeometry(), plastic(C.skin));
    s.position.set((i - 0.5) * 0.42, 0.55, 0);
    s.castShadow = shadows;
    head.add(s);
  }
  box(1.12, 0.22, 1.04, 0.08, C.red, head, 0, 0.2);
  const tail = box(0.14, 0.42, 0.12, 0.05, C.red, head, 0, 0.08, -0.56);
  tail.rotation.x = 0.6;
  const arms: Group[] = [];
  const elbows: Group[] = [];
  const gloves: Mesh[] = [];
  for (const s of [-1, 1]) {
    const sh = new Group();
    sh.position.set(s * 0.92, 1.18, 0);
    torso.add(sh);
    box(0.44, 0.72, 0.44, 0.12, C.suit, sh, 0, -0.35);
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
  return { root, body, torso, legL: legs[0], legR: legs[1], shL: arms[0], shR: arms[1], elL: elbows[0], elR: elbows[1], gloveR: gloves[1] };
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
