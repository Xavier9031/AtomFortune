# AtomWorth

隱私優先的個人淨值追蹤工具。所有資料存放在你自己的 PostgreSQL，不依賴任何雲端帳號。

## 功能特色

- **儀表板** — 淨值總覽、資產/負債分配 Treemap、30 天趨勢折線圖、持倉 Accordion
- **持倉管理** — 依帳戶分組、右側 SidePanel 4 步驟新增精靈 / 快速編輯刪除
- **資產設定** — CRUD 表格、cascade 下拉（資產類別 → Category → Sub-kind → 報價模式）、詳情頁含趨勢圖與交易紀錄
- **帳戶管理** — CRUD 表格、有持倉時禁止刪除
- **價格快照** — 每日自動 cron job（可設定時間）、手動觸發 / 重建、快照歷史展開檢視
- **多幣顯示** — 基準幣 TWD，可切換顯示 USD / JPY，匯率自動更新
- **深色模式** — localStorage 記憶偏好

## 技術堆疊

| 層  | 技術 |
|-----|------|
| 後端 API | [Hono](https://hono.dev/) + TypeScript + `@hono/node-server` |
| ORM / 遷移 | [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| 資料庫 | PostgreSQL 16 |
| 排程 | node-cron |
| 市價抓取 | yahoo-finance2（股票/ETF）、CoinGecko（加密貨幣）、exchangerate-api（法幣匯率） |
| 前端框架 | Next.js 15 App Router + TypeScript |
| 樣式 | Tailwind CSS v4 |
| 資料抓取 | SWR |
| 圖表 | Recharts |
| 後端測試 | Vitest + 真實 PostgreSQL 測試庫 |
| 前端測試 | Jest + @testing-library/react |

## 專案結構

```
AtomWorth/
├── api/                    # Hono 後端
│   ├── src/
│   │   ├── modules/        # assets / accounts / holdings / transactions
│   │   │                   # prices / fx-rates / snapshots / dashboard
│   │   ├── jobs/           # snapshot.job.ts / pricing.service.ts / fx.service.ts
│   │   ├── db/             # Drizzle schema + client
│   │   └── index.ts        # 主入口
│   ├── tests/              # Vitest 測試 + helpers
│   └── drizzle/            # 遷移檔案
├── web/                    # Next.js 前端
│   ├── app/                # App Router 頁面
│   ├── components/         # dashboard / holdings / assets / accounts / snapshots / layout
│   ├── lib/                # types.ts / api.ts / utils.ts / assetTaxonomy.ts
│   └── __tests__/          # Jest 測試
├── shared/                 # 前後端共用型別
├── docker-compose.yml
└── README.md
```

---

## 快速啟動（Docker Compose — 推薦）

### 1. 準備環境變數

在專案根目錄建立 `.env`：

```env
EXCHANGERATE_API_KEY=your_key_here
```

> 從 [https://www.exchangerate-api.com](https://www.exchangerate-api.com) 免費申請 API key（每月 1500 次請求）。

### 2. 啟動所有服務

```bash
docker compose up -d
```

啟動項目：
- `db` — PostgreSQL 16（port 5432）
- `api` — Hono API（port 8000）
- `web` — Next.js（port 3000）

### 3. 執行資料庫遷移（首次啟動）

```bash
docker compose exec api npm run db:migrate
```

### 4. 開啟瀏覽器

```
http://localhost:3000
```

---

## 本地開發（不用 Docker）

### 前置需求

- Node.js 20+
- PostgreSQL 16

### 啟動 PostgreSQL（Docker 單容器）

```bash
docker run -d \
  --name atomworth-db \
  -e POSTGRES_DB=atomworth \
  -e POSTGRES_USER=atomworth \
  -e POSTGRES_PASSWORD=atomworth \
  -p 5432:5432 \
  postgres:16
```

### 後端 API

```bash
cd api
npm install

# 執行遷移
DATABASE_URL=postgres://atomworth:atomworth@localhost:5432/atomworth \
  npm run db:migrate

# 開發模式（hot reload）
DATABASE_URL=postgres://atomworth:atomworth@localhost:5432/atomworth \
BASE_CURRENCY=TWD \
SNAPSHOT_SCHEDULE="0 22 * * *" \
EXCHANGERATE_API_KEY=your_key_here \
  npm run dev
```

API 啟動於 `http://localhost:8000`

### 前端

```bash
cd web
npm install

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 \
  npm run dev
```

前端啟動於 `http://localhost:3000`

---

## 執行測試

### 後端（需要測試用 PostgreSQL）

```bash
# 建立測試資料庫（只需一次）
docker exec atomworth-db psql -U atomworth -c "CREATE DATABASE test_atomworth;"

# 執行遷移到測試庫
cd api
TEST_DATABASE_URL=postgres://atomworth:atomworth@localhost:5432/test_atomworth \
  npm run db:migrate

# 執行測試
npm test
```

### 前端

```bash
cd web && npx jest
```

---

## API 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/assets` | 資產列表 |
| POST | `/api/v1/assets` | 新增資產 |
| PATCH | `/api/v1/assets/:id` | 更新資產（name/symbol/market） |
| DELETE | `/api/v1/assets/:id` | 刪除資產 |
| GET | `/api/v1/accounts` | 帳戶列表 |
| POST | `/api/v1/accounts` | 新增帳戶 |
| PATCH | `/api/v1/accounts/:id` | 更新帳戶 |
| DELETE | `/api/v1/accounts/:id` | 刪除帳戶 |
| GET | `/api/v1/holdings` | 持倉列表（含 latestValueInBase） |
| PUT | `/api/v1/holdings/:assetId/:accountId` | 設定持倉數量 |
| DELETE | `/api/v1/holdings/:assetId/:accountId` | 刪除持倉 |
| GET | `/api/v1/transactions` | 交易紀錄（支援 `?assetId=`） |
| POST | `/api/v1/transactions` | 新增交易 |
| GET | `/api/v1/prices` | 價格紀錄 |
| POST | `/api/v1/prices/manual` | 手動輸入價格（manual 資產用） |
| GET | `/api/v1/fx-rates` | 匯率紀錄 |
| GET | `/api/v1/snapshots/history` | 快照日期列表（支援 `?range=30d/all`） |
| GET | `/api/v1/snapshots/:date` | 指定日期快照明細 |
| POST | `/api/v1/snapshots/rebuild/:date` | 重建指定日快照 |
| POST | `/api/v1/snapshots/rebuild-range` | 批次重建區間快照 |
| GET | `/api/v1/dashboard/summary` | 淨值總覽（含漲跌） |
| GET | `/api/v1/dashboard/allocation` | 分類配置 |
| GET | `/api/v1/dashboard/net-worth-history` | 淨值歷史 |
| POST | `/snapshots/trigger?date=YYYY-MM-DD` | 手動觸發快照（開發用） |

---

## 快照機制

每日 cron job（預設 22:00）執行 `dailySnapshotJob`：

1. 抓取所有 `market` 資產的最新市價（yahoo-finance2 / CoinGecko）
2. 抓取最新匯率（exchangerate-api + CoinGecko USDT）
3. 對每筆持倉計算 `valueInBase`（TWD）= `quantity × price × fxRate`
4. 寫入 `snapshotItems` 表（30 天內找不到價格則跳過）
5. 整個過程在同一 DB transaction 內確保原子性

手動觸發（開發補跑）：

```bash
curl -X POST "http://localhost:8000/snapshots/trigger?date=2026-03-22"
```

---

## 資產分類

```
資產 (asset)
├── liquid（流動資產）
│   ├── bank_account  → fixed pricing
│   ├── physical_cash → fixed
│   ├── e_wallet      → fixed
│   └── stablecoin    → fixed
├── investment（投資資產）
│   ├── stock         → market（yahoo-finance2）
│   ├── etf           → market
│   ├── crypto        → market（CoinGecko）
│   ├── fund          → manual
│   └── precious_metal→ manual
├── fixed（固定資產）
│   ├── real_estate   → manual
│   └── vehicle       → manual
└── receivable        → fixed

負債 (liability)
└── debt
    ├── credit_card   → fixed
    ├── mortgage      → fixed
    └── personal_loan → fixed
```

---

## 環境變數說明

| 變數 | 必填 | 預設值 | 說明 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | — | PostgreSQL 連線字串 |
| `TEST_DATABASE_URL` | 否 | — | 測試用 DB（vitest 自動使用） |
| `BASE_CURRENCY` | 否 | `TWD` | 基準幣別 |
| `SNAPSHOT_SCHEDULE` | 否 | `0 22 * * *` | cron 表達式 |
| `EXCHANGERATE_API_KEY` | 是 | — | exchangerate-api.com 金鑰 |
| `PORT` | 否 | `8000` | API 監聽 port |
| `NEXT_PUBLIC_API_BASE_URL` | 否 | `http://localhost:8000/api/v1` | 前端 API base URL |
| `NEXT_PUBLIC_SNAPSHOT_SCHEDULE` | 否 | `0 22 * * *` | 顯示在設定頁的排程說明 |
