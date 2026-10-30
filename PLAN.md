# 開發計畫（指令 1 產出）

> 規格以 SPEC.md 為準。本文件只記錄架構與設計決策；與 SPEC.md 衝突時以 SPEC.md 為準。

---

## 1. 專案結構與模組職責

技術：Vite＋React 18＋TypeScript（strict）、three（鎖定 `0.186.1`）、Vitest、Playwright（鎖定 `@playwright/test@1.63.0`，與環境內建 Chromium 相符）、ESLint（flat config＋typescript-eslint）。

```
src/
  main.tsx, App.tsx          進入點；App 依狀態機切換畫面，掛設定面板
  state/
    machine.ts               狀態機：input → paint → prep → battle(⇄paused) → apology → ending → (input|prep)
    session.ts               本次資料（稱謂、A～D、氣憤值）只存記憶體
    store.ts                 輕量 store（useSyncExternalStore），不引入 Redux
  screens/
    WantedScreen.tsx         步驟 0 通緝單
    PaintScreen.tsx          步驟 1 彩繪室（React 工具列＋3D 畫布）
    ArenaPreviewScreen.tsx   階段 1 專用：擂台預覽（待機、受擊、噴飛測試）→ 階段 2 由 BattleScreen 取代
    （BattleScreen / ApologyScreen / EndingScreen 於後續階段）
  ui/                        共用元件：Button、CharCountField、ConfirmInline、SettingsPanel、NoWebGL
  game/
    engine/
      loop.ts                單一 rAF；固定步長 1/60；累加器上限防止螺旋；背景時停止
      clock.ts               performance.now() 累計實際時間；pause/resume；visibilitychange
      input.ts               Pointer Events（pointerId 多指）＋鍵盤；輸入框聚焦時忽略
    three/
      renderer.ts            **全站共用單一 WebGLRenderer**（換畫面時搬移 canvas），避免 iOS context 上限；WebGL 偵測
      color.ts               sRGB 色彩工具（見風險 R1）
      lights.ts              半球光＋主平行光（陰影）＋淡藍補光；暖光轉場參數
      camera.ts              側面透視鏡頭；跟隨中點、依距離縮放、晃動
      geometry.ts            圓角方塊、3×2 圖集 UV 重映射、凸點；幾何體快取共用
      arena.ts               擂台展示台（InstancedMesh 凸點與方磚）
      paintRoom.ts           彩繪室場景（灰底座、轉向）
      quality.ts             自動畫質：連續 3 秒 <45 FPS → 關陰影 → PR 1.5 → PR 1（只降不升）
      project.ts             3D → 螢幕座標投影（給 HTML 疊層）
      disposal.ts            釋放幾何體／材質／貼圖
    puppet/
      parts.ts               部位定義（尺寸、父關節、可否彩繪）
      skeleton.ts            建構骨架 Group 樹
      paintSurface.ts        每部位離屏畫布＋CanvasTexture；面座標換算；筆畫；橡皮擦
      paintHistory.ts        復原／重做（≥30 步）
      paintPicker.ts         Raycaster → UV → 判斷面
      pose.ts                彈簧姿勢層＋四肢延遲
      reactions.ts           受擊反應（壓扁、甩頭、扭轉、浮空、旋轉、撞牆）
      scatter.ts             噴飛再組回
      decals.ts              掌印、鞋印貼片（不寫入彩繪貼圖）
      Puppet.ts              組合以上，對外 API
    player/ moves/ projectiles/ effects/ enemy/ dialogue/   （依階段逐步加入）
  audio/                     （階段 6；之前只留介面與靜音預設）
  storage/safeStorage.ts     localStorage try/catch 包裝
  config/
    game.config.ts           計時、回合長度、場地邊界、物理常數
    puppet.config.ts         彈簧係數、噴飛 1.15/0.65 秒、反彈係數
    paint.config.ts          16 色、筆刷、格子解析度、復原步數
    quality.config.ts        FPS 門檻與降級順序
    moves.config.ts          招式表（階段 2 起）
tests/unit/  tests/e2e/
screenshots/stage-N/
```

與規格建議結構的差異：多了 `ui/`（共用介面元件）、`three/renderer.ts` 改為全站共用單一 renderer。

---

## 2. 資料模型

### 2.1 積木人骨架

```
root (x, lift)                    // 世界位置：沿 X 移動、浮空高度
 └ spinPivot (y = H/2)            // 繞身體中心旋轉（上勾拳空翻、迴旋踢轉圈）
    └ offset (y = -H/2)
       └ squash (scale sx, sy, sx) // 壓縮／拉長／手風琴
          └ pelvis
             ├ torsoJ ─ torso*
             │   ├ neckJ ─ head*（頭頂 2 凸點）
             │   ├ shoulderL ─ upperArmL* ─ elbowL ─ foreArmL* ─ handL（含拇指）
             │   └ shoulderR …（對稱）
             ├ hipL ─ thighL* ─ kneeL ─ shinL* ─ shoeL
             └ hipR …（對稱）
（* = 可彩繪部位，共 10 個；手與鞋固定色）
```

```ts
type PaintPartId = 'head'|'torso'|'upperArmL'|'upperArmR'|'foreArmL'|'foreArmR'|'thighL'|'thighR'|'shinL'|'shinR';
type FixedPartId = 'handL'|'handR'|'shoeL'|'shoeR';
type JointId = 'torso'|'neck'|'shoulderL'|'elbowL'|'shoulderR'|'elbowR'|'hipL'|'kneeL'|'hipR'|'kneeR';

interface SpringValue { value: number; velocity: number; target: number }
interface PuppetState {
  x: number; vx: number; lift: number; vy: number; airborne: boolean;
  spin: SpringValue; squashX: SpringValue; squashY: SpringValue;
  joints: Record<JointId, { x: SpringValue; y: SpringValue; z: SpringValue }>;
  limbDelay: RingBuffer<TorsoSample>;   // 四肢目標取 90ms 前的軀幹姿勢 → 60–120ms 延遲擺動
  scatter: ScatterState | null;
  decals: Decal[];
}
```
姿勢＝「待機層＋動作關鍵影格層＋受擊衝量（直接加到 velocity）」，最後統一用彈簧逼近目標。H＝4.8 寫在 config。

### 2.2 每面彩繪貼圖（3×2 格）

```ts
enum Face { PX=0, NX=1, PY=2, NY=3, PZ=4, NZ=5 }   // 與 BoxGeometry 面群組順序一致
interface PaintSurface {
  part: PaintPartId;
  size: [w, h, d];                     // 場景單位
  canvas: HTMLCanvasElement;           // 寬 3*CELL+gutter、高 2*CELL+gutter
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;        // colorSpace = SRGBColorSpace
  dirty: boolean;                      // 只有被畫到的部位在下一幀 needsUpdate
}
```
- 格位：`col = f % 3, row = floor(f / 3)`；每格四周留 **gutter（4px）**，UV 往內縮，避免 mipmap 與線性取樣把隔壁面的顏色滲過來。
- 面實際尺寸：±X → (d, h)、±Y → (w, d)、±Z → (w, h)。筆畫座標以「該面的實際尺寸（場景單位）」換算，`ctx.scale(CELL/fw, CELL/fh)` 後以同一個場景單位寬度畫線，窄面寬面粗細一致。
- 判斷面：Raycaster 取 `hit.uv` → 依 u、v 落在哪一格得到 Face（**不用** `materialIndex`）。
- 一筆的狀態：`{ pointerId, part, face, last: Point|null }`；滑到別的面／部位時 `last=null`（暫停），回到原面再接續。
- 橡皮擦＝用預設底色 `#E7E1D2` 畫，不會擦出透明洞。
- CELL 解析度：256（部位放大彩繪時仍清楚）。
- 共用：`PaintStore` 是全域單例，持有 10 張 PaintSurface；彩繪室與擂台的積木人 mesh 引用**同一個 texture 物件**，所以戰鬥中顯示玩家畫的內容；所有變形（移動、旋轉、壓扁、噴飛）都是 mesh 變換，彩繪自然跟著走。
- 復原／重做：因為規格保證「一筆只會留在一個部位的一面」，每步只存「那一格」的 ImageData 補丁（256² × 4 ≈ 256KB），30 步 ≈ 8MB。清空彩繪只存「有被畫過的格子」，算 1 步。

### 2.3 噴飛再組回

```ts
interface ScatterItem {
  mesh: THREE.Object3D;            // 10 個彩繪部位＋手＋鞋（貼片是子物件，自動跟著飛）
  homeParent: THREE.Object3D;
  homePos: Vector3; homeQuat: Quaternion; homeScale: Vector3;   // 骨架內的本地變換
  vel: Vector3; angVel: Vector3;
  returnFromPos?: Vector3; returnFromQuat?: Quaternion;         // 進入組回時記錄
}
interface ScatterState { phase: 'fly'|'return'; t: number; items: ScatterItem[] }
```
- `scatter(strength)`：`scene.attach(mesh)` 保留世界變換脫離骨架；隨機速度（由身體中心往外＋向上）、隨機角速度；減少動態效果時速度 ×0.5。
- `fly`（1.15 秒）：自寫拋物線，碰地反彈（係數 0.42、水平摩擦 0.6），Z 夾在擂台範圍內。
- `return`（0.65 秒）：每幀以 `homeParent.matrixWorld × home` 算出目標世界變換（骨架仍在動，所以要每幀重算），ease-in-out 位置 lerp／旋轉 slerp。
- 結束：`homeParent.attach(mesh)` 並還原本地變換，然後給一個壓扁回彈。
- `forceReassemble()`：立即歸位（回合結束、暫停、重新開始、離開戰鬥時呼叫）。
- `isScattered` 期間：木偶不可被命中、不出拳。

---

## 3. 命中判定與 hitId 防重複計分

```ts
type HitId = string;   // `${roundId}:${attackSeq}:${segment}`，例：'r3:17:2'
interface AttackInstance { attackSeq: number; moveId: MoveId; startedAt: number; facing: 1|-1 }
interface HitEvent { hitId: HitId; moveId: MoveId; segment: number; at: number; airborneTarget: boolean }
```
- 每次出招產生遞增 `attackSeq`；每一段判定（連環拳 4 段＝4 個 segment）或每一個投射物各有唯一 hitId。
- **ScoreLedger**（純函式、無 three 依賴，可單元測試）：
  - `resolve(event, state) → { scored: boolean; points: ScoreLine[] }`
  - 內含 `Set<HitId>`，已結算過的 hitId 直接回傳 `scored:false`。
  - 連擊：與上次命中間隔 ≤2 秒延續，否則重設為 1；每 10 連擊 +50。
  - 招式組合：3 秒內命中 3 種不同招式 +40（觸發後清空視窗，避免同一組重複給分）。
  - 每回合開始 new 一個 Ledger（再打一場不殘留）。
- 判定時機：
  - 近戰：在該段的「判定時間點」做**一次**範圍檢查（玩家前緣到木偶後緣的距離 ≤ range×H，迴旋踢另含身後 0.3H）。
  - 飛踢（階段 4）：突進期間逐幀檢查，同一 hitId 只結算一次——這就是 Ledger 去重的主要用途。
  - 投射物：逐幀以 AABB（X/Y 平面）碰撞木偶受擊框；命中即移除投射物；飛出畫面或落地移除。
- 落空：判定時不在範圍內、木偶噴飛中／組回中 → 顯示「揮空」，不進 Ledger、不得分、不計連擊。
- 回合結束旗標 `endFired` 防重入；判定只在 `battle` 狀態且未暫停時執行。

---

## 4. 階段 1 工作清單

1. **專案骨架**：Vite＋React＋TS、three 鎖版、ESLint（含禁用 `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`console` 的規則）、Vitest、Playwright（swiftshader）、`base: './'`、npm scripts（dev/build/typecheck/lint/test/e2e/screenshots）、git init。
2. **狀態機與 store**：完整狀態定義；階段 1 可走 `input → paint → 擂台預覽`，並可回上一步保留資料。
3. **步驟 0 通緝單**：稱謂切換與全站替換、A 必填（300 字）、B 3～8 欄（80 字、「戰鬥中出現」勾選）、C 8 個預設＋自訂最多 5 個（10 字）、D 1～5 欄、氣憤值 0～10＋略過、字數計數（以字素計，表情符號算 1 字）、貼上超出時提示且不默默截斷、A 未填時按鈕停用並說明、隱私提示。
4. **3D 基礎**：共用 renderer、sRGB 色彩管理、燈光、WebGL 不支援提示。
5. **圓角積木幾何**：圓角方塊、3×2 圖集 UV（含 gutter）、凸點、幾何快取。
6. **擂台場景**：依第 4 節完整建置（底座、方磚、中央標記、外框積木、角柱、三色繩前方不設、燈桿、小道具），凸點與方磚用 InstancedMesh。
7. **積木人**：骨架、10 個可彩繪部位＋手（含拇指）＋鞋、彈簧姿勢、四肢延遲、待機動畫。
8. **彩繪室**：16 色、細／中／粗、橡皮擦、復原／重做 30 步、清空（確認）、轉向 ±45° 平滑、點選部位放大彩繪＋返回全身、彩繪區 `touch-action:none`、完成動畫（得意晃動＋冒出一則已啟用 B；沒有 B 時做滑稽表情，例如吐舌、挑眉）。
9. **受擊反應與噴飛**：壓扁回彈、甩頭、扭轉、浮空旋轉、撞牆回彈、落地；噴飛再組回；甩巴掌掌印、鞋印貼片。
10. **擂台預覽（階段 1 暫用畫面）**：顯示玩家彩繪的積木人在擂台上待機；按鈕「被打一拳」「甩巴掌」「打上天」（落地重摔觸發噴飛）「噴飛再組回」「鞋印」；可回彩繪室。按鈕都有作用。
11. **自動畫質**＋設定面板（只放已有作用的項目：畫質、螢幕晃動、閃光強度、減少動態效果偵測）。
12. **測試**：單元（字數上限與貼上、UV→面判斷、面座標換算、復原步數上限、噴飛時間軸與 forceReassemble 歸位、狀態機轉換）、E2E（填表→彩繪→預覽、`<script>`／表情符號／300 字長文、主控台無錯誤、三尺寸截圖）。
13. commit「階段 1：…」，依第 20 節回報，停止。

---

## 5. 規格中矛盾、不清楚或技術風險

### 技術風險
- **R1 色彩管理與原型版本差異（高）**：原型用 three r128（`outputEncoding`、`convertSRGBToLinear`）。新版 three 預設開啟 ColorManagement，`new Color('#hex')` 已自動把 sRGB 轉線性；若照原型再呼叫 `convertSRGBToLinear` 會轉兩次，畫面變暗變髒。做法：`renderer.outputColorSpace = SRGBColorSpace`、彩繪貼圖 `texture.colorSpace = SRGBColorSpace`、顏色只轉一次（集中在 `three/color.ts`），並有單元測試驗證。另外新版燈光強度單位不同（物理正確光照），燈光數值需重新調整。
- **R2 上勾拳浮空 1.5H 與鏡頭**：1.5H＝7.2 單位，加上身高最高點約 12 單位；原型實際只飛約 0.9H。為了「任何時候兩人都完整在畫面內」，鏡頭距離要同時考慮垂直範圍（木偶浮空時退遠）。這會讓上勾拳瞬間角色變小。
- **R3 對話泡泡在手機直向**：390px 寬時，木偶頭部側邊可用空間常常小於「畫面寬 70%」，又不能蓋住身體、不能放頭頂。做法：泡泡最大寬度＝min(畫面 70%, 側邊可用寬度)，不夠時換另一側，仍不夠則縮小字級並增加行數（需要你確認，見下方問題）。
- **R4 手機橫向 844×390**：寬 >700 會套用 16:10，畫布高度會超過 390。做法：橫向時畫布以「高度填滿」為準、按鈕疊在兩側（規格第 10 節已有此要求），比例改為由可用空間決定。
- **R5 彩繪貼圖邊緣滲色**：圓角方塊的圓邊會取到格子邊緣，mipmap 會把相鄰格顏色混進來。以 gutter＋UV 內縮解決。
- **R6 復原記憶體**：若每步存整個部位或全部部位，30 步清空可能吃掉數百 MB。改用「只存被畫的那一格」的補丁。
- **R7 E2E 軟體 WebGL**：swiftshader 很慢，自動畫質一定會降級；截圖會是省電畫質。E2E 以 DOM 狀態與 `window.__test` 鉤子（僅開發／測試建置）驗證，不依賴 FPS。
- **R8 iOS WebGL context 上限**：彩繪室與擂台若各開一個 renderer，來回切換可能造成 context lost。改用全站單一 renderer。

### 規格不清楚或矛盾
- **Q1**「戰鬥中出現」勾選的作用範圍：第 12 節開場挑釁說「依序說出所有啟用的 B」——我解讀「啟用」＝勾選「戰鬥中出現」；第 14 節道歉稿也用同一勾選（全部取消時列出全部）。
- **Q2** 連擊 10 倍數時「木偶在地面上」才噴飛——在空中時我做法是「不噴飛，但 +50 照給」。
- **Q3** 階段 1 的「戰鬥場景」：狀態機的 `prep → battle` 要到階段 2 才有內容，階段 1 先以「擂台預覽」畫面取代（見下方問題）。
- **Q4** 設定「任何畫面皆可開啟」但大多數項目要到階段 6 才有作用；依「不得有無作用的按鈕」，每階段只顯示已有作用的項目。
- **Q5** 招式距離 0.6H 的量法：規格未說是中心到中心還是邊緣到邊緣。我採原型做法：玩家前緣到木偶最近邊緣。
- **Q6** 字數計算：以「字素」計（表情符號、組合字算 1 字），用 `Intl.Segmenter`。
- **Q7** 第 15 節要求結局 1、2、5 有「合唱音效」「柔和長音」，但音效在階段 6；階段 3 的結局動畫先做無音效版。
- **Q8** 字型：原型載入 Google Fonts，規格要求系統字型，正式版改用系統字型（`PingFang TC`、`Noto Sans TC`、`Microsoft JhengHei`）。
- **Q9** 版本保存：這是雲端暫存容器，只 commit 在本機的話容器回收後會遺失，需要一個 GitHub repo 來 push（見下方問題）。

---

## 6. 已確認的決策（使用者回覆）
- 階段 1 擂台：「擂台預覽」畫面＋測試按鈕（每顆都有作用），階段 2 換成正式戰鬥。
- 對話泡泡空間不足：寬度縮到側邊可用寬度並自動換行；仍放不下才縮小字級；絕不蓋住身體、不放頭頂。
- 版本保存：每階段 commit 後推到 https://github.com/lulukiwkiw-prog/beat-the-jerk。
- 彩繪室加入 4 款搞笑臉部範例（鬥雞眼暴牙、歪嘴挑眉、哭哭鼻涕、翻白眼吐舌）：直接疊畫進頭部正面的彩繪貼圖，可再用筆刷修改、可復原（使用者在階段 1 後追加，SPEC 未規定）。

### 階段 2 決策
- 招式數值放在 `src/config/moves.config.ts`（規格目錄建議放 `game/moves/`，為了「可調數值集中在 config」改放 config）。
- 出招預約 0.25 秒：前一招收招前按下的招式會在收招後立刻出，避免按鍵被吃掉。
- 階段 2 的「道歉」位置先放「回合結束」畫面（分數、最高連擊、再打一場、回開戰準備），階段 3 換成道歉與結尾。
- 「賤話：開／關」與「打夠了，聽他說」要到階段 3 才有作用，依規則先不顯示。
- 暫停選單提供「繼續」「重新開始」。
- 操作教學「第一次自動顯示」用 localStorage 記一個旗標（不含任何玩家內容）。
- 手機橫向：戰鬥區在中間，按鈕放在兩側欄（不疊在畫面上，避免遮住角色）。
- 收尾時間（簡單版）：最後 30 秒顯示提示，燈光、背景逐漸轉暖，特效強度降到 45%。
- 範例擴充（臉部 10、髮型 7、服裝 6）：彩繪疊畫＋3D 凸出配件（每類最多一個，套用同類會替換），配件掛在部位底下會跟著噴飛；套用與拿掉配件都可復原。「川普頭」改為不指名的「金色蓬蓬旁分」（規格要求虛構對手）。尖叫雞只取通用特徵，不照描市售貼圖。
- 修正：圓角方塊的 UV 改為依實際位置線性分配（原本外側約 60% 的貼圖落在圓角上，靠邊作畫會被壓扁）。
- 人偶比例調整（使用者參考圖）：頭變大、加短脖子（顏色取頭底部）、腿變短粗，總高仍 4.8；不加新部位。頭改為圓角圓柱：側面依方向分成正面／右／背面／左四格，頂、底各一格，沿用 3×2 圖集，每格寬度為四分之一圓周弧長。為了維持原創造型（SPEC 第 4 節），保留頭頂兩顆並排凸點、圓角方塊身體、連指手套手，不採用梯形身體與 C 型手。
- 非人生物強化：尖叫雞（圓頂、凸眼、喇叭嘴、翅膀、雞爪）、豬（大豬鼻、耳朵、豬蹄）、恐龍（長嘴與牙、背刺、往側後方甩的尾巴、爪子）、雞／豬／恐龍裝都有立體肚子。
- 立體肚子可彩繪：肚子的 UV 投影到軀幹正面那一格，在肚子上畫＝畫在軀幹正面。
- 對戰站姿：擂台上木偶轉身面向玩家（約 49°），玩家與木偶都是前後腳；彩繪室維持正面站直。
- 玩家積木人：球形頭＋正義臉 (・`_´・)（使用者要求，取代 SPEC 第 4 節「臉部不畫五官」）。
- 一鍵隨機造型：先恢復空白，再隨機套臉、髮型、服裝各一款，算 1 步可復原。
- 復原紀錄：整面同一色的格子只記顏色，避免套服裝時每步吃掉十幾 MB。
- 甩巴掌動畫：出手時往前踏步補足距離（上限 2.6）、身體轉正面對木偶、用靠鏡頭側的手伸直張掌，扭腰在判定瞬間把手掌甩過木偶臉的高度。
- 玩家積木人：拿掉紅頭帶；球形頭半徑放大 1.5 倍（0.93）；上半身米白、下半身馬卡龍藍、腰線淺藍。

### 階段 3 決策
- 決鬥、暫停、道歉、結尾共用同一個擂台場景（BattleScreen 不重新掛載）；道歉與結尾時擂台放大成全畫面，文字是 HTML 疊層。
- 開場挑釁可按「跳過挑釁」（規格未規定，避免 B 很多時等太久）。
- 打碎過的 B 從戰鬥中賤話的候選移除（「每則 B 只能被打碎一次」）。
- 道歉稿播完後按「繼續」才進「值得聽到」；「值得聽到」至少 3 秒後點一下繼續。
- 結局 1、2、5 動畫各約 8 秒；合唱與柔和長音等音效在階段 6。
- 結局 1、2、5 走完降溫段、小小的下一步、氣憤值後，顯示「謝謝你來打這一場」與「回到開始」（走結局 4 的流程：詢問是否沿用外觀）。規格未規定這一步。
- 結局 3、4 在離開前顯示氣憤值（可略過）。
- 休息提示「先休息」→ 播放結局 5 的平靜畫面。
- 部署：`.github/workflows/deploy.yml`（GitHub Actions 建置後部署到 Pages），需到 repo 的 Settings → Pages 把 Source 設為 GitHub Actions。
- 晴天娃娃：圓球頭＋短圓錐波浪邊布（剛好蓋住肩膀上緣，布面在軀幹外側）。
- 新招「踩扁」（徒手第 4 招，鍵盤 4）：前搖 0.35 秒跳起、往前跳到木偶上方落下，40 分、冷卻 3 秒、距離 0.8H，木偶壓成一片 0.6 秒後彈回；鏡頭把跳躍高度算進去。使用者在階段 3 後追加（原十招表沒有這招）。
- 髮型追加：米粉頭（滿頭立體小捲）、爆炸頭（大團蓬蓬捲髮）。
- 通緝單 B：依使用者要求拿掉每句的「戰鬥中出現」勾選與刪除鈕（變更 SPEC 第 6 節）；所有填寫的 B 都視為啟用，不要的句子清空即可（空白欄位忽略）。資料欄位 inBattle 保留且預設為 true。

### 階段 4 決策
- 招式按鈕：徒手 6 招（連環拳、迴旋踢、上勾拳、飛踢、甩巴掌、踩扁，鍵盤 1～6）；武器 5 招（棍棒連打、丟水桶、丟桌椅、丟鞋子、鐵錘敲頭，鍵盤 1～5）。踩扁是徒手第 6 鍵（使用者選擇）；SPEC 第 10 節「5 個招式鍵／1～5」因此變為徒手 6 鍵。手機直向 3×2 排列，橫向側欄 2 欄。
- 「每招前搖都不同」與招式表衝突（上勾拳、棍棒連打的前搖都是 0.15 秒）：以招式表為準，兩招的冷卻、距離、段數、動畫不同。
- 丟水桶 3～5H、丟桌椅 2～4H 大於擂台寬度（約 2.75H）：改為瞄準木偶頭部／身體的拋物線，水平距離限制在 0.6～3H、0.5～2.6H，仍以實際碰撞判定。
- 飛踢：突進期間逐幀判定，整段同一 hitId，帳本只結算一次；撞到後停止突進，停在木偶前方。
- 擊退距離以地面摩擦換算初速（迴旋踢 1H、飛踢 2H），撞牆回彈沿用場地邊界；被彈回的木偶碰到玩家會停下，不穿過玩家。
- 水桶套頭：桶子掛在頭部底下（跟著頭動、會跟著噴飛），暈眩 1.5 秒期間木偶不出拳。
- 桌椅：命中或落地都碎成泡棉塊，1.5 秒後縮小消失；泡棉塊算在場上殘留物件內，回合結束、重新開始時一併清除。
- 鐵錘：蓄力 0.6 秒的提示為「蓄力…」字樣＋雙手高舉發抖＋錘頭逐漸變大；命中後壓成手風琴 0.5 秒，彈回時噴飛再組回（SPEC 第 9 節噴飛條件）。
- 木偶暈眩、手風琴、壓扁中都不出拳；回合結束、道歉轉場時清除這些狀態。
