# 23.5° 剛剛好的城市

嘉義縣水上鄉觀光與地方創生網站。Node 伺服器 + 靜態頁面，零套件相依（只用 Node 內建模組）。

頁面是真的靜態 HTML —— 後台按下儲存時，伺服器把內容寫進磁碟並重新產生所有頁面。
所以線上改完馬上生效，但訪客拿到的仍然是純 HTML，沒有 JavaScript 也讀得到內容。

## 跑起來

```bash
npm start                       # http://localhost:8080
ADMIN_PASSWORD=你的密碼 npm start   # 加上後台
```

後台在 **/admin.html**。沒設 `ADMIN_PASSWORD` 就無法登入也無法儲存（唯讀）。

## 建置

版型、導覽列、頁尾只有一份，各頁只寫自己的內容。改完 `src/` 之後跑：

```bash
node build.js
```

會產生根目錄的六個 HTML 檔、`assets/map-data.js` 和 `tools/preview.html`。
伺服器儲存內容時走的是同一支 `lib/render.mjs`，所以本機建置和線上存檔產生的頁面一定一致。

`src/site.json` 的 `nav` 是唯一的頁面清單：新增一頁就在那裡加一筆，
再建一個同名的 `src/pages/<檔名>.html`。清單裡列了但檔案不存在會直接報錯，
`src/pages/` 裡有檔案但沒列進清單則會提醒。

### src/ 的結構

| 檔案 | 內容 |
|---|---|
| `src/site.json` | 導覽列項目＝頁面清單 |
| `src/layout.html` | 外層版型（`{{title}}` `{{desc}}` `{{header}}` `{{main}}` `{{footer}}` `{{scripts}}`） |
| `src/partials/header.html` | 導覽列（`{{nav}}` 由建置填入，會自動標記目前頁面） |
| `src/partials/footer.html` | 頁尾 |
| `src/pages/*.html` | 各頁的 `<main>` 內容，開頭幾行是 front-matter |
| `src/content.json` | 店家、景點、農產、報導、地圖圖釘的資料（由後台編輯器維護） |

頁面裡用 `{{venues:taste}}`、`{{venues:culture}}`、`{{venues:grow}}`、`{{crops}}`、
`{{news}}`、`{{news:3}}` 這些佔位符，建置時會換成 `content.json` 的內容。

頁面檔開頭長這樣，用 `---` 和內容隔開：

```
title: 品味・水上在地美食｜23.5° 剛剛好的城市
desc: 嘉義水上四家在地美食……
scripts: assets/map.js
---
<section class="sec">…</section>
```

`scripts` 和 `nav`（導覽列反白哪一項，預設就是自己）都可以省略。

## 產生的頁面

| 檔案 | 內容 |
|---|---|
| `index.html` | Hero、地方介紹、三大服務項目、互動式地圖、散策路線、報導摘要 |
| `taste.html` | 品味・水上在地美食（4 家） |
| `culture.html` | 回歸・水上景點與文化（4 處） |
| `grow.html` | 生長・水上農產（3 大作物）與創生店家（4 家） |
| `news.html` | 相關報導與資源（全部為外部連結） |
| `contact.html` | 聯絡資訊、Google 地圖嵌入、交通指引 |
| `assets/style.css` | 全站樣式與設計 token（含深淺色主題） |
| `assets/site.js` | 捲動進場、頁尾年份 |
| `assets/map.js` | 互動式地圖的據點資料與互動邏輯 |
| `server.js` | 網站伺服器：靜態檔 + 內容 API + 存檔後重新產生頁面 |
| `lib/render.mjs` | 渲染邏輯，CLI 與伺服器共用 |
| `build.js` | 本機建置指令 |
| `admin.html` | 後台（登入 + 編輯 + 發佈） |
| `lib/github.mjs` | 自動 commit 回 GitHub |
| `sync.js` | 手動把線上內容抓回 `src/content.json`（`npm run sync`） |
| `tools/build_map.py` | 由 OpenStreetMap 資料產生地圖幾何（僅在需要重繪地圖時使用） |
| `tools/preview.html` | 六頁打包成單檔的預覽版，由 `build.py` 產生，網站本身用不到 |
| `assets/map-data.js` | 地圖圖釘資料，由 `build.py` 從 `content.json` 產生，不要手改 |

根目錄的 `.html` 是建置產物，**不要直接編輯** —— 下次執行 `build.py` 會被覆蓋。
要改版面請改 `src/`。

## 本機預覽

```bash
python3 -m http.server 8000
```

然後開 http://localhost:8000

## 後台

網址是 **/admin.html**（線上、本機都一樣）。用 `ADMIN_PASSWORD` 登入，
左邊選分類（品味／回歸／生長店家／三大農產／相關報導），可以新增、編輯、
上下移動、刪除，右邊即時顯示這張卡片在網站上長什麼樣。

按「**儲存並發佈到網站**」→ 伺服器寫入 `data/content.json` → 立刻重新產生所有頁面。
訪客重新整理就看得到，不用重新部署。

編輯到一半的內容會暫存在瀏覽器（localStorage），關掉分頁不會不見。

### 線上改的內容會自動同步回 GitHub

設好下面的環境變數之後，你在後台按儲存 → 網站立刻生效 → **停止編輯 10 分鐘後，
伺服器自動把 `src/content.json` 和產生的頁面 commit 回 repo**，不用手動下載或 commit。

| 環境變數 | 說明 |
|---|---|
| `GITHUB_TOKEN` | 有該 repo **Contents: read and write** 權限的 token（fine-grained personal access token 即可） |
| `GITHUB_REPO` | `by5947373-alt/my-first-site` |
| `GITHUB_BRANCH` | 預設 `main` |
| `GITHUB_PATH_PREFIX` | 網站在 repo 裡的子目錄。放在 `shuishang/` 就填 `shuishang/`；放在根目錄就留空 |
| `SYNC_DELAY_MS` | 停手多久後才推，預設 `600000`（10 分鐘） |

**為什麼要等 10 分鐘：** 每次 push 都會觸發 Zeabur 重新部署。延遲合併之後，
連續編輯十筆只會在你停手後推一次，網站不會一直重啟。等不及的話，後台有
「立刻同步到 GitHub」按鈕。

後台會顯示同步狀態（預計推送時間／已推送的 commit／失敗原因）。
**同步失敗不影響網站** —— 內容已經寫進磁碟也已經生效，只是還沒進 git。

設定完可以先驗證 token 和 repo 設定對不對（唯讀，不會寫入）：

```bash
GITHUB_TOKEN=… GITHUB_REPO=… npm run gh:check
```

### 手動把線上內容抓回本機

```bash
SITE_URL=https://你的網域 ADMIN_PASSWORD=你的密碼 npm run sync
```

會把線上內容寫回 `src/content.json`；沒有變動就不動檔案。

### 沒有後端時的退路

如果只用 `python3 -m http.server` 開這一頁（沒有跑 `npm start`），後台會自動切成
**檔案模式**：一樣可以編輯，但只能「下載 content.json → 覆蓋 `src/content.json`
→ `node build.js` → commit」。

### 其他不在後台裡的東西

- **地圖圖釘**：也在 `content.json` 裡，每個據點的 `map` 欄位（後台有表單可以填）。
  `x` / `y` 是圖釘位置（百分比），`lx` / `ly` 是名稱標籤偏移（px，用引線拉開擠在一起的市區店家），
  `side` 決定標籤往左或往右，`label` 是地圖上的短名。`assets/map-data.js` 是產生出來的，不要手改。
- **頁面框架文字**（單元標題、引言、散策路線、悄悄話、聯絡資訊）：在 `src/pages/` 裡。
- **配色**：改 `assets/style.css` 開頭的 `:root` token；深色主題的同名 token 在下方兩個區塊，三處要一起改。

## 部署到 Zeabur

這是純靜態網站，不需要 Node.js 或任何伺服器程式。

1. 把這個資料夾推上 GitHub（可以是獨立 repo，或現有 repo 的子目錄）。
2. Zeabur → Create Service → Git → 選這個 repo。
3. Zeabur 偵測到根目錄有 `index.html` 會自動以 **Static** 部署（不需要在雲端跑 `build.py`，
   建置產物已經在 repo 裡）。
   若網站放在子目錄，在服務設定裡把 Root Directory 指到 `shuishang/`。
4. 綁定網域即可上線。

沒有需要設定的環境變數。

## 資料來源與授權

- 文字、店家資訊：《水上手冊》（P.01–P.11）。
- 地圖幾何（鄉界、八掌溪、台鐵縱貫線）：**OpenStreetMap 貢獻者，ODbL 授權**。
  網站上必須保留來源標註 —— 目前放在地圖下方與各頁頁尾。
- 相關報導：全部為外部連結，僅引用標題與摘要，不轉載原文。

## 尚未完成

- **AI 客服**（需求書列為 v2）尚未實作。
- **使用者回饋**（v2）尚未實作。後端已經有了，要加的話可以沿用同一支 `server.js`。
- 後台只有單一組密碼，沒有多帳號。修改紀錄靠自動同步產生的 git commit。
- 頁面框架文字（單元標題、引言、散策路線、聯絡資訊）還是要改 `src/` 再重新部署，
  後台目前只管內容資料。
- 專案本身的對外聯絡信箱待補，目前 `src/pages/contact.html` 標示為「待補」。
- 待收錄據點：尼克牛排、水上機場、二馬肉鬆 —— 手冊原稿只有名稱，沒有店家資訊。
