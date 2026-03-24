# Technical Reference

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

---

## 外部資料來源

所有來源均免費、無需 API 金鑰：

| 來源 | 用途 |
|------|------|
| [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) | 股票、ETF、加密貨幣市價 |
| [open.er-api.com](https://www.exchangerate-api.com/docs/free-api) | 法幣匯率（33 種主要幣別） |
| [CoinGecko API](https://www.coingecko.com/api/documentation) | USDT/TWD 匯率 |
| [TWSE](https://www.twse.com.tw) | 台股代碼搜尋 |
| Yahoo Finance Search | 美股/ETF 代碼搜尋 |
