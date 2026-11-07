# 數學解題通 MathNavi

拍照上傳數學題目，由 AI 協助理解、解題，並依個人學習輪廓提供練習。支援錯題本、批次練習、學習輪廓分析，可安裝成 PWA。

線上版本：https://mathnavi-iota.vercel.app

## 技術架構

- 前端與後端：Next.js 16（App Router）+ React 19 + Tailwind CSS 4，PWA（`src/app/manifest.ts` + `public/sw.js`）
- AI：Gemini（`@google/genai`），後端 API 在 `src/app/api/math/route.ts`，邏輯在 `server/mathHandler.ts`，金鑰池與各功能的模型在 `server/aiPool.ts`
- 登入與雲端同步：Firebase Auth（Google）+ Firestore；未登入時資料存於本機 localStorage
- 部署：Vercel（靜態前端 + `api/` serverless function）

## 本機執行

需要 Node.js。

```bash
npm install
npm run dev
```

開啟 http://localhost:3000/ 。複製 `.env.example` 為 `.env.local` 並填入變數。

## 環境變數

| 名稱 | 用途 |
|---|---|
| `GEMINI_API_KEYS` | Gemini 金鑰池（伺服端；JSON 陣列或逗號隔開）。也可用 `GEMINI_API_KEYS_<功能>` 指定某功能專用的 key，舊的 `GEMINI_API_KEY` 仍相容 |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 服務帳號 JSON，用於驗證登入與記錄 AI 每日使用次數 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | 前端 Firebase 設定（舊名 `VITE_FIREBASE_*` 仍然有效） |
| `AI_DAILY_LIMIT_USER` / `AI_DAILY_LIMIT_GUEST` | 每日 AI 次數上限（預設 30 / 5） |

未設定 Firebase 變數時，App 以訪客模式運作（無登入、無雲端同步）。

## 指令

- `npm run dev`：本機開發伺服器
- `npm run build`：建置到 `dist/`
- `npm run lint`：TypeScript 型別檢查
- `npm run icons`：產生 PWA 圖示

## 部署

詳見 [DEPLOY.md](DEPLOY.md)。
