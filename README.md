# 🧮 訂房計算機

從 [ai_customer_service](../ai_customer_service) 的「訂房管理」功能獨立抽出來的純前端計算工具。**不用登入、不用資料庫、不用任何 API 金鑰**，開啟網頁就能用——所有房型定價、包棟方案、日期區間等設定都存在瀏覽器的 `localStorage`，報價邏輯與原本後台完全相同（`src/lib/bookingEngine.ts` 直接沿用，未改動任何計算規則）。

---

## 🌟 功能

*   房型與定價（平日／小假日／連假／旺季，每個 tier 可個別開放或關閉）
*   加人不加房：每人加價設定
*   包棟方案與定價、超額加人規則、自動報價總表
*   旺季／連假日期區間管理
*   促銷方案（%折扣，套用第一晚）與連住折扣（固定金額，第二晚起）
*   多晚試算報價，自動比較「個別租房」vs「包棟」哪個划算
*   **匯出／匯入 JSON**：因為資料只存在這台瀏覽器，提供備份與跨裝置搬移用

---

## 🚀 快速開始（本機測試）

```bash
npm install
npm run dev
```

開啟瀏覽器看到的畫面就是完整功能，資料會自動存在瀏覽器裡，重新整理也不會消失。

---

## ☁️ 一鍵部署（Netlify）

跟原專案一樣支援 Netlify 一鍵部署，而且因為完全不需要環境變數／資料庫設定，比原專案更簡單：

### 步驟一：把專案推到你自己的 GitHub

```bash
git init
git add .
git commit -m "init booking calculator"
```

到 GitHub 建立一個新的空 repository（例如 `booking_computer`），然後：

```bash
git remote add origin https://github.com/<你的帳號>/booking_computer.git
git branch -M main
git push -u origin main
```

### 步驟二：一鍵部署到 Netlify

把下面連結中的 `<你的帳號>/booking_computer` 換成你剛剛的 repo 路徑，點下去即可：

```
https://app.netlify.com/start/deploy?repository=https://github.com/<你的帳號>/booking_computer
```

或者也可以直接到 [Netlify 控制台](https://app.netlify.com/) 選 **Add new site > Import an existing project**，連結你的 GitHub repo，Netlify 會自動讀取 [netlify.toml](netlify.toml) 的建置設定（`npm run build`，發布 `dist` 資料夾），不需要額外設定任何環境變數，按 Deploy 就完成了。

---

## 📝 資料備份

因為設定只存在瀏覽器 `localStorage`（換瀏覽器、清快取、換裝置都會不見），畫面右上角有：

*   **匯出備份**：下載目前所有設定成一個 JSON 檔
*   **匯入設定**：讀取先前匯出的 JSON 檔，還原所有設定

建議設定好房型/定價後先匯出一份存好。

---

## ⚖️ 免責聲明

本專案僅供學習與內部工具使用。
