<p align="center">
  <img src="../web/public/icon-192.png" width="80" alt="AtomFortune" />
</p>

<h1 align="center">AtomFortune</h1>

<p align="center">
  <strong>開源、隱私優先的個人資產儀表板。</strong><br/>
  你的財務資料存放在本機，不依賴任何雲端帳號或訂閱服務。完全開源。
</p>

<p align="center">
  <a href="https://github.com/Xavier9031/AtomFortune/releases/latest">
    <img src="https://img.shields.io/badge/下載-最新版-brightgreen?style=flat-square" alt="Download" />
  </a>
  <img src="https://img.shields.io/badge/平台-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20Docker-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/授權-MIT-blue?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="../README.md">English</a>
</p>

---

## 為什麼做 AtomFortune？

大多數人的資產分散在銀行、券商、加密貨幣交易所、不動產等各處，卻沒有一個全局視角。傳統記帳 APP 著重於追蹤每一筆日常開銷，繁瑣且容易放棄。

AtomFortune 採取不同的方式：**定期資產快照**。不需要記錄每筆交易，只需每一到三個月盤點一次持倉狀態，市價資產會自動更新。支援 17 種幣別即時切換顯示 — 系統會自動處理不同計價方式與匯率的換算。最終得到的是一個清晰的長期財務全貌 — 不需要每天記帳的負擔。

## 這是什麼？

在一個介面上追蹤你所有的資產與負債：

- **現金與存款** — 銀行帳戶、電子錢包、穩定幣
- **投資** — 股票、ETF、加密貨幣、基金、貴金屬
- **固定資產** — 不動產、車輛
- **負債** — 房貸、信用卡、個人貸款

可每天自動抓取市價與匯率，計算即時淨值並記錄長期趨勢。

## 功能

- **儀表板** — 即時淨值、資產配置圓餅圖、30 天 / 1 年 / 全期歷史圖表，另含 30 天 / 6 個月 / 1 年變化摘要
- **持倉管理** — 依帳戶分組，快速新增、編輯、刪除持倉
- **資產管理** — 資產清單，含持倉分佈與價值歷史
- **帳戶管理** — 銀行、券商、加密貨幣交易所、電子錢包
- **多幣顯示** — 快照資料以 TWD 儲存，支援 17 種幣別切換顯示（USD、JPY、EUR、GBP、CNY 等）
- **備份 / 還原** — 一鍵加密匯出與匯入
- **多使用者** — 多個個人檔案，資料完全獨立
- **深色模式** — 完整深色主題，切換有平滑過渡
- **手機適配** — 響應式版面，底部導航列、卡片式列表、全螢幕面板
- **手機連線** — 一鍵 Cloudflare Tunnel + QR Code，任何網路都能連
- **自動更新** — 桌面版啟動時自動檢查更新

## 下載

前往 [Releases](https://github.com/Xavier9031/AtomFortune/releases) 下載最新版：

| 平台 | 格式 | 架構 |
|------|------|------|
| macOS | `.dmg` | Apple Silicon (arm64) |
| Windows | `.exe`（NSIS 安裝程式） | x64 |
| Linux | `.AppImage` | x64 |

> 無需任何設定 — 桌面版已內建 API 伺服器與前端。

### macOS：「檔案已損毀」提示

由於 AtomFortune 尚未取得 Apple 開發者憑證簽名，macOS Gatekeeper 在第一次啟動時會封鎖應用程式。

將 `.app` 移至「應用程式」資料夾後，在終端機執行以下指令即可解除：

```bash
xattr -cr /Applications/AtomFortune.app
```

之後正常雙擊開啟即可。此步驟只需執行一次。

## 自架（Docker Compose）

偏好網頁版的使用者：

```bash
git clone https://github.com/Xavier9031/AtomFortune.git
cd AtomFortune
export API_TOKEN=change-this-before-exposing-the-stack
docker compose up -d
```

打開瀏覽器前往 **http://localhost:3001**。

### 手機連線

進入 **設定 → 手機連線**，按下 **開啟連線**，用手機掃描 QR Code 即可。
支援 4G/5G、不同 WiFi 等任何網路環境（透過 Cloudflare Tunnel）。

如果機器上沒有先安裝 `cloudflared`，請先設定 `CLOUDFLARED_SHA256`，讓受管下載在執行前有固定的雜湊值可驗證。

## 技術堆疊

| 層 | 技術 |
|----|------|
| 桌面殼層 | [Electron](https://www.electronjs.org/) 31 |
| 後端 | [Hono](https://hono.dev/)（TypeScript） |
| 資料庫 | SQLite（[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)）+ [Drizzle ORM](https://orm.drizzle.team/) |
| 前端 | [Next.js](https://nextjs.org/) 16 + [Tailwind CSS](https://tailwindcss.com/) v4 + [Recharts](https://recharts.org/) |
| 市場數據 | [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2)（股票、ETF、加密貨幣、匯率） |
| 國際化 | [next-intl](https://next-intl-docs.vercel.app/)（zh-TW、en） |
| 測試 | [Vitest](https://vitest.dev/)（API）+ [Jest](https://jestjs.io/)（Web） |
| CI/CD | GitHub Actions（tag 觸發三平台建置） |

## 專案結構

```
AtomFortune/
├── api/               # Hono REST API + SQLite
│   ├── src/modules/   # assets, accounts, holdings, prices, snapshots, ...
│   ├── src/jobs/      # 每日快照排程、報價服務
│   └── drizzle/       # 資料庫遷移
├── web/               # Next.js 前端
│   ├── app/           # 頁面（總覽、持倉、資產、帳戶、設定⋯）
│   └── components/    # React 元件
├── desktop/           # Electron 桌面殼層
│   └── src/main.ts    # 主程序、tunnel、選單
└── docker-compose.yml
```

## 本地開發

### 前置需求

- Node.js 20+
- npm

### 安裝

```bash
# 安裝 monorepo 工具
npm install

# 安裝各套件
cd api && npm install && cd ..
cd web && npm install && cd ..
cd desktop && npm install && cd ..
```

### 啟動

```bash
# 終端 1：API 伺服器（port 8000）
cd api && npm run dev

# 終端 2：前端（port 3000）
cd web && npm run dev

# 終端 3（選擇性）：桌面版
cd desktop && npm start
```

### 執行測試

```bash
cd api && npm test
cd web && npm test
```

### 建置桌面版

```bash
cd desktop && npm run dist
```

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_PATH` | `./atomfortune.db` | SQLite 資料庫路徑 |
| `API_TOKEN` | 未設定 | API 與 Next.js proxy 共用的選用保護 token |
| `CLOUDFLARED_SHA256` | 未設定 | 啟用手機連線時，受管 `cloudflared` 下載所需的 SHA256 pin |
| `SNAPSHOT_SCHEDULE` | `0 22 * * *` | 每日快照排程（cron） |
| `PORT` | `8000` | API 伺服器埠號 |
| `API_ORIGIN` | `http://localhost:8000` | Next.js 代理的 API 來源 |
| `WEB_ORIGIN` | `http://localhost:3000` | Tunnel 指向的 Web 來源 |

## 運作原理

1. **新增帳戶**（銀行、券商、錢包）和**資產**（股票、現金、房產）
2. **建立持倉**，將資產連結到帳戶並設定數量
3. 每天 22:00，**快照排程**自動執行：
   - 從 Yahoo Finance 抓取最新市價
   - 從 Yahoo Finance 抓取匯率（`USDT` 會沿用 `USD`）
   - 計算每筆持倉的 `估值 = 數量 × 價格 × 匯率`
   - 儲存時間點快照
4. **儀表板**呈現淨值隨時間的變化趨勢

## 文件

- [Technical Reference](technical-reference.md) — API endpoints, schema, snapshot mechanism
- [English README](../README.md)

## 安全說明

AtomFortune 以本機 / 自架為前提設計。`multi-profile` 是同一個實例內的本機資料分組功能，不是完整的帳號權限系統。手動 snapshot rebuild / backfill API 會依 `X-User-Id` 作用在目前選到的 profile；排程工作仍會處理同一個資料庫內的所有本機 profile。若你需要人與人之間的硬隔離，應使用不同 OS 帳號、不同資料庫檔案或不同部署。

## 授權

MIT
