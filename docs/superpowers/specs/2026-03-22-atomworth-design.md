# AtomWorth MVP Design Spec

> "Every atom counts. Own your net worth, bit by bit."

**Date:** 2026-03-22
**Status:** Approved

---

## Context

AtomWorth 是一個個人資產淨值追蹤系統，對標 Percento 的開源替代方案。
核心動機：財務數據不應存在別人的雲端，使用者應完全掌控數據主權。

系統不是記帳軟體，不是交易系統，不做複式記帳。
它的唯一任務：**持有數量 × 當日價格 × 當日匯率 = 當日估值**，每天快照，長期追蹤。

---

## 1. 系統架構

```
[Next.js App Router]  <--REST-->  [FastAPI + APScheduler]  <-->  [PostgreSQL]
        |                                    |
   Tailwind CSS                    每日 22:00 自動執行
   Happy Hues Palette 8            yfinance（股票/ETF/crypto）
   Light/Dark CSS variables        exchangerate-api（USD/JPY→TWD）
                                   CoinGecko（USDT→TWD）
```

### Docker Compose Services

| Service | 說明 |
|---|---|
| `web` | Next.js App Router，port 3000 |
| `api` | FastAPI + APScheduler，port 8000 |
| `db` | PostgreSQL 16，volume 持久化 |

### Environment Variables

**API:**
```
DATABASE_URL
BASE_CURRENCY=TWD
SNAPSHOT_SCHEDULE=0 22 * * *
EXCHANGERATE_API_KEY
```

**Web:**
```
NEXT_PUBLIC_API_BASE_URL
```

---

## 2. 資料模型（7 張表）

> **所有表均包含 `created_at` / `updated_at`**，記錄資料建立與最後更新時間。
> `transactions` 為 audit log，`created_at` 記錄入帳時間，`updated_at` 允許修正筆誤。
> `holding_changes` 已由 `transactions` 取代，不再存在。

### 2.1 assets

資產定義，一種資產一筆記錄。採用**三層分類架構**，對應會計科目邏輯。

```sql
CREATE TABLE assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  asset_class   TEXT NOT NULL CHECK (asset_class IN ('asset', 'liability')),
  category      TEXT NOT NULL,
  sub_kind      TEXT NOT NULL,
  symbol        TEXT,
  market        TEXT,
  currency_code TEXT NOT NULL,
  pricing_mode  TEXT NOT NULL CHECK (pricing_mode IN ('market', 'fixed', 'manual')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 三層分類定義

**第一層 `asset_class`** — 會計本質：正資產 vs 負債

| asset_class | 意義 | 在淨資產計算中 |
|---|---|---|
| `asset` | 正資產 | 加項 |
| `liability` | 負債 | 減項 |

---

**第二層 `category`** — 資產性質（對應流動性與會計科目）

| category | 中文 | 適用 asset_class |
|---|---|---|
| `liquid` | 流動資金（現金、銀行帳戶等高流動性資產）| asset |
| `investment` | 投資（有價證券、加密貨幣、基金）| asset |
| `fixed` | 固定資產（不動產、車輛等非流動資產）| asset |
| `receivable` | 應收款 | asset |
| `debt` | 債務 | liability |

---

**第三層 `sub_kind`** — 具體金融工具

| category | sub_kind | 預設 pricing_mode | 說明 |
|---|---|---|---|
| `liquid` | `bank_account` | `fixed` | 銀行存款、活存 |
| `liquid` | `physical_cash` | `fixed` | 實體現金 |
| `liquid` | `e_wallet` | `fixed` | 支付寶、PayPal 等 |
| `liquid` | `stablecoin` | `fixed` | USDT 等穩定幣 |
| `liquid` | `other` | `fixed` | |
| `investment` | `stock` | `market` | 上市股票（yfinance）|
| `investment` | `etf` | `market` | ETF |
| `investment` | `crypto` | `market` | BTC、ETH（yfinance）|
| `investment` | `fund` | `manual` | 基金（手動輸入淨值）|
| `investment` | `precious_metal` | `manual` | 黃金、白銀 |
| `investment` | `other` | `manual` | |
| `fixed` | `real_estate` | `manual` | 不動產 |
| `fixed` | `vehicle` | `manual` | 汽車 |
| `fixed` | `other` | `manual` | |
| `receivable` | `receivable` | `manual` | 借出款項 |
| `debt` | `credit_card` | `fixed` | 信用卡帳單（quantity = 欠款金額）|
| `debt` | `mortgage` | `fixed` | 房貸（quantity = 剩餘本金）|
| `debt` | `personal_loan` | `fixed` | 個人借款 |
| `debt` | `other` | `fixed` | |

**業務規則（API 層驗證）：**
- `asset_class='asset'` 時，`category` 必須為 `liquid | investment | fixed | receivable`
- `asset_class='liability'` 時，`category` 必須為 `debt`
- `pricing_mode` 必須符合上表預設值（允許例外：`fund` 可改 `market` 若有 symbol）
- `fixed` 意指「資產在原始幣別中的單價恆為 1.0」，quantity 即為當前金額
- 違反規則回傳 `422 Unprocessable Entity`

**不可變欄位：** `asset_class`、`category`、`sub_kind`、`currency_code`、`pricing_mode` 一旦有快照存在即不可修改（防止歷史資料語意錯誤）。`name`、`symbol`、`market` 可隨時修改。

### 2.2 accounts

帳戶定義。代表實際存放資產的機構或容器（券商、銀行、交易所、錢包）。

```sql
CREATE TABLE accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,       -- "富途證券", "郵局帳戶", "幣安"
  institution  TEXT,                -- 機構名稱（選填）
  account_type TEXT NOT NULL CHECK (account_type IN (
                 'bank', 'broker', 'crypto_exchange', 'e_wallet', 'cash', 'other')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**account_type 值：**
- `bank` — 銀行帳戶（郵局、台銀）
- `broker` — 證券帳戶（富途、永豐金）
- `crypto_exchange` — 加密貨幣交易所（幣安、OKX）
- `e_wallet` — 電子錢包（支付寶、PayPal）
- `cash` — 實體現金
- `other` — 其他

---

### 2.3 holdings

目前持有數量，以 **(資產 × 帳戶)** 為最小單位。同一資產可分布在多個帳戶。

```sql
CREATE TABLE holdings (
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity   NUMERIC(24,8) NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, account_id)
);

CREATE INDEX idx_holdings_account ON holdings(account_id);
```

**聚合查詢：**
- 某資產總持倉：`SELECT SUM(quantity) FROM holdings WHERE asset_id = $1`
- 某帳戶所有持倉：`SELECT * FROM holdings WHERE account_id = $1`

**負債生命週期：** 負債完全還清時，使用 `DELETE /holdings` 刪除持倉（保留 `transactions` 異動紀錄）。不建議以 `quantity=0` 表示清償，因為 snapshot job 會跳過 quantity=0 的記錄。

---

### 2.4 transactions

交易與異動流水（取代原 `holding_changes`）。記錄每次持有量變化的原因、價格與費用。

```sql
CREATE TABLE transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  txn_type   TEXT NOT NULL CHECK (txn_type IN (
               'buy', 'sell', 'transfer_in', 'transfer_out', 'adjustment')),
  quantity   NUMERIC(24,8) NOT NULL,   -- 通常正值；adjustment 允許負值
  txn_date   DATE NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_asset   ON transactions(asset_id, txn_date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id, txn_date DESC);
```

**txn_type 語意：**

| txn_type | 持倉影響 | quantity | 說明 |
|---|---|---|---|
| `buy` | +quantity | 正值 | 買入，數量增加 |
| `sell` | −quantity | 正值 | 賣出，數量減少 |
| `transfer_in` | +quantity | 正值 | 從其他帳戶轉入 |
| `transfer_out` | −quantity | 正值 | 轉出到其他帳戶 |
| `adjustment` | ±quantity | 可正可負 | 手動修正（初始建立、數量校正）|

> **adjustment 說明：** 唯一允許 `quantity` 為負值的類型。正值表示新增（如初始設立持倉），負值表示扣除（如清帳）。

> **transfer 配對說明：** 帳戶間轉移需記錄**兩筆交易**：來源帳戶寫 `transfer_out`，目標帳戶寫 `transfer_in`，使用相同 `quantity` 與 `note`（如 "帳戶A→帳戶B"）。系統不強制兩筆配對。

**與 holdings 的關係：** `POST /transactions` **不自動更新 holdings**。前端在記錄交易後，應顯式呼叫 `PUT /holdings/{asset_id}/{account_id}` 更新數量。holdings 永遠反映當前狀態，transactions 提供完整歷史。

> **holdings 清零：** 當持倉數量降至 0 時，呼叫 `DELETE /holdings`（非設為 0），snapshot job 跳過不存在的行。

### 2.5 prices

資產歷史價格，以資產原始幣別計價。

```sql
CREATE TABLE prices (
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  price      NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  source     TEXT NOT NULL,   -- 'yfinance' | 'coingecko' | 'manual' | 'system'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, price_date)
);

CREATE INDEX idx_prices_date ON prices(price_date);
```

每天一筆（以 `price_date` 為 key）。強制刷新時執行 `INSERT ... ON CONFLICT DO UPDATE`，更新 `price`、`source`、`updated_at`。

### 2.6 fx_rates

匯率歷史。`1 from_currency = rate to_currency`，base 為 TWD。

```sql
CREATE TABLE fx_rates (
  from_currency TEXT NOT NULL,
  to_currency   TEXT NOT NULL,
  rate_date     DATE NOT NULL,
  rate          NUMERIC(24,10) NOT NULL CHECK (rate > 0),
  source        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_currency, to_currency, rate_date)
);

CREATE INDEX idx_fx_rates_date ON fx_rates(rate_date);
```

每天一筆（以 `from_currency + to_currency + rate_date` 為 key）。強制刷新時執行 `INSERT ... ON CONFLICT DO UPDATE`，更新 `rate`、`source`、`updated_at`。

**支援幣別：** `TWD / USD / JPY / USDT`

| 幣別對 | 來源 | API | 說明 |
|---|---|---|---|
| USD→TWD | exchangerate-api | `openexchangerates.org` 或 `exchangerate-api.com` | 每日抓取 |
| JPY→TWD | exchangerate-api | 同上 | 每日抓取 |
| USDT→TWD | **CoinGecko** | `api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=twd` | 直接取得 USDT/TWD，非衍生 |
| TWD→TWD | system | — | 固定 rate=1.0，source='system' |

### 2.7 snapshot_items

每日快照，作為歷史查詢唯一來源。以 **(日期 × 資產 × 帳戶)** 為最小粒度，支援帳戶視角查詢。

```sql
CREATE TABLE snapshot_items (
  snapshot_date DATE NOT NULL,
  asset_id      UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quantity      NUMERIC(24,8) NOT NULL CHECK (quantity >= 0),
  price         NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  fx_rate       NUMERIC(24,10) NOT NULL CHECK (fx_rate > 0),
  value_in_base NUMERIC(24,8) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, asset_id, account_id)
);

CREATE INDEX idx_snapshot_items_date    ON snapshot_items(snapshot_date);
CREATE INDEX idx_snapshot_items_asset   ON snapshot_items(asset_id, snapshot_date DESC);
CREATE INDEX idx_snapshot_items_account ON snapshot_items(account_id, snapshot_date DESC);
```

**聚合查詢範例：**
```sql
-- 某日某資產跨帳戶總量
SELECT SUM(quantity), SUM(value_in_base)
FROM snapshot_items
WHERE snapshot_date = $1 AND asset_id = $2;

-- 某日某帳戶總值
SELECT SUM(value_in_base)
FROM snapshot_items
WHERE snapshot_date = $1 AND account_id = $2;
```

---

## 3. 估值規則

### 基本公式

```
local_value  = quantity × price
value_in_base = local_value × fx_rate(currency → TWD)
```

### 各類型資產

| asset_class | category | sub_kind 例子 | price | fx_rate | 備註 |
|---|---|---|---|---|---|
| asset | liquid | bank_account, stablecoin | 1.0（fixed）| currency→TWD | quantity = 持有金額 |
| asset | investment | stock, etf, crypto | 市場報價（yfinance / CoinGecko）| currency→TWD | |
| asset | investment | fund, precious_metal | 手動輸入 | currency→TWD | |
| asset | fixed | real_estate, vehicle | 手動輸入 | currency→TWD | |
| asset | receivable | receivable | 手動輸入 | currency→TWD | |
| liability | debt | credit_card, mortgage | 1.0（fixed）| currency→TWD | value_in_base 存正值，聚合時取負 |

**負債符號約定：** `snapshot_items.value_in_base` 對 `asset_class='liability'` 存**正值**（CHECK >= 0 有效）。
淨資產計算在 SQL 層以 `CASE WHEN a.asset_class='liability' THEN -value_in_base ELSE value_in_base END` 處理。

**Manual 資產價格工作流程：** 使用者在 `/assets/[id]` 詳情頁手動輸入當日價格（`POST /prices/manual`），Snapshot job 使用最近一筆 manual price，不覆蓋。若完全無記錄則 fallback 失敗，該資產不寫入快照並回報警告。

### 顯示幣別換算

UI 可選擇顯示幣別（TWD / USD / JPY），前端即時換算：

```
displayed_value = value_in_base_TWD ÷ fx_rate(display_currency → TWD)
```

資料庫永遠存 TWD base，換算只在前端發生。

---

## 4. Snapshot 產生流程

每日 22:00 由 APScheduler 執行 `daily_snapshot_job`：

1. 抓取 `market` 資產今日收盤價 → 寫入 `prices`（`INSERT ... ON CONFLICT DO UPDATE`）
2. 抓取今日匯率（USD/JPY/USDT → TWD）→ 寫入 `fx_rates`（`INSERT ... ON CONFLICT DO UPDATE`）
3. **在 DB transaction 中：刪除當日既有 snapshot_items**（保證冪等性）
4. 讀取所有 `holdings`（每筆為 **asset × account** 組合）
5. 對每筆 `(asset_id, account_id, quantity)`：
   - 找當日或最近可用 price（fallback 最近 30 天；超過則跳過並記警告）
   - 找當日或最近可用 fx_rate（fallback 最近 7 天；超過則使用系統預設）
   - 計算 `value_in_base = quantity × price × fx_rate`
   - INSERT 至 `snapshot_items`
6. **DB transaction commit**
7. `manual` 資產價格不被 cron 覆蓋（step 1 只處理 `pricing_mode='market'`）

**冪等性：** 步驟 3 先刪除當日資料，再重寫，確保重跑不產生重複記錄。

---

## 5. API 設計

Base URL: `/api/v1`

### Assets
```
GET    /assets
POST   /assets
PATCH  /assets/{id}
DELETE /assets/{id}
```

`POST /assets` 請求 body：
```json
{
  "name": "AAPL",
  "asset_class": "asset",
  "category": "investment",
  "sub_kind": "stock",
  "symbol": "AAPL",
  "market": "NASDAQ",
  "currency_code": "USD",
  "pricing_mode": "market"
}
```

`PATCH /assets/{id}` 可修改欄位：`name`、`symbol`、`market`。
`asset_class`、`category`、`sub_kind`、`currency_code`、`pricing_mode` 在有任何 snapshot 存在後為**不可變**（防止歷史資料語意錯誤），違反時返回 422。

### Accounts
```
GET    /accounts
POST   /accounts
PATCH  /accounts/{id}
DELETE /accounts/{id}
```

`POST /accounts` 請求 body：
```json
{
  "name": "富途證券",
  "institution": "Futu Securities",
  "account_type": "broker",
  "note": "港股 / 美股用"
}
```
`DELETE /accounts/{id}` 若帳戶下仍有 holdings，返回 `409 Conflict`。

### Holdings
```
GET    /holdings                              # 列出所有 holdings（join asset + account）
GET    /holdings?account_id=                  # 按帳戶篩選
PUT    /holdings/{asset_id}/{account_id}      # upsert quantity（holding 必須先存在或為新建）
DELETE /holdings/{asset_id}/{account_id}
```

`GET /holdings` 回應 schema（陣列）：
```json
[
  {
    "asset_id": "uuid",
    "account_id": "uuid",
    "quantity": 12.5,
    "asset_name": "AAPL",
    "asset_class": "asset",
    "category": "investment",
    "sub_kind": "stock",
    "currency_code": "USD",
    "pricing_mode": "market",
    "account_name": "富途證券",
    "account_type": "broker",
    "latest_value_in_base": 87320.00,   // 來自最新 snapshot，可能為 null
    "updated_at": "2026-03-22T14:00:00Z"
  }
]
```

`PUT /holdings/{asset_id}/{account_id}` 請求 body：
```json
{ "quantity": 12.5 }
```
此端點**只更新 quantity**。`(asset_id, account_id)` 對應的 `assets` 與 `accounts` 必須已存在，否則返回 404。若需記錄異動原因，改用 `POST /transactions`（API 不強制，但前端 Side Panel 會引導填寫交易記錄）。

### Transactions
```
GET    /transactions?asset_id=&account_id=&from=&to=
POST   /transactions
PATCH  /transactions/{id}   # 允許修正筆誤（僅 note / unit_price / fee）
DELETE /transactions/{id}   # 僅限 adjustment 類型可刪
```

`PATCH /transactions/{id}` 允許修改欄位：`note` 僅此。
`txn_type`、`quantity`、`txn_date`、`asset_id`、`account_id` 為**不可變欄位**；需更正時應刪除後重建。

`POST /transactions` 請求 body：
```json
{
  "asset_id": "uuid",
  "account_id": "uuid",
  "txn_type": "buy",
  "quantity": 2.5,
  "txn_date": "2026-03-22",
  "note": "買入 AAPL"
}
```
`POST /transactions` **不自動更新 holdings**；holdings 由前端在記錄交易後顯式呼叫 `PUT /holdings` 更新，保持兩者職責分離。

### Prices
```
GET  /prices?asset_id=&from=&to=
POST /prices/manual
```

`POST /prices/manual` 請求 body：
```json
{ "asset_id": "uuid", "price_date": "2026-03-22", "price": 7900000.00 }
```
僅適用於 `pricing_mode='manual'` 的資產，否則返回 422。

### FX Rates
```
GET  /fx-rates?from=&to=&from_date=&to_date=
POST /fx-rates/manual
```

`POST /fx-rates/manual` 請求 body：
```json
{ "from_currency": "USD", "to_currency": "TWD", "rate_date": "2026-03-22", "rate": 32.67 }
```

### Snapshots
```
GET  /snapshots/history?range=30d|1y|all
GET  /snapshots/{date}
POST /snapshots/rebuild/{date}
POST /snapshots/rebuild-range
```

`GET /snapshots/{date}` 回應 schema：
```json
{
  "snapshot_date": "2026-03-22",
  "net_worth": 12847320.00,
  "items": [
    {
      "asset_id": "uuid",
      "account_id": "uuid",
      "asset_name": "AAPL",
      "account_name": "富途證券",
      "quantity": 12.5,
      "price": 210.50,
      "currency_code": "USD",
      "fx_rate": 32.67,
      "value_in_base": 85994.63
    }
  ]
}
```

`POST /snapshots/rebuild-range` 請求 body：
```json
{ "from": "2026-01-01", "to": "2026-03-22" }
```
V1 所有重建均為**同步執行**（個人工具，資料量有限）。回傳 `200 OK` 及重建的日期數與 missing_assets 摘要。

### Dashboard
```
GET /dashboard/summary?display_currency=TWD
GET /dashboard/allocation?date=&display_currency=TWD
GET /dashboard/net-worth-history?range=30d|1y|all&display_currency=TWD
```

`GET /dashboard/summary` 回應 schema：
```json
{
  "snapshot_date": "2026-03-22",
  "display_currency": "TWD",
  "net_worth": 12847320.00,
  "total_assets": 13199320.00,
  "total_liabilities": 352000.00,
  "change_amount": 289000.00,   // 與前一筆 snapshot 的淨資產差額
  "change_pct": 2.30,           // 相對前一筆 snapshot 的百分比變化
  "missing_assets": []          // 無法估值的 asset_id 列表（V1 顯示 ID，V2 加入原因）
}
```

`GET /dashboard/allocation` 回應 schema（Treemap 資料）：
```json
{
  "snapshot_date": "2026-03-22",
  "display_currency": "TWD",
  "categories": [
    {
      "category": "investment",
      "label": "投資",
      "value": 8456320.00,
      "pct": 65.8,
      "color": "#7c3aed",
      "items": [
        { "asset_id": "uuid", "name": "AAPL", "value": 87320.00, "pct": 0.68 }
      ]
    }
  ]
}
```

`GET /dashboard/net-worth-history` 回應 schema（折線圖資料）：
```json
{
  "display_currency": "TWD",
  "data": [
    { "date": "2026-01-01", "net_worth": 11200000.00 },
    { "date": "2026-01-02", "net_worth": 11350000.00 }
  ]
}
```

**Dashboard 估值來源：** 顯示最新一筆 snapshot（`MAX(snapshot_date)`）。Dashboard 不做即時估算，所有數字來自 `snapshot_items`。當日 snapshot 若尚未執行，顯示前一日資料並標示「資料截至 {date}」。

---

## 6. 前端頁面結構

### 6.1 頁面列表

| 路徑 | 頁面 | 核心功能 |
|---|---|---|
| `/` | Dashboard | 淨資產 + Treemap + 趨勢圖 + 持倉 accordion |
| `/holdings` | 持倉管理 | 按帳戶列表 + Side Panel 新增/編輯 |
| `/assets` | 資產設定 | 資產主檔 CRUD |
| `/assets/[id]` | 資產詳情 | 價值趨勢 + 快照明細 + 交易紀錄 log |
| `/accounts` | 帳戶管理 | 帳戶 CRUD（銀行、券商、交易所） |
| `/snapshots` | 快照歷史 | 每日快照清單 + 展開明細 |
| `/settings` | Settings | 顯示幣別、Light/Dark（排程時間為唯讀，由環境變數控制）|

### 6.2 Dashboard UX

- **頂部**：淨資產大字 + 漲跌幅 badge + 總資產/負債 sub-row
- **雙欄**：Treemap 配置圖（左）+ 淨資產趨勢折線圖（右）
- **持倉 accordion**：分類 header（彩色）可展開/收合子項目
  - 點 Treemap 色塊 → 自動展開對應分類
- **顯示幣別**切換在 topbar

### 6.3 持倉管理 UX

- 列表呈現：按帳戶分組，每個帳戶為一個 section header，下方列出該帳戶所有 holdings
- 點任意 row → 右側 Side Panel 滑出
  - 顯示：資產名稱、帳戶名稱、目前數量、估值
  - 編輯：持有數量、同步記錄交易（txn_type + note，選填）
  - 操作：儲存、刪除、查看資產詳情連結
- 右上角「+ 新增持倉」→ 同一個 Side Panel，切換為新增模式
  - 新增流程：選擇帳戶 → 選擇（或新建）資產 → 輸入數量 → 選填初始交易記錄

### 6.4 帳戶管理 `/accounts`

- 帳戶列表：名稱、類型、機構、持倉筆數
- 右上角「+ 新增帳戶」→ Modal 表單（name / institution / account_type / note）
- 點帳戶 row → 展開或跳轉顯示該帳戶下所有 holdings
- 刪除帳戶：若帳戶下有 holdings，提示先移除持倉

### 6.5 資產詳情 `/assets/[id]`

- 資產基本資訊卡（name / asset_class / category / sub_kind / symbol / currency / pricing_mode）
- 折線圖：過去 N 天的 value_in_base 趨勢（跨帳戶加總）
- 表格：每日快照明細（date / total_qty / price / fx_rate / value）
- 交易紀錄 log：`transactions` 時間線（txn_date / account / txn_type / quantity / note）
- 若 `pricing_mode='manual'`，顯示「更新今日價格」快捷按鈕 → `POST /prices/manual`

---

## 7. UI 系統

### 色彩（Happy Hues Palette 8）

```css
--color-bg:       #f8f5f2;   /* 頁面底色（暖白）*/
--color-surface:  #fffffe;   /* 卡片底色 */
--color-text:     #232323;   /* 主文字 */
--color-muted:    #888;      /* 次要文字 */
--color-accent:   #078080;   /* Teal，導覽 / 按鈕 / 流動資金 */
--color-coral:    #f45d48;   /* 負債類 */
--color-border:   #e8e8e8;

/* 第二層 category 顏色（Treemap、accordion header 使用）*/
--cat-liquid:    #078080;   /* 流動資金 */
--cat-investment:#7c3aed;   /* 投資 */
--cat-fixed:     #1d4ed8;   /* 固定資產 */
--cat-receivable:#f59e0b;   /* 應收款 */
--cat-debt:      #f45d48;   /* 負債（Coral）*/
```

### Dark Mode

以 `[data-theme="dark"]` 覆寫 CSS variables，結構不變：

```css
[data-theme="dark"] {
  --color-bg:      #1a1916;
  --color-surface: #232320;
  --color-text:    #f8f5f2;
  --color-muted:   #888;
  --color-border:  #333;
  /* 亮化 accent/coral 確保在深色底的對比度 */
  --color-accent:  #0a9e9e;   /* Teal 亮化版 */
  --color-coral:   #ff7059;   /* Coral 亮化版 */
  /* 分類色：在深色背景下保持可用，不額外覆寫（已夠亮） */
}
```

### 技術選型

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts（折線圖 + Treemap）
- **State:** React Context + SWR for data fetching
- **Backend:** FastAPI (Python 3.12)
- **Scheduler:** APScheduler（整合在 FastAPI lifespan）
- **Database:** PostgreSQL 16

---

## 8. 錯誤處理與 Fallback

| 情境 | 處理方式 |
|---|---|
| 當日無價格 | 使用最近一筆歷史價格 |
| 當日無匯率 | 使用最近一筆歷史匯率 |
| `fixed` 資產 | 直接用 price=1，不需抓取 |
| 完全無資料 | 該資產不寫入 snapshot，API 回報警告 |
| snapshot 失敗 | transaction rollback，不保留半成品 |
| 價格抓取失敗 | 記 log，繼續其他資產，不中斷整體 job |

---

## 9. MVP 驗收標準

1. 能新增資產（各種 sub_kind）
2. 能新增帳戶並將持倉歸屬至帳戶
3. 能設定每個 (asset, account) 的持有數量，有 transactions 記錄
4. 能自動每日抓股票/匯率/crypto 價格
5. 能自動產生每日 snapshot（per asset × account）
6. 能顯示淨資產歷史趨勢圖
7. 能顯示某日資產配置 Treemap
8. 能在手機瀏覽器正常使用（RWD）
9. 能透過 Docker Compose 一鍵啟動
10. snapshot 出錯時可安全重跑
11. 資產詳情頁可查價值趨勢與交易紀錄

---

## 10. 未來擴充（V2）

- Cost basis / 未實現損益計算（基於 `transactions` 中的 buy/sell 記錄）
- 多 base currency（切換 TWD / USD 儲存基準）
- iOS / macOS native client（共用 API）
- 來源監控頁（price / fx sync 狀態、missing_assets 原因診斷）
