import { H } from './game.config';

/**
 * 招式表（SPEC 第 9 節）。距離以 H（積木人站立身高）為單位。
 * 十招＋使用者追加的「踩扁」（徒手第 6 招）。
 */
export type MoveId = 'jab' | 'spin' | 'uppercut' | 'flykick' | 'slap' | 'stomp' | 'club' | 'bucket' | 'chair' | 'shoe' | 'hammer';
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

/** 突進招式（飛踢）：前搖後在 dashTime 內往前衝 dashDist，途中逐幀判定。 */
export interface DashMove {
  id: MoveId;
  kind: MoveKind;
  type: 'dash';
  name: string;
  windup: number;
  dashTime: number;
  /** 突進距離（H） */
  dashDist: number;
  /** 接觸距離（H）：玩家前緣到木偶邊緣 */
  range: number;
  cooldown: number;
  score: number[];
  duration: number;
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
  /** 碰撞框額外寬度（大型投射物較大） */
  pad: number;
  /**
   * 拋物線：瞄準木偶頭部，水平距離限制在 minReach～maxReach（H）之間，
   * 飛行時間 flightTime 秒（speed、lift 不使用）。
   */
  arc?: { flightTime: number; minReach: number; maxReach: number; aimY: number };
  words: string[];
}

export type MoveDef = MeleeMove | DashMove | ThrowMove;

export const MOVES: Record<MoveId, MoveDef> = {
  jab: {
    id: 'jab', kind: 'hand', type: 'melee', name: '連環拳',
    windup: 0.08, hits: 4, interval: 0.09, range: 0.6, backRange: 0, cooldown: 0.4,
    score: [10, 10, 10, 10], duration: 0.45, maxTargetLift: 0.9, words: ['砰！', '啪！'],
  },
  spin: {
    id: 'spin', kind: 'hand', type: 'melee', name: '迴旋踢',
    windup: 0.2, hits: 1, interval: 0, range: 1.0, backRange: 0.3, cooldown: 1.2,
    score: [30], duration: 0.55, maxTargetLift: 0.9, words: ['咻～碰！'],
  },
  uppercut: {
    id: 'uppercut', kind: 'hand', type: 'melee', name: '上勾拳',
    windup: 0.15, hits: 1, interval: 0, range: 0.5, backRange: 0, cooldown: 1.0,
    score: [25], airBonus: 5, duration: 0.5, maxTargetLift: 1.3, words: ['咻碰！'],
  },
  flykick: {
    id: 'flykick', kind: 'hand', type: 'dash', name: '飛踢',
    windup: 0.18, dashTime: 0.25, dashDist: 2, range: 0.12, cooldown: 1.5,
    score: [30], duration: 0.72, maxTargetLift: 1.2, words: ['喝啊！'],
  },
  slap: {
    id: 'slap', kind: 'hand', type: 'melee', name: '甩巴掌',
    windup: 0.06, hits: 1, interval: 0, range: 0.5, backRange: 0, cooldown: 0.5,
    score: [15], duration: 0.32, maxTargetLift: 0.9, words: ['啪！！'],
  },
  stomp: {
    id: 'stomp', kind: 'hand', type: 'melee', name: '踩扁',
    windup: 0.35, hits: 1, interval: 0, range: 0.8, backRange: 0, cooldown: 3,
    score: [40], duration: 0.75, maxTargetLift: 0.3, words: ['扁！'],
  },
  club: {
    id: 'club', kind: 'weapon', type: 'melee', name: '棍棒連打',
    windup: 0.15, hits: 3, interval: 0.18, range: 0.8, backRange: 0, cooldown: 1.4,
    score: [15, 15, 25], duration: 0.72, maxTargetLift: 0.9, words: ['叩！', '叩！', '咚——！'],
  },
  // 規格距離 3～5H、2～4H 大於擂台寬度（約 2.75H），改為瞄準木偶、距離限制在擂台內可及的範圍
  bucket: {
    id: 'bucket', kind: 'weapon', type: 'throw', name: '丟水桶',
    windup: 0.25, cooldown: 2.5, score: [35], duration: 0.45,
    speed: 0, lift: 0, gravity: 26, spin: 7, releaseY: 3.4, pad: 0.35,
    arc: { flightTime: 0.75, minReach: 0.6, maxReach: 3, aimY: 3.9 }, words: ['噗通！'],
  },
  chair: {
    id: 'chair', kind: 'weapon', type: 'throw', name: '丟桌椅',
    windup: 0.4, cooldown: 6, score: [50], duration: 0.65,
    speed: 0, lift: 0, gravity: 26, spin: 5, releaseY: 4.2, pad: 0.7,
    arc: { flightTime: 0.68, minReach: 0.5, maxReach: 2.6, aimY: 2.9 }, words: ['轟隆！'],
  },
  shoe: {
    id: 'shoe', kind: 'weapon', type: 'throw', name: '丟鞋子',
    windup: 0.1, cooldown: 0.8, score: [15], duration: 0.3,
    speed: 20, lift: 0.6, gravity: 6, spin: 14, releaseY: 3.1, pad: 0, words: ['咚！'],
  },
  hammer: {
    id: 'hammer', kind: 'weapon', type: 'melee', name: '鐵錘敲頭',
    windup: 0.6, hits: 1, interval: 0, range: 0.6, backRange: 0, cooldown: 4,
    score: [60], duration: 0.95, maxTargetLift: 0.6, words: ['鏘————！'],
  },
};

/** 各類型的招式（依按鈕順序，對應鍵盤 1～6）。 */
export const MOVE_SETS: Record<MoveKind, MoveId[]> = {
  hand: ['jab', 'spin', 'uppercut', 'flykick', 'slap', 'stomp'],
  weapon: ['club', 'bucket', 'chair', 'shoe', 'hammer'],
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
  /** 踩扁動畫：最高點、站在扁木偶上的高度、時間點（秒） */
  stompAnim: { peak: 3.2, standY: 1.5, rise: 0.25, hold: 0.55, land: 0.72, overshoot: 0.45 },
  /** 迴旋踢：轉一圈的起訖時間（秒）、踢腿抬起角度 */
  spinAnim: { start: 0.08, end: 0.42, legLift: 1.45 },
  /** 飛踢：騰空高度 */
  flykickAnim: { hop: 1.1 },
  /** 鐵錘：蓄力時鐵錘放大到的倍數與抖動幅度 */
  hammerAnim: { grow: 1.45, shake: 0.08 },
  slapAnim: { shoulderY: 2.93, armLength: 1.55, maxLunge: 2.6, lungeIn: 0.05, hold: 0.16, twistBack: 0.65, twistThrough: 0.45 },
} as const;

/** 投射物碰撞：木偶受擊框額外寬度、移除範圍；桌椅碎成的泡棉塊 */
export const PROJECTILE = {
  H,
  hitPad: 0.3,
  removeX: 14,
  foam: { count: 12, life: 1.5, speed: 4, up: 4, gravity: 18 },
} as const;

export { H };
