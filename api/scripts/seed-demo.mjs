/**
 * Demo data seed script
 * Run from the api/ directory:  node scripts/seed-demo.mjs
 *
 * Clears all user data then inserts a realistic demo portfolio:
 *   5 accounts · 11 assets · 11 holdings · 15 transactions
 *   365 days of market prices · 365 snapshot dates
 */

import postgres from 'postgres'

const DB_URL = process.env.DATABASE_URL
  ?? 'postgres://atomfortune:atomfortune@localhost:5432/atomfortune'

const sql = postgres(DB_URL)

// ─── Fixed IDs (deterministic so script is idempotent) ───────────────────────

const ACC = {
  bank1:   '11111111-0000-4000-0000-000000000001', // 台灣銀行
  bank2:   '11111111-0000-4000-0000-000000000002', // 國泰世華銀行
  broker:  '11111111-0000-4000-0000-000000000003', // 永豐金證券
  crypto:  '11111111-0000-4000-0000-000000000004', // Binance
  misc:    '11111111-0000-4000-0000-000000000005', // 個人帳戶
}

const ASS = {
  twd:     '22222222-0000-4000-0000-000000000001', // 台幣活存
  usd:     '22222222-0000-4000-0000-000000000002', // 美元活存
  jpy:     '22222222-0000-4000-0000-000000000003', // 日幣活存
  cash:    '22222222-0000-4000-0000-000000000004', // 現金
  e0050:   '22222222-0000-4000-0000-000000000005', // 元大台灣50
  tsmc:    '22222222-0000-4000-0000-000000000006', // 台積電
  nvda:    '22222222-0000-4000-0000-000000000007', // NVIDIA
  btc:     '22222222-0000-4000-0000-000000000008', // 比特幣
  eth:     '22222222-0000-4000-0000-000000000009', // 以太幣
  realty:  '22222222-0000-4000-0000-000000000010', // 台北市公寓
  mortgage:'22222222-0000-4000-0000-000000000011', // 房屋貸款
}

// ─── Seeded price generation ──────────────────────────────────────────────────

// Linear Congruential Generator for deterministic "randomness"
function makeLCG(seed) {
  let s = seed >>> 0
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/**
 * Generate `n` daily prices using geometric Brownian motion.
 * Prices drift from `start` toward `end` over the period, with daily
 * volatility `vol` (fraction, e.g. 0.015 = 1.5%).
 */
function genSeries(start, end, n, vol, seed) {
  const rand = makeLCG(seed)
  const logDrift = Math.log(end / start) / n
  const prices = [start]
  for (let i = 1; i < n; i++) {
    const noise = (rand() - 0.5) * 2 * vol
    prices.push(+(prices[i - 1] * Math.exp(logDrift + noise)).toFixed(2))
  }
  return prices
}

// ─── 365 days: 2025-03-25 → 2026-03-24 ──────────────────────────────────────

const N = 365
const START_DATE = '2025-03-25'

function addDays(base, n) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const DATES = Array.from({ length: N }, (_, i) => addDays(START_DATE, i))

// Market story: strong bull run 2025, slight correction 2026 Q1
const PRICES_0050 = genSeries(130,  175,  N, 0.013, 1001)  // TWD ETF
const PRICES_TSMC = genSeries(695,  850,  N, 0.015, 1002)  // TWD stock
const PRICES_NVDA = genSeries(65,   116,  N, 0.022, 1003)  // USD — AI boom
const PRICES_BTC  = genSeries(55000,88000,N, 0.028, 1004)  // USD — crypto bull
const PRICES_ETH  = genSeries(1800, 2800, N, 0.025, 1005)  // USD

const USD_TWD = 32.1
const JPY_TWD = 0.212

// ─── Holdings (current quantities) ───────────────────────────────────────────

const HOLD_QTY = {
  [ASS.twd]:      620000,
  [ASS.usd]:       15000,
  [ASS.jpy]:      450000,
  [ASS.cash]:      12000,
  [ASS.e0050]:      3000,
  [ASS.tsmc]:        500,
  [ASS.nvda]:         20,
  [ASS.btc]:        0.15,
  [ASS.eth]:         5.0,
  [ASS.realty]:  15800000,
  [ASS.mortgage]: 6500000,
}

function txId(n) {
  return `33333333-0000-4000-0000-${String(n).padStart(12, '0')}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑  Clearing existing user data…')
  await sql`DELETE FROM "snapshotItems"`
  await sql`DELETE FROM "prices"`
  await sql`DELETE FROM "transactions"`
  await sql`DELETE FROM "holdings"`
  await sql`DELETE FROM "fxRates"`
  await sql`DELETE FROM "assets"`
  await sql`DELETE FROM "accounts"`
  console.log('   Done.')

  // ── Accounts ───────────────────────────────────────────────────────────────
  console.log('🏦 Inserting accounts…')
  await sql`INSERT INTO "accounts" (id, name, institution, "accountType", note) VALUES
    (${ACC.bank1},  '台銀活存',   '台灣銀行',    'bank',            '主要往來帳戶'),
    (${ACC.bank2},  '國泰活存',   '國泰世華銀行', 'bank',            '儲蓄帳戶'),
    (${ACC.broker}, '永豐金證券', '永豐金證券',   'broker',          '台股交割帳戶'),
    (${ACC.crypto}, 'Binance',    'Binance',      'crypto_exchange', '加密貨幣交易所'),
    (${ACC.misc},   '個人帳戶',   null,           'other',           '現金與不動產')`

  // ── Assets ─────────────────────────────────────────────────────────────────
  console.log('📦 Inserting assets…')
  await sql`INSERT INTO "assets"
    (id, name, "assetClass", category, "subKind", symbol, "currencyCode", "pricingMode", unit)
  VALUES
    (${ASS.twd},      '台幣活存',    'asset',     'liquid',     'bank_account',  null,     'TWD', 'fixed',  '元'),
    (${ASS.usd},      '美元活存',    'asset',     'liquid',     'bank_account',  null,     'USD', 'fixed',  '元'),
    (${ASS.jpy},      '日幣活存',    'asset',     'liquid',     'bank_account',  null,     'JPY', 'fixed',  '元'),
    (${ASS.cash},     '現金',        'asset',     'liquid',     'physical_cash', null,     'TWD', 'fixed',  '元'),
    (${ASS.e0050},    '元大台灣50',  'asset',     'investment', 'etf',           '0050.TW','TWD', 'market', '股'),
    (${ASS.tsmc},     '台積電',      'asset',     'investment', 'stock',         '2330.TW','TWD', 'market', '股'),
    (${ASS.nvda},     'NVIDIA',      'asset',     'investment', 'stock',         'NVDA',   'USD', 'market', '股'),
    (${ASS.btc},      '比特幣',      'asset',     'investment', 'crypto',        'BTC',    'USD', 'market', '枚'),
    (${ASS.eth},      '以太幣',      'asset',     'investment', 'crypto',        'ETH',    'USD', 'market', '枚'),
    (${ASS.realty},   '台北市公寓',  'asset',     'fixed',      'real_estate',   null,     'TWD', 'fixed',  '戶'),
    (${ASS.mortgage}, '房屋貸款',    'liability', 'debt',       'mortgage',      null,     'TWD', 'fixed',  '元')`

  // ── Holdings ───────────────────────────────────────────────────────────────
  console.log('💼 Inserting holdings…')
  await sql`INSERT INTO "holdings" ("assetId", "accountId", quantity) VALUES
    (${ASS.twd},      ${ACC.bank1},  ${HOLD_QTY[ASS.twd]}),
    (${ASS.usd},      ${ACC.bank2},  ${HOLD_QTY[ASS.usd]}),
    (${ASS.jpy},      ${ACC.bank2},  ${HOLD_QTY[ASS.jpy]}),
    (${ASS.cash},     ${ACC.misc},   ${HOLD_QTY[ASS.cash]}),
    (${ASS.e0050},    ${ACC.broker}, ${HOLD_QTY[ASS.e0050]}),
    (${ASS.tsmc},     ${ACC.broker}, ${HOLD_QTY[ASS.tsmc]}),
    (${ASS.nvda},     ${ACC.broker}, ${HOLD_QTY[ASS.nvda]}),
    (${ASS.btc},      ${ACC.crypto}, ${HOLD_QTY[ASS.btc]}),
    (${ASS.eth},      ${ACC.crypto}, ${HOLD_QTY[ASS.eth]}),
    (${ASS.realty},   ${ACC.misc},   ${HOLD_QTY[ASS.realty]}),
    (${ASS.mortgage}, ${ACC.misc},   ${HOLD_QTY[ASS.mortgage]})`

  // ── Transactions ───────────────────────────────────────────────────────────
  console.log('🧾 Inserting transactions…')
  const txns = [
    [txId(1),  ASS.e0050, ACC.broker, 'buy',   500,  '2025-06-10', '定期定額 #1'],
    [txId(2),  ASS.e0050, ACC.broker, 'buy',   500,  '2025-09-12', '定期定額 #2'],
    [txId(3),  ASS.e0050, ACC.broker, 'buy',  1000,  '2025-12-05', '年終加碼'],
    [txId(4),  ASS.e0050, ACC.broker, 'buy',  1000,  '2026-02-15', '定期定額 #3'],
    [txId(5),  ASS.tsmc,  ACC.broker, 'buy',   200,  '2025-03-20', '初始建倉'],
    [txId(6),  ASS.tsmc,  ACC.broker, 'buy',   200,  '2025-08-18', '逢低加碼'],
    [txId(7),  ASS.tsmc,  ACC.broker, 'buy',   100,  '2026-01-08', '新年加碼'],
    [txId(8),  ASS.nvda,  ACC.broker, 'buy',    10,  '2025-05-15', 'AI theme buy'],
    [txId(9),  ASS.nvda,  ACC.broker, 'buy',    10,  '2025-11-20', 'Add position'],
    [txId(10), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-04-10', 'First purchase'],
    [txId(11), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-08-22', 'DCA'],
    [txId(12), ASS.btc,   ACC.crypto, 'buy',  0.05,  '2025-12-01', 'DCA'],
    [txId(13), ASS.eth,   ACC.crypto, 'buy',   2.0,  '2025-04-15', 'Initial ETH'],
    [txId(14), ASS.eth,   ACC.crypto, 'buy',   2.0,  '2025-09-30', 'Add ETH'],
    [txId(15), ASS.eth,   ACC.crypto, 'buy',   1.0,  '2026-02-01', 'ETH dip buy'],
  ]
  for (const [id, assetId, accountId, txnType, quantity, txnDate, note] of txns) {
    await sql`INSERT INTO "transactions" (id, "assetId", "accountId", "txnType", quantity, "txnDate", note)
      VALUES (${id}, ${assetId}, ${accountId}, ${txnType}, ${quantity}, ${txnDate}, ${note})`
  }

  // ── Market prices ──────────────────────────────────────────────────────────
  console.log('📈 Inserting 365 days of market prices…')
  const priceData = [
    [ASS.e0050, PRICES_0050, 'seed'],
    [ASS.tsmc,  PRICES_TSMC, 'seed'],
    [ASS.nvda,  PRICES_NVDA, 'seed'],
    [ASS.btc,   PRICES_BTC,  'seed'],
    [ASS.eth,   PRICES_ETH,  'seed'],
  ]
  for (const [assetId, series, source] of priceData) {
    for (let i = 0; i < DATES.length; i++) {
      await sql`
        INSERT INTO "prices" ("assetId", "priceDate", price, source)
        VALUES (${assetId}, ${DATES[i]}, ${series[i]}, ${source})
        ON CONFLICT ("assetId", "priceDate") DO UPDATE SET price = EXCLUDED.price`
    }
  }

  // ── FX rates ───────────────────────────────────────────────────────────────
  console.log('💱 Inserting FX rates…')
  for (const date of DATES) {
    for (const [from, rate] of [['USD', USD_TWD], ['JPY', JPY_TWD]]) {
      await sql`
        INSERT INTO "fxRates" ("fromCurrency", "toCurrency", "rateDate", rate, source)
        VALUES (${from}, 'TWD', ${date}, ${rate}, 'seed')
        ON CONFLICT ("fromCurrency", "toCurrency", "rateDate") DO NOTHING`
    }
  }

  // ── Snapshot items (365 dates × 11 holdings) ───────────────────────────────
  console.log('📸 Inserting 365 days of snapshots…')

  const snapHoldings = [
    { assetId: ASS.twd,      accountId: ACC.bank1,  qty: HOLD_QTY[ASS.twd],      priceFn: () => 1,         fx: 1 },
    { assetId: ASS.usd,      accountId: ACC.bank2,  qty: HOLD_QTY[ASS.usd],      priceFn: () => 1,         fx: USD_TWD },
    { assetId: ASS.jpy,      accountId: ACC.bank2,  qty: HOLD_QTY[ASS.jpy],      priceFn: () => 1,         fx: JPY_TWD },
    { assetId: ASS.cash,     accountId: ACC.misc,   qty: HOLD_QTY[ASS.cash],     priceFn: () => 1,         fx: 1 },
    { assetId: ASS.e0050,    accountId: ACC.broker, qty: HOLD_QTY[ASS.e0050],    priceFn: i => PRICES_0050[i], fx: 1 },
    { assetId: ASS.tsmc,     accountId: ACC.broker, qty: HOLD_QTY[ASS.tsmc],     priceFn: i => PRICES_TSMC[i], fx: 1 },
    { assetId: ASS.nvda,     accountId: ACC.broker, qty: HOLD_QTY[ASS.nvda],     priceFn: i => PRICES_NVDA[i], fx: USD_TWD },
    { assetId: ASS.btc,      accountId: ACC.crypto, qty: HOLD_QTY[ASS.btc],      priceFn: i => PRICES_BTC[i],  fx: USD_TWD },
    { assetId: ASS.eth,      accountId: ACC.crypto, qty: HOLD_QTY[ASS.eth],      priceFn: i => PRICES_ETH[i],  fx: USD_TWD },
    { assetId: ASS.realty,   accountId: ACC.misc,   qty: HOLD_QTY[ASS.realty],   priceFn: () => 1,         fx: 1 },
    { assetId: ASS.mortgage, accountId: ACC.misc,   qty: HOLD_QTY[ASS.mortgage], priceFn: () => 1,         fx: 1 },
  ]

  // Batch inserts in chunks of 50 dates to avoid overwhelming the connection
  const CHUNK = 50
  for (let chunk = 0; chunk < DATES.length; chunk += CHUNK) {
    const slice = DATES.slice(chunk, chunk + CHUNK)
    for (let j = 0; j < slice.length; j++) {
      const i = chunk + j
      const date = slice[j]
      for (const h of snapHoldings) {
        const price = h.priceFn(i)
        const valueInBase = h.qty * price * h.fx
        await sql`
          INSERT INTO "snapshotItems"
            ("snapshotDate", "assetId", "accountId", quantity, price, "fxRate", "valueInBase")
          VALUES (${date}, ${h.assetId}, ${h.accountId},
                  ${h.qty}, ${price}, ${h.fx}, ${valueInBase})
          ON CONFLICT ("snapshotDate", "assetId", "accountId")
          DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price,
                        "fxRate" = EXCLUDED."fxRate", "valueInBase" = EXCLUDED."valueInBase"`
      }
    }
    console.log(`   Snapshots: ${Math.min(chunk + CHUNK, DATES.length)}/${DATES.length}`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const lastIdx = N - 1
  const totalAssets = snapHoldings
    .filter(h => h.assetId !== ASS.mortgage)
    .reduce((s, h) => s + h.qty * h.priceFn(lastIdx) * h.fx, 0)
  const totalLiab = HOLD_QTY[ASS.mortgage]

  console.log('\n✅ Seed complete!')
  console.log(`   Date range:      ${DATES[0]} → ${DATES[lastIdx]}`)
  console.log(`   Total assets:    ${Math.round(totalAssets).toLocaleString()} TWD`)
  console.log(`   Liabilities:     ${totalLiab.toLocaleString()} TWD`)
  console.log(`   Net worth:       ${Math.round(totalAssets - totalLiab).toLocaleString()} TWD`)

  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
