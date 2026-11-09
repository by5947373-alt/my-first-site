# 23.5° 水上島

嘉義縣水上鄉的 3D 低多邊形微縮島嶼，獨立網站。
島嶼輪廓照水上鄉真實行政區界，八掌溪等河川和縱貫線也是真實路線（OpenStreetMap）。

可以旋轉、縮放、點建築看介紹，依「人・文・地・產・景」篩選，
把景點加入「小旅行」排順序、顯示路線、自動導覽（清單存在瀏覽器裡）。

線上網址：https://by5947373-alt.github.io/my-first-site/island/

## 跑起來

```bash
npm install
npm run dev        # 開發模式，邊改邊看
npm run build      # 輸出 dist/，整個資料夾放到任何靜態主機就能用
npm run preview    # 在本機預覽 dist/
```

技術：React + TypeScript + Three.js + React Three Fiber + Drei，動畫用 `useFrame` 與 GSAP。

## 要改內容改哪裡

| 檔案 | 內容 |
|---|---|
| `src/spots.json` | 店家／景點的名稱、位置（x / y 是 1000 × 625 畫框的百分比）、地址、電話、營業時間 |
| `src/data.ts` | 每個景點用哪個 3D 模型、人文地產景分類、介紹文字；道路示意路線 |
| `src/scene/models.tsx` | 各景點模型與專屬動畫（北回歸線光束、糖廠煙囪、咖啡蒸氣、行星旋轉、夜市燈串…） |
| `src/scene/Landmarks.tsx` | 建築互動：待機微動、滑過浮起、點擊彈跳、選中光圈、標籤避讓 |
| `src/scene/CameraRig.tsx` | 正交等角鏡頭、鏡頭飛行、平移限制 |
| `src/world.ts` | 農田、樹、房子、丘陵的擺放（固定亂數種子，每次長得一樣） |
| `src/App.tsx`、`src/styles.css` | 介面：分類篩選、資訊卡、小旅行面板 |
| `src/geo.json` | 鄉界、河川、鐵路幾何，由 `npm run geo` 從 `data/ring.json`、`data/lines.json` 產生 |

`spots.json` 裡有、`data.ts` 裡沒設定模型的據點，會自動放一棟通用小店。
市區店家彼此距離很近，島上會把建築稍微推開，所以位置是示意而非精確門牌。

**待確認的內容**：「庄頭廟宇」「水上夜市」「蝴蝶生態園」是依設計方向放的示意景點，
位置與介紹請依實際情況在 `src/data.ts` 修改。道路是串連景點的示意路線，不是真實路網。

## 效能

樹、房子、農田都用 InstancedMesh；樹和作物的搖擺在頂點著色器裡算；
畫面掉格時自動降低解析度；`prefers-reduced-motion` 時停止環境動畫。

## 資料來源

地圖幾何：OpenStreetMap 貢獻者，ODbL 授權（網站右下角保留標註）。
店家資訊：《水上手冊》。
