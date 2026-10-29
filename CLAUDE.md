# CLAUDE.md

## 最高原則
- **規格以 `SPEC.md` 為準**。它是本專案唯一的規格來源；與其他文件（含 `PLAN.md`、原型）衝突時，以 `SPEC.md` 為準。
- `prototype/brick-duel.html` 只是參考原型，不可直接當正式程式使用；正式程式依規格以 TypeScript 模組化重寫。
- `PLAN.md` 記錄已確認的架構與設計決策，開始新階段前先讀。

## 每階段結束時（SPEC.md 第 0、18、20 節）
1. 執行型別檢查、lint、單元測試、E2E 測試。
2. 擷取手機直向（390×844）、手機橫向（844×390）、電腦（1440×900）三種尺寸截圖，存到 `screenshots/stage-N/`。
3. `git commit`，訊息格式：`階段 N：簡述`。
4. 依 SPEC.md 第 20 節格式回報。
5. **回報後停止**，等使用者確認，不要自行開始下一階段。

## 開發守則
- 不得有無作用的按鈕：尚未實作的功能不顯示入口。
- 不得自行刪減或合併規格內容；做不到時在回報中說明並提出替代方案。
- 所有可調數值（招式、計時、計分、動畫參數）集中在 `src/config/`，不散落在程式各處。
- 玩家輸入只以純文字顯示；禁止 `dangerouslySetInnerHTML`、`innerHTML`、`eval`；不把玩家輸入輸出到主控台。
- 無外部連線：不呼叫 API、不載入 CDN、不加分析工具、不載入外部字型。
- 畫面、檔名、程式碼、文案不得出現任何積木品牌名稱或商標。
- 3D 場景以獨立模組管理（不使用 react-three-fiber），React 只負責介面；文字一律是 HTML 疊層。

## 指令（階段 1 建立專案後生效）
- 開發：`npm install && npm run dev`（短回合測試：網址加 `?round=30`）
- 型別檢查：`npm run typecheck`
- Lint：`npm run lint`
- 單元測試：`npm run test`
- E2E：`npm run e2e`（Chromium 軟體 WebGL，`--use-gl=swiftshader`）
- 截圖：`npm run screenshots`
