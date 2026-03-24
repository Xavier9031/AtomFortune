# Atom Fortune

隱私優先的個人淨值追蹤工具。所有資料存放在你自己的 PostgreSQL，不依賴任何雲端帳號。

## 功能特色

- **儀表板** — 淨值總覽（含漲跌）、資產/負債結構堆疊面積圖、財務自由進度估算、持倉 Accordion
- **持倉管理** — 依帳戶分組、右側 SidePanel 新增精靈 / 快速編輯刪除
- **自動記** — 在持倉上設定固定收入/支出（薪水、房租等），記錄每月現金流，支援有效期限與標籤
- **資產設定** — 表格一覽、點擊列從右側 SidePanel 開啟詳情（持倉分佈、趨勢圖、交易紀錄、編輯名稱/代號/手動報價）
- **帳戶管理** — CRUD 表格、有持倉時禁止刪除
- **價格快照** — 每日自動 cron job（可設定時間）、手動觸發 / 重建指定日期或區間、快照歷史展開檢視
- **多幣顯示** — 基準幣 TWD，可切換顯示 USD / JPY 等，匯率自動更新
- **備份/還原** — 匯出完整資料為 JSON、匯入還原
- **深色模式** — localStorage 記憶偏好

## 技術堆疊

| 層  | 技術 |
|-----|------|
| 後端 API | [Hono](https://hono.dev/) + TypeScript + `@hono/node-server` |
| ORM / 遷移 | [Drizzle ORM](https://orm.drizzle.team/) + drizzle-kit |
| 資料庫 | PostgreSQL 16 |
| 排程 | node-cron |
| 市價抓取 | [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2)（股票、ETF、加密貨幣） |
| 匯率抓取 | [open.er-api.com](https://www.exchangerate-api.com/docs/free-api)（法幣，免費無 API 金鑰）+ CoinGecko（USDT/TWD） |
| 前端框架 | Next.js 16 App Router + TypeScript |
| 樣式 | Tailwind CSS v4 |
| 資料抓取 | SWR |
| 圖表 | Recharts |
| 後端測試 | Vitest + 真實 PostgreSQL 測試庫 |

## 專案結構

```
AtomFortune/
├── api/                    # Hono 後端
│   ├── src/
│   │   ├── modules/        # assets / accounts / holdings / transactions
│   │   │                   # prices / fx-rates / snapshots / dashboard
│   │   │                   # recurring-entries / tickers / backup
│   │   ├── jobs/           # snapshot.job.ts / pricing.service.ts / fx.service.ts
│   │   ├── db/             # Drizzle schema + client
│   │   └── index.ts        # 主入口
│   ├── tests/              # Vitest 測試 + helpers
│   └── drizzle/            # 遷移檔案
├── web/                    # Next.js 前端
│   ├── app/                # App Router 頁面
│   ├── components/         # dashboard / holdings / assets / accounts / snapshots / layout
│   └── lib/                # types.ts / api.ts / utils.ts
├── docker-compose.yml
└── README.md
```

---

## 快速啟動（Docker Compose — 推薦）

所有外部資料來源均免費且無需 API 金鑰，直接啟動即可。

### 1. 啟動所有服務

```bash
docker compose up -d
```

啟動項目：
- `db` — PostgreSQL 16（port 5432）
- `api` — Hono API（port 8000）
- `web` — Next.js（port 3000）

### 2. 執行資料庫遷移（首次啟動）

```bash
docker compose exec api npm run db:migrate
```

### 3. 開啟瀏覽器

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
  --name atomfortune-db \
  -e POSTGRES_DB=atomfortune \
  -e POSTGRES_USER=atomfortune \
  -e POSTGRES_PASSWORD=atomfortune \
  -p 5432:5432 \
  postgres:16
```

### 後端 API

```bash
cd api
npm install

# 執行遷移
DATABASE_URL=postgres://atomfortune:atomfortune@localhost:5432/atomfortune \
  npm run db:migrate

# 開發模式（hot reload）
DATABASE_URL=postgres://atomfortune:atomfortune@localhost:5432/atomfortune \
BASE_CURRENCY=TWD \
SNAPSHOT_SCHEDULE="0 22 * * *" \
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
docker exec atomfortune-db psql -U atomfortune -c "CREATE DATABASE test_atomfortune;"

# 執行遷移到測試庫
cd api
TEST_DATABASE_URL=postgres://atomfortune:atomfortune@localhost:5432/test_atomfortune \
  npm run db:migrate

# 執行測試
npm test
```

---

## API 端點總覽

### 資產

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/assets` | 資產列表 |
| POST | `/api/v1/assets` | 新增資產 |
| PATCH | `/api/v1/assets/:id` | 更新資產（name / symbol） |
| DELETE | `/api/v1/assets/:id` | 刪除資產 |

### 帳戶

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/accounts` | 帳戶列表 |
| POST | `/api/v1/accounts` | 新增帳戶 |
| PATCH | `/api/v1/accounts/:id` | 更新帳戶 |
| DELETE | `/api/v1/accounts/:id` | 刪除帳戶 |

### 持倉

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/holdings` | 持倉列表（含 latestValueInBase） |
| PUT | `/api/v1/holdings/:assetId/:accountId` | 設定持倉數量 |
| DELETE | `/api/v1/holdings/:assetId/:accountId` | 刪除持倉 |

### 交易紀錄

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/transactions` | 交易紀錄（支援 `?assetId=&accountId=&from=&to=`） |
| POST | `/api/v1/transactions` | 新增交易 |

### 自動記

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/recurring-entries` | 自動記列表（支援 `?assetId=&accountId=`） |
| POST | `/api/v1/recurring-entries` | 新增自動記 |
| PATCH | `/api/v1/recurring-entries/:id` | 更新自動記 |
| DELETE | `/api/v1/recurring-entries/:id` | 刪除自動記 |

### 價格 / 匯率

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/prices` | 價格紀錄 |
| POST | `/api/v1/prices/manual` | 手動輸入價格（manual 資產用） |
| GET | `/api/v1/fx-rates` | 匯率紀錄（支援 `?from=&to=&fromDate=&toDate=`） |
| POST | `/api/v1/fx-rates/refresh` | 立即重新抓取匯率 |
| POST | `/api/v1/fx-rates/manual` | 手動輸入匯率 |

### 快照

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/snapshots/history` | 快照日期列表（支援 `?range=30d\|1y\|all`） |
| GET | `/api/v1/snapshots/items` | 指定資產的快照序列（需 `?assetId=&range=`） |
| GET | `/api/v1/snapshots/:date` | 指定日期快照明細 |
| POST | `/api/v1/snapshots/trigger` | 手動觸發快照（支援 `?date=YYYY-MM-DD`） |
| POST | `/api/v1/snapshots/rebuild/:date` | 重建指定日快照 |
| POST | `/api/v1/snapshots/rebuild-range` | 批次重建區間（body: `{ from, to }`） |

### 儀表板

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/dashboard/summary` | 淨值總覽（含漲跌，支援 `?displayCurrency=`） |
| GET | `/api/v1/dashboard/allocation` | 分類配置（支援 `?date=&displayCurrency=`） |
| GET | `/api/v1/dashboard/live` | 即時持倉彙總（支援 `?displayCurrency=`） |
| GET | `/api/v1/dashboard/net-worth-history` | 淨值歷史（支援 `?range=&displayCurrency=`） |
| GET | `/api/v1/dashboard/category-history` | 分類歷史（支援 `?range=&displayCurrency=`） |

### 代碼搜尋 / 備份

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/tickers` | 股票/ETF/加密貨幣代碼搜尋（支援 `?q=`） |
| GET | `/api/v1/backup/export` | 匯出完整資料為 JSON |
| POST | `/api/v1/backup/import` | 匯入 JSON 還原資料 |

---

## 快照機制

每日 cron job（預設 22:00）執行 `dailySnapshotJob`：

1. 抓取所有 `market` 資產的最新市價（yahoo-finance2）
2. 抓取最新匯率（open.er-api 法幣 + CoinGecko USDT/TWD）
3. 對每筆持倉計算 `valueInBase`（TWD）= `quantity × price × fxRate`
4. 寫入 `snapshotItems` 表（30 天內找不到價格則跳過）
5. 整個過程在同一 DB transaction 內確保原子性

手動觸發（開發補跑）：

```bash
curl -X POST "http://localhost:8000/api/v1/snapshots/trigger?date=2026-03-22"
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
│   ├── stock / etf   → market（yahoo-finance2）
│   ├── crypto        → market（yahoo-finance2）
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
| `SNAPSHOT_SCHEDULE` | 否 | `0 22 * * *` | 快照 cron 表達式 |
| `PORT` | 否 | `8000` | API 監聽 port |
| `NEXT_PUBLIC_API_BASE_URL` | 否 | `http://localhost:8000/api/v1` | 前端瀏覽器端 API URL |
| `API_BASE_URL` | 否 | `http://api:8000/api/v1` | 前端 Server-Side API URL（Docker 內網用） |
