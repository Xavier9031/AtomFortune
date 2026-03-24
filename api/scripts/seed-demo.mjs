/**
 * Demo data seed script — Real Market Data + Life Story Edition
 * Run from the api/ directory: node scripts/seed-demo.mjs
 *
 * Story: A salaried worker who spends a year saving up, buys their first home,
 * and continues DCA investing while rebuilding emergency fund post-purchase.
 *
 * Key events:
 *   - 2025-03-24 ~ 2025-06-30: Saving hard for down payment (3.8M → 4.5M TWD)
 *   - 2025-07-01: Mid-year bonus +300K TWD
 *   - 2025-07-15: 🏠 Buys apartment — 4,400,000 down payment, 10,500,000 mortgage
 *   - Monthly salary: +120K TWD; mortgage payment: -45K; net +75K/month
 *   - 2026-01-01: Year-end bonus +325K TWD
 *   - Monthly BTC DCA: 0.03 BTC/month
 *   - Quarterly 0050 ETF DCA: 1,000 shares/quarter
 *   - Occasional TSMC, NVDA, ETH, Gold purchases
 */

import postgres from 'postgres'

const DB_URL = process.env.DATABASE_URL
  ?? 'postgres://atomfortune:atomfortune@localhost:5432/atomfortune'

const sql = postgres(DB_URL)

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

const ACC = {
  bank1:   '11111111-0000-4000-0000-000000000001', // 台灣銀行（主帳戶）
  bank2:   '11111111-0000-4000-0000-000000000002', // 國泰世華銀行（外幣）
  broker:  '11111111-0000-4000-0000-000000000003', // 永豐金證券
  crypto:  '11111111-0000-4000-0000-000000000004', // Binance
  misc:    '11111111-0000-4000-0000-000000000005', // 個人帳戶（房產・黃金）
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

// ─── Date utilities ───────────────────────────────────────────────────────────

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
      map.set(new Date(timestamps[i] * 1000).toISOString().slice(0, 10), closes[i])
    }
  }
  return map
}

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
// Each array = sorted [date, cumulative_qty] pairs.
// qtyOn(assetId, date) returns the quantity as of that date.
//
// ── TWD savings story ──
//   Phase 1 (Mar–Jun 2025): Saving up for house down payment
//     Monthly: +120K salary − 50K living = +70K/month
//   Phase 2 (Jul 1): Mid-year bonus +300K → total ~4.5M
//   Phase 3 (Jul 15): 🏠 Down payment −4,400,000 → drops to ~180K
//   Phase 4 (Jul–Dec): Rebuild with salary − mortgage payment
//     Monthly: +120K salary − 50K living − 45K mortgage = +25K/month
//   Phase 5 (Jan 2026): Year-end bonus +325K

const STEPS = {
  [ASS.twd]: [
    ['2025-03-24', 3_800_000],
    ['2025-04-01', 3_940_000],  // Apr salary
    ['2025-05-01', 4_080_000],  // May salary
    ['2025-06-01', 4_220_000],  // Jun salary
    ['2025-07-01', 4_520_000],  // Jul salary + mid-year bonus 300K
    ['2025-07-15',   120_000],  // 🏠 paid 4,400,000 down payment + closing costs
    ['2025-08-01',   195_000],  // Aug net: +75K (salary 120K − living 50K − mortgage 45K + rounding)
    ['2025-09-01',   270_000],
    ['2025-10-01',   345_000],
    ['2025-11-01',   420_000],
    ['2025-12-01',   495_000],
    ['2026-01-01',   895_000],  // Jan: +75K + year-end bonus 325K
    ['2026-02-01',   970_000],
    ['2026-03-01', 1_045_000],
  ],

  // USD savings: dips when buying USD-denominated assets
  [ASS.usd]: [
    ['2025-03-24', 18_000],
    ['2025-05-15', 17_100],   // bought NVDA 10 × ~90 USD
    ['2025-11-20', 15_700],   // bought NVDA 10 × ~140 USD
  ],

  // JPY: travel money, stays constant
  [ASS.jpy]: [['2025-03-24', 500_000]],

  // Cash: petty cash, stays constant
  [ASS.cash]: [['2025-03-24', 15_000]],

  // 0050 ETF — quarterly DCA, 1000 shares each
  [ASS.e0050]: [
    ['2025-03-24',    0],
    ['2025-04-10', 1000],   // Q1: 1000 shares
    ['2025-07-10', 2000],   // Q2: +1000
    ['2025-10-10', 3000],   // Q3: +1000
    ['2026-01-10', 4000],   // Q4: +1000
  ],

  // TSMC — blue chip anchor position + 1 add
  [ASS.tsmc]: [
    ['2025-03-24', 200],
    ['2025-09-20', 300],   // +100 after summer dip
    ['2026-02-10', 400],   // +100 new year
  ],

  // NVDA — US tech exposure
  [ASS.nvda]: [
    ['2025-03-24',  0],
    ['2025-05-15', 10],
    ['2025-11-20', 20],
  ],

  // BTC — monthly DCA 0.03/month, already had 0.10
  [ASS.btc]: [
    ['2025-03-24', 0.10],
    ['2025-04-10', 0.13],
    ['2025-05-10', 0.16],
    ['2025-06-10', 0.19],
    ['2025-07-10', 0.22],
    ['2025-08-10', 0.25],
    ['2025-09-10', 0.28],
    ['2025-10-10', 0.31],
    ['2025-11-10', 0.34],
    ['2025-12-10', 0.37],
    ['2026-01-10', 0.40],
    ['2026-02-10', 0.43],
    ['2026-03-10', 0.46],
  ],

  // ETH — occasional buy
  [ASS.eth]: [
    ['2025-03-24', 2.0],
    ['2025-08-20', 3.0],
    ['2025-12-15', 4.0],
  ],

  // 🏠 Real estate: 0 until house purchase, then 14,500,000 TWD
  // (pricingMode=fixed: qty = value, price = 1)
  [ASS.realty]: [
    ['2025-03-24',          0],
    ['2025-07-15', 14_500_000],
  ],

  // 房屋貸款 (liability): 0 until purchase, then paying down ~25K/month
  [ASS.mortgage]: [
    ['2025-03-24',          0],
    ['2025-07-15', 10_500_000],
    ['2025-08-01', 10_475_000],
    ['2025-09-01', 10_450_000],
    ['2025-10-01', 10_425_000],
    ['2025-11-01', 10_400_000],
    ['2025-12-01', 10_375_000],
    ['2026-01-01', 10_350_000],
    ['2026-02-01', 10_325_000],
    ['2026-03-01', 10_300_000],
  ],

  // Gold — inflation hedge, bought twice
  [ASS.gold]: [
    ['2025-03-24',   0],
    ['2025-09-05',  50],
    ['2026-01-20', 100],
  ],
}

function qtyOn(assetId, date) {
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
    ['USDTWD',  'USDTWD=X'],
    ['JPYTWD',  'JPYTWD=X'],
  ]

  const raw = {}
  for (const [key, symbol] of fetches) {
    try {
      const map = await fetchYahoo(symbol)
      raw[key] = forwardFill(map)
      const last = [...raw[key].values()].at(-1)
      console.log(`   ${symbol.padEnd(12)} ${raw[key].size} days  latest: ${last?.toFixed(2)}`)
    } catch (e) {
      console.warn(`   ⚠️  ${symbol}: ${e.message} — using fallback`)
      raw[key] = new Map()
    }
    await sleep(250)
  }

  // Fallbacks
  if (raw['USDTWD'].size < 10) for (const d of ALL_DATES) raw['USDTWD'].set(d, 32.1)
  if (raw['JPYTWD'].size < 10) for (const d of ALL_DATES) raw['JPYTWD'].set(d, 0.212)

  // Gold TWD/gram = GC(USD/oz) × USDTWD / 31.1035
  raw['GOLD_G'] = new Map()
  for (const date of ALL_DATES) {
    const oz = raw['GOLD_OZ'].get(date)
    const fx = raw['USDTWD'].get(date)
    if (oz && fx) raw['GOLD_G'].set(date, +(oz * fx / 31.1035).toFixed(2))
  }

  const PRICE_MAP = {
    [ASS.e0050]: raw['0050'],
    [ASS.tsmc]:  raw['TSMC'],
    [ASS.nvda]:  raw['NVDA'],
    [ASS.btc]:   raw['BTC'],
    [ASS.eth]:   raw['ETH'],
    [ASS.gold]:  raw['GOLD_G'],
  }

  // price = 1 for fixed/liquid assets (qty IS the TWD value or native-currency amount)
  function priceOn(assetId, date) {
    return PRICE_MAP[assetId]?.get(date) ?? 1
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
    (${ACC.bank1},  '台銀活存',   '台灣銀行',    'bank',            '主要往來帳戶・薪資入帳'),
    (${ACC.bank2},  '國泰活存',   '國泰世華銀行', 'bank',            '外幣儲蓄帳戶'),
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
    if (qty === 0) continue  // skip assets not yet held
    await sql`INSERT INTO "holdings" ("assetId", "accountId", quantity)
      VALUES (${assetId}, ${ACCT[assetId]}, ${qty})`
  }

  // ── Transactions ────────────────────────────────────────────────────────────
  console.log('🧾 Inserting transactions…')
  const txns = [
    // TSMC — anchor position
    [txId(1),  ASS.tsmc,  ACC.broker, 'buy',  200,  '2025-03-20', '台積電建倉'],
    [txId(2),  ASS.tsmc,  ACC.broker, 'buy',  100,  '2025-09-20', '逢低加碼'],
    [txId(3),  ASS.tsmc,  ACC.broker, 'buy',  100,  '2026-02-10', '新年加碼'],
    // 0050 ETF — quarterly DCA
    [txId(4),  ASS.e0050, ACC.broker, 'buy', 1000,  '2025-04-10', '定期定額 Q1'],
    [txId(5),  ASS.e0050, ACC.broker, 'buy', 1000,  '2025-07-10', '定期定額 Q2'],
    [txId(6),  ASS.e0050, ACC.broker, 'buy', 1000,  '2025-10-10', '定期定額 Q3'],
    [txId(7),  ASS.e0050, ACC.broker, 'buy', 1000,  '2026-01-10', '定期定額 Q4'],
    // NVDA
    [txId(8),  ASS.nvda,  ACC.broker, 'buy',   10,  '2025-05-15', 'AI 主題建倉'],
    [txId(9),  ASS.nvda,  ACC.broker, 'buy',   10,  '2025-11-20', '加碼'],
    // BTC — monthly DCA 0.03/month
    [txId(10), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-04-10', 'BTC 月定投'],
    [txId(11), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-05-10', 'BTC 月定投'],
    [txId(12), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-06-10', 'BTC 月定投'],
    [txId(13), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-07-10', 'BTC 月定投'],
    [txId(14), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-08-10', 'BTC 月定投'],
    [txId(15), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-09-10', 'BTC 月定投'],
    [txId(16), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-10-10', 'BTC 月定投'],
    [txId(17), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-11-10', 'BTC 月定投'],
    [txId(18), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2025-12-10', 'BTC 月定投'],
    [txId(19), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2026-01-10', 'BTC 月定投'],
    [txId(20), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2026-02-10', 'BTC 月定投'],
    [txId(21), ASS.btc,   ACC.crypto, 'buy', 0.03,  '2026-03-10', 'BTC 月定投'],
    // ETH
    [txId(22), ASS.eth,   ACC.crypto, 'buy',  1.0,  '2025-08-20', 'ETH 加碼'],
    [txId(23), ASS.eth,   ACC.crypto, 'buy',  1.0,  '2025-12-15', 'ETH 逢低買進'],
    // Gold
    [txId(24), ASS.gold,  ACC.misc,   'buy',   50,  '2025-09-05', '購入黃金 50g'],
    [txId(25), ASS.gold,  ACC.misc,   'buy',   50,  '2026-01-20', '加碼黃金 50g'],
  ]
  for (const [id, assetId, accountId, txnType, quantity, txnDate, note] of txns) {
    await sql`INSERT INTO "transactions" (id, "assetId", "accountId", "txnType", quantity, "txnDate", note)
      VALUES (${id}, ${assetId}, ${accountId}, ${txnType}, ${quantity}, ${txnDate}, ${note})`
  }

  // ── Daily market prices ─────────────────────────────────────────────────────
  console.log('📈 Inserting daily market prices…')
  for (const [assetId, priceMap] of Object.entries(PRICE_MAP)) {
    let count = 0
    for (const [date, price] of priceMap) {
      if (price > 0) {
        await sql`
          INSERT INTO "prices" ("assetId", "priceDate", price, source)
          VALUES (${assetId}, ${date}, ${price}, 'yahoo_finance')
          ON CONFLICT ("assetId", "priceDate") DO UPDATE SET price = EXCLUDED.price`
        count++
      }
    }
    console.log(`   ${assetId.slice(-4)}: ${count} rows`)
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
  console.log(`\n📸 Inserting ${ALL_DATES.length} daily snapshots…`)
  const allAssets = Object.values(ASS)
  let snapshotRows = 0

  for (let di = 0; di < ALL_DATES.length; di++) {
    const date = ALL_DATES[di]

    for (const assetId of allAssets) {
      const qty = qtyOn(assetId, date)
      if (qty === 0) continue
      const price = priceOn(assetId, date)
      if (price === 0) continue
      const fx    = fxOn(assetId, date)
      const value = qty * price * fx

      await sql`
        INSERT INTO "snapshotItems"
          ("snapshotDate", "assetId", "accountId", quantity, price, "fxRate", "valueInBase")
        VALUES (${date}, ${assetId}, ${ACCT[assetId]}, ${qty}, ${price}, ${fx}, ${value})
        ON CONFLICT ("snapshotDate", "assetId", "accountId")
        DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price,
                      "fxRate" = EXCLUDED."fxRate", "valueInBase" = EXCLUDED."valueInBase"`
      snapshotRows++
    }

    if (di % 30 === 0 || di === ALL_DATES.length - 1) {
      process.stdout.write(`   ${date}  (${di + 1}/${ALL_DATES.length})\n`)
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const lastDate = END_DATE
  const totalAssets = allAssets
    .filter(id => id !== ASS.mortgage)
    .reduce((s, id) => s + qtyOn(id, lastDate) * priceOn(id, lastDate) * fxOn(id, lastDate), 0)
  const totalLiab = qtyOn(ASS.mortgage, lastDate)

  console.log('\n✅ Seed complete!')
  console.log(`   Date range:    ${ALL_DATES[0]} → ${lastDate} (${ALL_DATES.length} days)`)
  console.log(`   Snapshot rows: ${snapshotRows.toLocaleString()}`)
  console.log(`   Total assets:  ${Math.round(totalAssets).toLocaleString()} TWD`)
  console.log(`   Liabilities:   ${totalLiab.toLocaleString()} TWD`)
  console.log(`   Net worth:     ${Math.round(totalAssets - totalLiab).toLocaleString()} TWD`)

  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
