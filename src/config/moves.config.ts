import { H } from './game.config';

/**
 * 招式表（SPEC 第 9 節）。距離以 H（積木人站立身高）為單位。
 * 階段 2 只啟用 1、3、5（徒手）與 9（武器）；其餘於階段 4 加入。
 */
export type MoveId = 'jab' | 'uppercut' | 'slap' | 'shoe';
export type MoveKind = 'hand' | 'weapon';

export interface MeleeMove {
  id: MoveId;
  kind: MoveKind;
  type: 'melee';
  name: string;
  /** 前搖（秒） */
  windup: number;
  /** 判定段數與間隔（秒） */
  hits: number;
  interval: number;
  /** 前方距離（H） */
  range: number;
  /** 身後距離（H），0＝無 */
  backRange: number;
  /** 冷卻（秒） */
  cooldown: number;
  /** 每段分數 */
  score: number[];
  /** 對空中目標的額外分數 */
  airBonus?: number;
  /** 動畫總長（秒） */
  duration: number;
  /** 木偶離地高度超過此值（H）就打不到 */
  maxTargetLift: number;
  words: string[];
}

export interface ThrowMove {
  id: MoveId;
  kind: MoveKind;
  type: 'throw';
  name: string;
  windup: number;
  cooldown: number;
  score: number[];
  duration: number;
  /** 投射物：初速（場景單位／秒）、上拋初速、重力、旋轉 */
  speed: number;
  lift: number;
  gravity: number;
  spin: number;
  /** 出手高度 */
  releaseY: number;
  words: string[];
}

export type MoveDef = MeleeMove | ThrowMove;

export const MOVES: Record<MoveId, MoveDef> = {
  jab: {
    id: 'jab', kind: 'hand', type: 'melee', name: '連環拳',
    windup: 0.08, hits: 4, interval: 0.09, range: 0.6, backRange: 0, cooldown: 0.4,
    score: [10, 10, 10, 10], duration: 0.45, maxTargetLift: 0.9, words: ['砰！', '啪！'],
  },
  uppercut: {
    id: 'uppercut', kind: 'hand', type: 'melee', name: '上勾拳',
    windup: 0.15, hits: 1, interval: 0, range: 0.5, backRange: 0, cooldown: 1.0,
    score: [25], airBonus: 5, duration: 0.5, maxTargetLift: 1.3, words: ['咻碰！'],
  },
  slap: {
    id: 'slap', kind: 'hand', type: 'melee', name: '甩巴掌',
    windup: 0.06, hits: 1, interval: 0, range: 0.5, backRange: 0, cooldown: 0.5,
    score: [15], duration: 0.32, maxTargetLift: 0.9, words: ['啪！！'],
  },
  shoe: {
    id: 'shoe', kind: 'weapon', type: 'throw', name: '丟鞋子',
    windup: 0.1, cooldown: 0.8, score: [15], duration: 0.3,
    speed: 20, lift: 0.6, gravity: 6, spin: 14, releaseY: 3.1, words: ['咚！'],
  },
};

/** 各類型目前可用的招式（依按鈕順序，對應鍵盤 1～5）。 */
export const MOVE_SETS: Record<MoveKind, MoveId[]> = {
  hand: ['jab', 'uppercut', 'slap'],
  weapon: ['shoe'],
};

export const PLAYER = {
  halfWidth: 0.7,
  speed: 6,
  dodgeTime: 0.35,
  dodgeCooldown: 0.8,
  dodgeSpeed: 9,
  dodgeHop: 0.8,
  /** 被木偶打中：擊退速度與硬直 */
  hitPush: 8,
  hitStun: 0.4,
  /** 出招預約（秒）：前一招收招前按下的招式會在收招後立刻出 */
  inputBuffer: 0.25,
  /** 格鬥站姿：前腳往前、後腳往後（弧度） */
  stance: { front: 0.3, back: 0.25 },
  /** 甩巴掌動畫：肩高、手臂長（到掌心）、踏步上限、時間點（秒）、扭腰角度 */
  slapAnim: { shoulderY: 2.93, armLength: 1.55, maxLunge: 2.6, lungeIn: 0.05, hold: 0.16, twistBack: 0.65, twistThrough: 0.45 },
} as const;

/** 投射物碰撞：木偶受擊框額外寬度、移除範圍 */
export const PROJECTILE = {
  hitPad: 0.3,
  removeX: 14,
} as const;

export { H };
