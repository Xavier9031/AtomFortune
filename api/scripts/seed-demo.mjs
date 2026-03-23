/**
 * Demo data seed script — Real Market Data Edition
 * Run from the api/ directory: node scripts/seed-demo.mjs
 *
 * Fetches 1 year of real prices from Yahoo Finance, then simulates
 * a user who makes daily portfolio snapshots for one full year.
 *
 * 5 accounts · 12 assets · 365 daily snapshots · real market prices
 */

import postgres from 'postgres'

const DB_URL = process.env.DATABASE_URL
  ?? 'postgres://atomfortune:atomfortune@localhost:5432/atomfortune'

const sql = postgres(DB_URL)

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

const ACC = {
  bank1:   '11111111-0000-4000-0000-000000000001',
  bank2:   '11111111-0000-4000-0000-000000000002',
  broker:  '11111111-0000-4000-0000-000000000003',
  crypto:  '11111111-0000-4000-0000-000000000004',
  misc:    '11111111-0000-4000-0000-000000000005',
}

const ASS = {
  twd:     '22222222-0000-4000-0000-000000000001',
  usd:     '22222222-0000-4000-0000-000000000002',
  jpy:     '22222222-0000-4000-0000-000000000003',
  cash:    '22222222-0000-4000-0000-000000000004',
  e0050:   '22222222-0000-4000-0000-000000000005',
  tsmc:    '22222222-0000-4000-0000-000000000006',
  nvda:    '22222222-0000-4000-0000-000000000007',
  btc:     '22222222-0000-4000-0000-000000000008',
  eth:     '22222222-0000-4000-0000-000000000009',
  realty:  '22222222-0000-4000-0000-000000000010',
  mortgage:'22222222-0000-4000-0000-000000000011',
  gold:    '22222222-0000-4000-0000-000000000012',
}

// Account for each asset
const ACCT = {
  [ASS.twd]:      ACC.bank1,
  [ASS.usd]:      ACC.bank2,
  [ASS.jpy]:      ACC.bank2,
  [ASS.cash]:     ACC.misc,
  [ASS.e0050]:    ACC.broker,
  [ASS.tsmc]:     ACC.broker,
  [ASS.nvda]:     ACC.broker,
  [ASS.btc]:      ACC.crypto,
  [ASS.eth]:      ACC.crypto,
  [ASS.realty]:   ACC.misc,
  [ASS.mortgage]: ACC.misc,
  [ASS.gold]:     ACC.misc,
}

// ─── Date range ────────────────────────────────────────────────────────────────

const START_DATE = '2025-03-24'
const END_DATE   = '2026-03-24'

function dateRange(start, end) {
  const dates = []
  const d = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

const ALL_DATES = dateRange(START_DATE, END_DATE)

// ─── Yahoo Finance fetch ──────────────────────────────────────────────────────

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(JSON.stringify(json?.chart?.error ?? 'no result'))

  const timestamps = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []

  const map = new Map()
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
      map.set(date, closes[i])
    }
  }
  return map
}

// Forward-fill: for each calendar date, use the most recent known price
function forwardFill(priceMap) {
  const result = new Map()
  let last = null
  for (const date of ALL_DATES) {
    if (priceMap.has(date)) last = priceMap.get(date)
    if (last != null) result.set(date, last)
  }
  return result
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Quantity step functions ──────────────────────────────────────────────────
//
// Portfolio story (same human, same DCA plan as before):
//   - Starts with 1.05M TWD savings + 12M property + 6.8M mortgage
//   - Gradually builds investments by shifting cash → securities
//   - Mortgage pays down ~25K/month automatically
//
// Each entry: [date_from_inclusive, cumulative_quantity]

const STEPS = {
  [ASS.twd]: [
    ['2025-03-24', 1050000],
    ['2025-06-10',  930000],  // bought 0050 #1
    ['2025-08-18',  850000],  // bought TSMC #2
    ['2025-09-12',  810000],  // bought 0050 #2
    ['2025-12-05',  710000],  // bought 0050 #3
    ['2026-01-08',  680000],  // bought TSMC #3
    ['2026-02-15',  620000],  // bought 0050 #4
  ],
  [ASS.usd]:   [['2025-03-24', 15000]],
  [ASS.jpy]:   [['2025-03-24', 450000]],
  [ASS.cash]:  [['2025-03-24', 12000]],
  [ASS.e0050]: [
    ['2025-03-24',    0],
    ['2025-06-10',  500],
    ['2025-09-12', 1000],
    ['2025-12-05', 2000],
    ['2026-02-15', 3000],
  ],
  [ASS.tsmc]:  [
    ['2025-03-24', 200],
    ['2025-08-18', 400],
    ['2026-01-08', 500],
  ],
  [ASS.nvda]:  [['2025-03-24', 0], ['2025-05-15', 10], ['2025-11-20', 20]],
  [ASS.btc]:   [['2025-03-24', 0], ['2025-04-10', 0.05], ['2025-08-22', 0.10], ['2025-12-01', 0.15]],
  [ASS.eth]:   [['2025-03-24', 0], ['2025-04-15', 2.0], ['2025-09-30', 4.0], ['2026-02-01', 5.0]],
  [ASS.realty]:[['2025-03-24', 15800000]],
  [ASS.gold]:  [['2025-03-24', 0], ['2025-05-20', 30], ['2025-09-15', 60], ['2026-01-10', 100]],
}

function qtyOn(assetId, date) {
  if (assetId === ASS.mortgage) {
    // Linear paydown: 6,800,000 → 6,500,000 over the year
    const t = (new Date(date) - new Date(START_DATE)) / (new Date(END_DATE) - new Date(START_DATE))
    return Math.round(6800000 - t * 300000)
  }
  const steps = STEPS[assetId]
  if (!steps) return 0
  let qty = 0
  for (const [d, q] of steps) {
    if (d <= date) qty = q
    else break
  }
  return qty
}

function txId(n) {
  return `33333333-0000-4000-0000-${String(n).padStart(12, '0')}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Fetch market data ───────────────────────────────────────────────────────
  console.log('📡 Fetching real market data from Yahoo Finance…')

  const fetches = [
    ['0050',    '0050.TW'],
    ['TSMC',    '2330.TW'],
    ['NVDA',    'NVDA'],
    ['BTC',     'BTC-USD'],
    ['ETH',     'ETH-USD'],
    ['GOLD_OZ', 'GC=F'],       // USD per troy oz
    ['USDTWD',  'USDTWD=X'],   // TWD per 1 USD
    ['JPYTWD',  'JPYTWD=X'],   // TWD per 1 JPY
  ]

  const raw = {}
  for (const [key, symbol] of fetches) {
    try {
      const map = await fetchYahoo(symbol)
      raw[key] = forwardFill(map)
      const last = [...raw[key].values()].at(-1)
      console.log(`   ${symbol.padEnd(12)} ${raw[key].size} days  latest: ${last?.toFixed(2)}`)
    } catch (e) {
      console.warn(`   ⚠️  ${symbol}: ${e.message} — will use fallback`)
      raw[key] = new Map()
    }
    await sleep(250)
  }

  // Fallbacks
  if (raw['USDTWD'].size < 10) {
    console.log('   Using fallback USD/TWD = 32.1')
    for (const d of ALL_DATES) raw['USDTWD'].set(d, 32.1)
  }
  if (raw['JPYTWD'].size < 10) {
    console.log('   Using fallback JPY/TWD = 0.212')
    for (const d of ALL_DATES) raw['JPYTWD'].set(d, 0.212)
  }

  // Compute gold price in TWD/gram = GC(USD/oz) × USDTWD / 31.1035
  raw['GOLD_TWD_G'] = new Map()
  for (const date of ALL_DATES) {
    const oz   = raw['GOLD_OZ'].get(date)
    const fx   = raw['USDTWD'].get(date)
    if (oz && fx) raw['GOLD_TWD_G'].set(date, +(oz * fx / 31.1035).toFixed(2))
  }

  // Lookup helpers
  const PRICE_MAP = {
    [ASS.e0050]: raw['0050'],
    [ASS.tsmc]:  raw['TSMC'],
    [ASS.nvda]:  raw['NVDA'],
    [ASS.btc]:   raw['BTC'],
    [ASS.eth]:   raw['ETH'],
    [ASS.gold]:  raw['GOLD_TWD_G'],
  }

  function priceOn(assetId, date) {
    return PRICE_MAP[assetId]?.get(date) ?? 1  // liquid/fixed/manual → price = 1 (quantity is the amount)
  }

  function fxOn(assetId, date) {
    if ([ASS.usd, ASS.nvda, ASS.btc, ASS.eth].includes(assetId))
      return raw['USDTWD'].get(date) ?? 32.1
    if (assetId === ASS.jpy)
      return raw['JPYTWD'].get(date) ?? 0.212
    return 1
  }

  // ── Clear ───────────────────────────────────────────────────────────────────
  console.log('\n🗑  Clearing existing data…')
  await sql`DELETE FROM "snapshotItems"`
  await sql`DELETE FROM "prices"`
  await sql`DELETE FROM "transactions"`
  await sql`DELETE FROM "holdings"`
  await sql`DELETE FROM "fxRates"`
  await sql`DELETE FROM "assets"`
  await sql`DELETE FROM "accounts"`
  console.log('   Done.')

  // ── Accounts ────────────────────────────────────────────────────────────────
  console.log('🏦 Inserting accounts…')
  await sql`INSERT INTO "accounts" (id, name, institution, "accountType", note) VALUES
    (${ACC.bank1},  '台銀活存',   '台灣銀行',    'bank',            '主要往來帳戶'),
    (${ACC.bank2},  '國泰活存',   '國泰世華銀行', 'bank',            '儲蓄帳戶'),
    (${ACC.broker}, '永豐金證券', '永豐金證券',   'broker',          '台股交割帳戶'),
    (${ACC.crypto}, 'Binance',    'Binance',      'crypto_exchange', '加密貨幣交易所'),
    (${ACC.misc},   '個人帳戶',   null,           'other',           '現金・不動產・黃金')`

  // ── Assets ──────────────────────────────────────────────────────────────────
  console.log('📦 Inserting assets…')
  await sql`INSERT INTO "assets"
    (id, name, "assetClass", category, "subKind", symbol, "currencyCode", "pricingMode", unit)
  VALUES
    (${ASS.twd},      '台幣活存',    'asset',     'liquid',     'bank_account',  null,     'TWD', 'fixed',  null),
    (${ASS.usd},      '美元活存',    'asset',     'liquid',     'bank_account',  null,     'USD', 'fixed',  null),
    (${ASS.jpy},      '日幣活存',    'asset',     'liquid',     'bank_account',  null,     'JPY', 'fixed',  null),
    (${ASS.cash},     '現金',        'asset',     'liquid',     'physical_cash', null,     'TWD', 'fixed',  null),
    (${ASS.e0050},    '元大台灣50',  'asset',     'investment', 'etf',           '0050.TW','TWD', 'market', 'shares'),
    (${ASS.tsmc},     '台積電',      'asset',     'investment', 'stock',         '2330.TW','TWD', 'market', 'shares'),
    (${ASS.nvda},     'NVIDIA',      'asset',     'investment', 'stock',         'NVDA',   'USD', 'market', 'shares'),
    (${ASS.btc},      '比特幣',      'asset',     'investment', 'crypto',        'BTC',    'USD', 'market', null),
    (${ASS.eth},      '以太幣',      'asset',     'investment', 'crypto',        'ETH',    'USD', 'market', null),
    (${ASS.realty},   '台北市公寓',  'asset',     'fixed',      'real_estate',   null,     'TWD', 'fixed',  'unit'),
    (${ASS.mortgage}, '房屋貸款',    'liability', 'debt',       'mortgage',      null,     'TWD', 'fixed',  null),
    (${ASS.gold},     '黃金',        'asset',     'investment', 'precious_metal',null,     'TWD', 'manual', 'gram')`

  // ── Holdings (final state at END_DATE) ─────────────────────────────────────
  console.log('💼 Inserting holdings…')
  for (const assetId of Object.values(ASS)) {
    const qty = qtyOn(assetId, END_DATE)
    await sql`INSERT INTO "holdings" ("assetId", "accountId", quantity)
      VALUES (${assetId}, ${ACCT[assetId]}, ${qty})`
  }

  // ── Transactions ────────────────────────────────────────────────────────────
  console.log('🧾 Inserting transactions…')
  const txns = [
    [txId(1),  ASS.tsmc,  ACC.broker, 'buy',   200,  '2025-03-20', '初始建倉'],
    [txId(2),  ASS.tsmc,  ACC.broker, 'buy',   200,  '2025-08-18', '逢低加碼'],
    [txId(3),  ASS.tsmc,  ACC.broker, 'buy',   100,  '2026-01-08', '新年加碼'],
    [txId(4),  ASS.e0050, ACC.broker, 'buy',   500,  '2025-06-10', '定期定額 #1'],
    [txId(5),  ASS.e0050, ACC.broker, 'buy',   500,  '2025-09-12', '定期定額 #2'],
    [txId(6),  ASS.e0050, ACC.broker, 'buy',  1000,  '2025-12-05', '年終加碼'],
    [txId(7),  ASS.e0050, ACC.broker, 'buy',  1000,  '2026-02-15', '定期定額 #3'],
    [txId(8),  ASS.nvda,  ACC.broker, 'buy',    10,  '2025-05-15', 'AI 主題建倉'],
    [txId(9),  ASS.nvda,  ACC.broker, 'buy',    10,  '2025-11-20', '加碼'],
    [txId(10), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-04-10', '首次購入'],
    [txId(11), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-08-22', 'DCA'],
    [txId(12), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-12-01', 'DCA'],
    [txId(13), ASS.eth,   ACC.crypto, 'buy',   2.0,  '2025-04-15', '首次購入'],
    [txId(14), ASS.eth,   ACC.crypto, 'buy',   2.0,  '2025-09-30', '加碼'],
    [txId(15), ASS.eth,   ACC.crypto, 'buy',   1.0,  '2026-02-01', '逢低買進'],
    [txId(16), ASS.gold,  ACC.misc,   'buy',    30,  '2025-05-20', '購入實體金條 30g'],
    [txId(17), ASS.gold,  ACC.misc,   'buy',    30,  '2025-09-15', '加碼黃金 30g'],
    [txId(18), ASS.gold,  ACC.misc,   'buy',    40,  '2026-01-10', '新年增持 40g'],
  ]
  for (const [id, assetId, accountId, txnType, quantity, txnDate, note] of txns) {
    await sql`INSERT INTO "transactions" (id, "assetId", "accountId", "txnType", quantity, "txnDate", note)
      VALUES (${id}, ${assetId}, ${accountId}, ${txnType}, ${quantity}, ${txnDate}, ${note})`
  }

  // ── Daily market prices ─────────────────────────────────────────────────────
  console.log('📈 Inserting daily market prices…')
  for (const [assetId, priceMap] of Object.entries(PRICE_MAP)) {
    const rows = []
    for (const [date, price] of priceMap) {
      if (price > 0) rows.push({ assetId, date, price })
    }
    if (rows.length === 0) continue
    // Batch insert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200)
      for (const r of chunk) {
        await sql`
          INSERT INTO "prices" ("assetId", "priceDate", price, source)
          VALUES (${r.assetId}, ${r.date}, ${r.price}, 'yahoo_finance')
          ON CONFLICT ("assetId", "priceDate") DO UPDATE SET price = EXCLUDED.price`
      }
    }
    console.log(`   ${assetId.slice(-4)}: ${rows.length} rows`)
  }

  // ── Daily FX rates ──────────────────────────────────────────────────────────
  console.log('💱 Inserting daily FX rates…')
  for (const date of ALL_DATES) {
    const usdTwd = raw['USDTWD'].get(date)
    const jpyTwd = raw['JPYTWD'].get(date)
    if (usdTwd) {
      await sql`
        INSERT INTO "fxRates" ("fromCurrency", "toCurrency", "rateDate", rate, source)
        VALUES ('USD', 'TWD', ${date}, ${usdTwd}, 'yahoo_finance')
        ON CONFLICT ("fromCurrency", "toCurrency", "rateDate") DO NOTHING`
    }
    if (jpyTwd) {
      await sql`
        INSERT INTO "fxRates" ("fromCurrency", "toCurrency", "rateDate", rate, source)
        VALUES ('JPY', 'TWD', ${date}, ${jpyTwd}, 'yahoo_finance')
        ON CONFLICT ("fromCurrency", "toCurrency", "rateDate") DO NOTHING`
    }
  }

  // ── Daily snapshots ─────────────────────────────────────────────────────────
  console.log(`📸 Inserting ${ALL_DATES.length} daily snapshots…`)
  const allAssets = Object.values(ASS)
  let snapshotCount = 0

  for (let di = 0; di < ALL_DATES.length; di++) {
    const date = ALL_DATES[di]
    const rows = []

    for (const assetId of allAssets) {
      const qty = qtyOn(assetId, date)
      if (qty === 0) continue
      const price = priceOn(assetId, date)
      if (price === 0) continue
      const fx    = fxOn(assetId, date)
      const value = qty * price * fx
      rows.push({ date, assetId, accountId: ACCT[assetId], qty, price, fx, value })
    }

    for (const r of rows) {
      await sql`
        INSERT INTO "snapshotItems"
          ("snapshotDate", "assetId", "accountId", quantity, price, "fxRate", "valueInBase")
        VALUES (${r.date}, ${r.assetId}, ${r.accountId}, ${r.qty}, ${r.price}, ${r.fx}, ${r.value})
        ON CONFLICT ("snapshotDate", "assetId", "accountId")
        DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price,
                      "fxRate" = EXCLUDED."fxRate", "valueInBase" = EXCLUDED."valueInBase"`
    }
    snapshotCount += rows.length

    if (di % 30 === 0 || di === ALL_DATES.length - 1) {
      process.stdout.write(`   ${date}  (${di + 1}/${ALL_DATES.length})\n`)
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const lastDate = ALL_DATES.at(-1)
  const totalAssets = allAssets
    .filter(id => id !== ASS.mortgage)
    .reduce((s, id) => {
      const qty = qtyOn(id, lastDate)
      const price = priceOn(id, lastDate)
      const fx = fxOn(id, lastDate)
      return s + qty * price * fx
    }, 0)
  const totalLiab = qtyOn(ASS.mortgage, lastDate)

  console.log('\n✅ Seed complete!')
  console.log(`   Date range:    ${ALL_DATES[0]} → ${lastDate} (${ALL_DATES.length} days)`)
  console.log(`   Snapshot rows: ${snapshotCount.toLocaleString()}`)
  console.log(`   Total assets:  ${Math.round(totalAssets).toLocaleString()} TWD`)
  console.log(`   Liabilities:   ${totalLiab.toLocaleString()} TWD`)
  console.log(`   Net worth:     ${Math.round(totalAssets - totalLiab).toLocaleString()} TWD`)

  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
