# MathNavi 上線步驟

做完之後：任何裝置打開網址就能用、可以安裝成 App、登入後錯題本和學習輪廓會跨裝置同步。
全部使用免費方案。

## 1. 換一把新的 Gemini API key

舊的 key 已經被 Google 停用（回傳 403 PERMISSION_DENIED）。

1. 到 https://aistudio.google.com/apikey → **Create API key**
2. 把新 key 貼到專案裡的 `.env.local` 的 `GEMINI_API_KEY=` 後面（本機測試用）
3. 這把 key **不要**寫進 `.env.example` 或任何會上傳的檔案

## 2. 建立 Firebase（登入 + 雲端資料庫）

到 https://console.firebase.google.com 登入 Google 帳號：

1. **新增專案**，名稱例如 `mathnavi`（Google Analytics 可以關掉）
2. 專案首頁點 **</>（網頁）** 新增應用程式，暱稱隨意，**不用**勾 Hosting
   → 畫面會出現一段 `firebaseConfig`，記下其中四個值：
   `apiKey`、`authDomain`、`projectId`、`appId`
3. 左側 **Authentication** → 開始使用 → 登入方式 → **Google** → 啟用 → 儲存
4. 左側 **Firestore Database** → 建立資料庫 → 位置選 `asia-east1`（台灣）→ 以**正式版模式**啟動
5. Firestore → **規則** 分頁 → 把專案裡 `firestore.rules` 的內容整份貼上 → 發布
6. 齒輪 ⚙ **專案設定** → **服務帳戶** → **產生新的私密金鑰** → 會下載一個 `.json` 檔
   ⚠ 這個檔案等同管理員密碼，不要傳給別人、不要放進專案資料夾

把第 2 步的四個值填進 `.env.local` 的 `VITE_FIREBASE_*`，本機重開後右上角就會出現「登入同步」按鈕。

## 3. 部署到 Vercel

### 3-1 把程式放上 GitHub（之後改程式會自動更新網站）

1. 打開 **GitHub Desktop** → File → **Add local repository** → 選 `Desktop\code\mathnavi`
   → 它會說不是 git repo，點 **create a repository**
2. 確認左下角變更清單裡**沒有** `.env.local`（已被 .gitignore 排除）
3. 輸入 Summary「first commit」→ **Commit to main** → **Publish repository**（可以勾 Keep this code private）

### 3-2 Vercel 匯入

1. 到 https://vercel.com 用 GitHub 帳號登入
2. **Add New → Project** → 選 `mathnavi` → **Import**
3. 展開 **Environment Variables**，逐一加入：

| 名稱 | 值 |
|---|---|
| `GEMINI_API_KEYS` | 第 1 步的新 key（多把用逗號隔開；單把也行） |
| `FIREBASE_SERVICE_ACCOUNT` | 用記事本打開第 2-6 步下載的 json，**全選複製整份內容**貼上 |
| `VITE_FIREBASE_API_KEY` | 第 2-2 步的 apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | 第 2-2 步的 authDomain |
| `VITE_FIREBASE_PROJECT_ID` | 第 2-2 步的 projectId |
| `VITE_FIREBASE_APP_ID` | 第 2-2 步的 appId |
| `AI_DAILY_LIMIT_USER`（選填） | 登入使用者每天 AI 次數，預設 30 |
| `AI_DAILY_LIMIT_GUEST`（選填） | 訪客每天 AI 次數，預設 5 |
| `DISTILL_DAILY_LIMIT_USER`（選填） | 每人每天「學習背景分析」次數，預設 12（不佔解題次數） |
| `DISTILL_DAILY_LIMIT_GUEST`（選填） | 訪客每天學習背景分析次數，預設 2 |

4. 按 **Deploy**，約 1 分鐘後會得到網址，例如 `https://mathnavi-xxxx.vercel.app`

### 3-3 允許這個網址登入

Firebase → Authentication → **設定** → **已授權網域** → 新增你的 `xxxx.vercel.app` 網域。
（沒做這步，按登入會出現 `auth/unauthorized-domain`）

## 4. 安裝成 App

- **Android（Chrome）**：開網址 → 右上選單 → **安裝應用程式**
- **iPhone / iPad（Safari）**：開網址 → 分享 → **加入主畫面**
- **電腦（Chrome / Edge）**：網址列右側的「安裝」圖示

## 之後要更新網站

改完程式 → GitHub Desktop **Commit** → **Push origin**，Vercel 會自動重新部署，
已安裝的 App 下次開啟會自動更新。

## 選用：自動清理使用量紀錄

Firestore → **TTL 政策** → 新增：集合 `aiUsage`、欄位 `expireAt`。舊的每日計數會自動刪除。

## 本機開發

雙擊桌面「MathNavi」捷徑，或在這個資料夾執行 `npm run dev`，打開 http://localhost:3000/
（本機沒填 `FIREBASE_SERVICE_ACCOUNT` 時不會限制 AI 次數）
