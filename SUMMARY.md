# MathNavi 專案總結

國中數學解題助手（PWA）：拍照或打字輸入題目，AI 會給出簡答、詳解、知識點和練習題，並支援錯題本與學習輪廓。
**全部內容限定在國中範圍**，資源連結都是真實的均一教育平台單元和會考考古題。

- 線上網址：https://mathnavi-iota.vercel.app（只有這個網址是公開的，其他部署網址受 Vercel 保護）
- Vercel 專案：`kuo8342-lab/mathnavi`
- Firebase 專案：`mathnavi-a1e01`

---

## 0. 企劃書重點（`Downloads/企劃書-MathNavi.docx`）

**要解決的問題**：學生常「看不懂題目」，或「知道在問什麼卻不知道怎麼開始」。翻書、上網找資料很花時間，也不一定能找到自己真正不懂的地方。
**定位**：不只給答案，而是陪學生走完一套學習流程：看懂題目 → 理解解法 → 掌握知識點 → 反覆練習。
**使用對象**：國中數學學習者、需要自主學習的同學、想加強數學能力的同學。

| 企劃書規劃 | 實作狀態 |
|---|---|
| 拍照解題（拍攝或上傳） | ✅ 拍照、相簿、拖曳、Ctrl+V 貼上，也能打字；可裁切 |
| AI 題目解釋（條件、目標） | ✅「看不懂題目」→ 白話題意、已知條件、要求什麼、關鍵詞 |
| 簡答（方向與提示） | ✅ 最終答案＋破題提示 |
| 詳答（完整步驟） | ✅ 逐步解說，可多種解法，附圖 |
| 知識點＋影片 | ✅ 74 個均一真實單元（影片、練習）＋100 題會考考古題 |
| 練功房（同類型、延伸題） | ✅ AI 出題（先寫步驟再寫答案）＋錯題本複習 |
| 多層次解答、完整學習循環 | ✅ 解題頁分頁：簡答／詳答／知識點／練功房 |
| Gemini AI | ✅ gemini-3.8-flash，自動備援 3.5-flash 等模型 |
| RWD（手機、平板、電腦） | ✅ 手機用方塊版面加底部分頁，電腦用側邊欄 |
| Google 帳號登入 | ✅ Firebase Auth（Google）＋雲端同步 |
| 超出企劃書的部分 | 錯題本、學習輪廓、每日次數限制、限定國中程度、PWA 可安裝 |

**建議修正企劃書的地方**：
- 第五節寫「AI行程生成」，應改為「AI 解題與題目解釋生成」。
- 前端技術可以更新為「React + TypeScript + Tailwind CSS（RWD），部署在 Vercel，使用 Firebase 登入與雲端同步」。
- 第七節與第八節之間多了一個「ㄏ」字。

---

## 1. 架構

```
瀏覽器（React 19 + Vite 8 + Tailwind v4，PWA）
  │  Firebase Auth（Google 登入）＋ Firestore 雲端同步（users/{uid}）
  │
  ├─ POST /api/math  ──►  Vercel Function（api/math.ts, maxDuration 300s）
  │                          ├─ usageGuard：每日次數限制（firebase-admin 驗 token）
  │                          └─ mathHandler：呼叫 Gemini（自動換備用模型）
  │
  └─ /__/auth/*  ──►  轉發到 mathnavi-a1e01.firebaseapp.com（讓手機登入不受第三方 Cookie 限制）
```

| 路徑 | 用途 |
|---|---|
| `api/math.ts` | Vercel 入口：驗證 action、扣使用次數、呼叫 handler |
| `server.ts` | 本機開發伺服器（Express + Vite），邏輯與線上共用 |
| `server/mathHandler.ts` | 所有 AI 動作的 prompt、schema、模型備援、錯誤訊息 |
| `server/usageGuard.ts` | 每日次數：登入 30 次、訪客 5 次（`distill` 另計 12/2） |
| `server/unitCatalog.ts` | 74 個國中單元清單（AI 只能從這裡選 `unitIds`） |
| `src/App.tsx` | 外殼：電腦版左側欄、手機版底部 4 分頁、錯題本狀態 |
| `src/components/FlowWorkspace.tsx` | 解題主畫面（首頁方塊 → 結果頁：簡答／詳答／知識點／練功房） |
| `src/components/UnitResources.tsx` | 延遲載入真實資源（均一影片、練習、歷屆會考題） |
| `src/data/units.json` / `pastExams.json` | 74 個均一單元、100 題會考考古題（年份、題號、通過率、連結） |
| `src/lib/mathCore.ts` | AI 回傳結果正規化、本機範例題 |
| `src/lib/cloudSync.ts`, `firebase.ts` | 登入與雲端同步 |
| `src/components/ErrorBoundary.tsx` | 出錯時顯示錯誤畫面，避免整頁空白 |
| `vercel.json` | SPA 改寫規則、`/__/auth` 轉發、`/assets` 長期快取 |

---

## 2. 關鍵設計

### AI 動作（`runMathAction`）
| action | 做什麼 | 模型 |
|---|---|---|
| `recognize` | 照片 → 題目文字 | `gemini-3.1-flash-lite` 優先 |
| `explain` | 「看不懂題目」：白話題意、已知條件、關鍵詞 | 主模型 |
| `solve` | 解題（第一段，要快） | 主模型，`SOLVE_THINKING_LEVEL=LOW` |
| `enrich` | 知識點與練習題（第二段，學生點開時才產生） | 主模型 |
| `practice` / `distill` / `ask` | 再出一題、整理學習筆記、追問 | 主模型 |

### 解題拆成兩段
`solve` 只產生解題必要的內容，知識點和練習題由 `enrich` 延後產生（`enrichState`: idle → loading → ready/failed），學生能更快看到答案。

### 答案正確性
- 先推理再寫答案：schema 的 `propertyOrdering` 規定順序為 question → concept → … → **methods → shortAnswer**。之前把簡答排在前面，曾發生簡答與詳解互相矛盾。
- 練習題同樣規定 `q → steps → a`。
- `repairLatex`：修復 `\times` 被 JSON 轉義成 Tab 字元的問題。

### 限定國中程度（3 層）
1. Prompt 中的 `LEVEL_RULES` 要求只用國中方法。
2. `HIGH_SCHOOL_PATTERN` 偵測高中用語，偵測到就重試一次。
3. 回傳 `level`（國中／超出國中）和 `levelNote`；較快的高中解法只放在知識點延伸的 `highSchoolNote`，不放進簡答與詳答。

### 免費方案下的穩定性
```ts
MODELS = [GEMINI_MODEL ?? 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview']
// generate() 遇到 429（額度用完）或 503（忙碌）就自動換下一個模型
```
錯誤訊息改成學生看得懂的說法：「今天的免費 AI 次數已經用完，大約明天下午 3 點恢復」、「AI 目前太忙，請過幾分鐘再試一次」。

### 介面（方塊版面）
- **手機**：首頁、簡答和錯題本都在一個畫面內放得下；底部固定分頁：解題／錯題本／練功房／學習輪廓。
- **電腦**：左側欄（拍新題目、分頁、帳號）；結果頁左欄題目固定、右欄放內容。

---

## 3. 環境變數（Vercel）

| 變數 | 說明 |
|---|---|
| `GEMINI_API_KEY` | Gemini 金鑰（免費方案） |
| `GEMINI_MODEL` / `GEMINI_MODELS` | 主模型／自訂備援清單（選填） |
| `SOLVE_THINKING_LEVEL` | `LOW`（已驗證 7/7 正確） |
| `VITE_FIREBASE_*` | 前端 Firebase 設定（`authDomain = mathnavi-iota.vercel.app`） |
| `FIREBASE_SERVICE_ACCOUNT` | 後端服務帳戶 JSON（程式會去掉 BOM） |
| `AI_DAILY_LIMIT_USER/GUEST`, `DISTILL_DAILY_LIMIT_*` | 每日次數上限（選填） |

---

## 4. 測試與評估重點（`../mathnavi-eval/REPORT.md`）

- 抽測 114 年會考 7 題（受限於免費額度每模型每天 20 次）。修正前簡答 5/6 正確，錯的那題是簡答與詳解互相矛盾，已修正。
- 拍照辨識幾乎逐字正確，但只測了乾淨的 PDF 圖片，沒有測真實手機照片。
- AI 出的練習題在舊 prompt 下約一半有錯，改成「先寫步驟再寫答案」後抽查 6/6 正確。
- 速度：`gemini-3.8-flash` 每題 40–220 秒。開啟 LOW 思考並拆成兩段後明顯變快。
- 100 題題目、官方答案和測試腳本都已備妥，額度允許時可以跑完整測試。

---

## 5. 踩過的坑

| 問題 | 解法 |
|---|---|
| firebase-admin 14 在 Vercel 出現 `ERR_REQUIRE_ESM` | 降版到 13.10.0 |
| PowerShell 匯入的環境變數帶 BOM | 改用 `vercel env add --value`，程式也會去掉 BOM |
| 手機 Google 登入失敗（第三方儲存空間被封鎖） | `/__/auth` 轉發，並把 authDomain 改成自己的網域 |
| 函式超過 60 秒逾時（504） | `maxDuration: 300` |
| 部分舊手機開啟時整頁空白 | `build.target` 降到 es2019/safari13，並加上 ErrorBoundary |
| 新版上線後仍看到舊版 | PWA 快取造成，重新整理一次即可 |

---

## 6. 待辦／後續

- [ ] 練功房、學習輪廓的內頁改成方塊版面（目前手機上要滑比較多）
- [ ] 額度允許時跑完 100 題完整評估，並測真實手機照片
- [ ] 視使用量決定是否改用付費方案或更快的主模型（目前維持免費）
- [ ] 請手動刪除 `C:\.claude\launch.json`

## 常用指令

```bash
npm run dev                      # 本機開發 http://localhost:3000
npx tsc --noEmit                 # 型別檢查
vercel.cmd deploy --prod --yes   # 部署到正式站
```
