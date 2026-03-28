# Technical Reference

## API Endpoints

### Assets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/assets` | List assets |
| POST | `/api/v1/assets` | Create asset |
| PATCH | `/api/v1/assets/:id` | Update asset (name / symbol) |
| DELETE | `/api/v1/assets/:id` | Delete asset |

### Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/accounts` | List accounts |
| POST | `/api/v1/accounts` | Create account |
| PATCH | `/api/v1/accounts/:id` | Update account |
| DELETE | `/api/v1/accounts/:id` | Delete account |

### Holdings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/holdings` | List holdings (includes `latestValueInBase`) |
| PUT | `/api/v1/holdings/:assetId/:accountId` | Upsert holding quantity |
| DELETE | `/api/v1/holdings/:assetId/:accountId` | Delete holding |

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/transactions` | List transactions (`?assetId=&accountId=&from=&to=`) |
| POST | `/api/v1/transactions` | Create transaction |
| PATCH | `/api/v1/transactions/:id` | Update transaction note |
| DELETE | `/api/v1/transactions/:id` | Delete adjustment transaction |

### Recurring Entries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/recurring-entries` | List recurring entries (`?assetId=&accountId=`) |
| POST | `/api/v1/recurring-entries` | Create recurring entry |
| PATCH | `/api/v1/recurring-entries/:id` | Update recurring entry |
| DELETE | `/api/v1/recurring-entries/:id` | Delete recurring entry |

### Prices / FX Rates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/prices` | List price records (`?assetId=&from=&to=`) |
| POST | `/api/v1/prices/manual` | Manually set price (for manual-priced assets) |
| GET | `/api/v1/fx-rates` | List FX rates (`?from=&to=&fromDate=&toDate=`) |
| POST | `/api/v1/fx-rates/refresh` | Refresh FX rates now |
| POST | `/api/v1/fx-rates/manual` | Manually set FX rate |

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/snapshots/history` | Snapshot date list (`?range=30d\|1y\|all`) |
| GET | `/api/v1/snapshots/items` | Snapshot series for an asset (`?assetId=&range=`) |
| GET | `/api/v1/snapshots/:date` | Snapshot detail for a date |
| POST | `/api/v1/snapshots/trigger` | Trigger snapshot (`?date=YYYY-MM-DD`) |
| POST | `/api/v1/snapshots/rebuild/:date` | Rebuild snapshot for a date |
| POST | `/api/v1/snapshots/rebuild-range` | Rebuild date range (body: `{ from, to }`) |
| POST | `/api/v1/snapshots/backfill-prices` | Backfill historical prices only |
| POST | `/api/v1/snapshots/backfill` | Backfill historical prices + FX, then rebuild |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard/summary` | Net worth summary with changes (`?displayCurrency=`) |
| GET | `/api/v1/dashboard/allocation` | Category allocation (`?date=&displayCurrency=`) |
| GET | `/api/v1/dashboard/live` | Live holdings total (`?displayCurrency=`) |
| GET | `/api/v1/dashboard/net-worth-history` | Net worth history (`?range=&displayCurrency=`) |
| GET | `/api/v1/dashboard/category-history` | Category history (`?range=&displayCurrency=`) |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users` | List users |
| POST | `/api/v1/users` | Create user |
| PATCH | `/api/v1/users/:id` | Update user |
| DELETE | `/api/v1/users/:id` | Delete user |

### Ticker Search / Backup

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tickers/search` | Search stocks/ETFs/crypto (`?q=&country=TW\|US\|Crypto`) |
| GET | `/api/v1/backup/export` | Export user data as ZIP (`X-User-Id`, optional `X-Backup-Password`) |
| POST | `/api/v1/backup/import` | Import ZIP to restore data (`X-User-Id`) |
| DELETE | `/api/v1/backup/reset` | Delete all data for the current user (`X-User-Id`) |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/system/config` | Runtime config exposed to the web app (`snapshotSchedule`) |

### Tunnel (Phone Access)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/tunnel/start` | Start Cloudflare Tunnel, returns public URL |
| POST | `/api/v1/tunnel/stop` | Stop tunnel |
| GET | `/api/v1/tunnel/status` | Get tunnel status and URL |

---

## Snapshot Mechanism

Daily cron job (default 22:00) runs `dailySnapshotJob`:

1. Fetch latest market prices for all `market`-priced assets (yahoo-finance2)
2. Fetch latest FX rates from Yahoo Finance (`USDT` mirrors `USD`)
3. Calculate `valueInBase` (TWD) = `quantity × price × fxRate` for each holding
4. Write to `snapshotItems` table (skip if no price found within 30 days)
5. Rebuild today's snapshot items per user

## Authentication

- `/health` is always public
- `/api/v1/*` can be protected with `API_TOKEN`
- When `API_TOKEN` is set, send either `Authorization: Bearer <token>` or `X-API-Token: <token>`
- The bundled web app uses the Next.js proxy to add the token server-side; the desktop app generates one automatically per launch
- Phone sharing prefers a system-installed `cloudflared`; managed downloads require `CLOUDFLARED_SHA256`

Manual trigger (for backfilling):

```bash
curl -X POST "http://localhost:8000/api/v1/snapshots/trigger?date=2026-03-22" \
  -H "X-User-Id: default-user"
```

---

## Asset Classification

```
Assets
├── liquid
│   ├── bank_account   → fixed pricing
│   ├── physical_cash  → fixed
│   ├── e_wallet       → fixed
│   └── stablecoin     → fixed
├── investment
│   ├── stock / etf    → market (yahoo-finance2)
│   ├── crypto         → market (yahoo-finance2)
│   ├── fund           → manual
│   └── precious_metal → manual
├── fixed
│   ├── real_estate    → manual
│   └── vehicle        → manual
└── receivable         → fixed

Liabilities
└── debt
    ├── credit_card    → fixed
    ├── mortgage       → fixed
    └── personal_loan  → fixed
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_PATH` | No | `./atomfortune.db` | SQLite database file path |
| `TEST_DATABASE_PATH` | No | — | Test database (used by Vitest) |
| `API_TOKEN` | No | unset | Optional shared token for the API and Next.js proxy |
| `CLOUDFLARED_SHA256` | No | unset | SHA256 pin for managed `cloudflared` downloads |
| `SNAPSHOT_SCHEDULE` | No | `0 22 * * *` | Daily snapshot cron expression |
| `PORT` | No | `8000` | API server port |
| `API_ORIGIN` | No | `http://localhost:8000` | Target origin for Next.js API proxy |
| `WEB_ORIGIN` | No | `http://localhost:3000` | Target origin for tunnel |

---

## External Data Sources

All free, no API keys required:

| Source | Usage |
|--------|-------|
| [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) | Stock/ETF/crypto prices and FX rates (daily + historical) |
| [TWSE](https://www.twse.com.tw) | Taiwan stock ticker search |
| [CoinGecko API](https://www.coingecko.com/api/documentation) | Crypto ticker search |
