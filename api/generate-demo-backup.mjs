import { zipSync, strToU8 } from 'fflate'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── IDs ──────────────────────────────────────────────────────────────────────
const U = 'demo-user'  // replaced on import

const A = {
  twd: 'a0001-twd-cash',
  usd: 'a0002-usd-cash',
  aapl: 'a0003-aapl-stock',
  etf00878: 'a0004-00878-etf',
  btc: 'a0005-btc-crypto',
  eth: 'a0006-eth-crypto',
}

const ACC = {
  esun: 'acc01-esun-bank',
  yuanta: 'acc02-yuanta-broker',
  binance: 'acc03-binance-exchange',
}

// ── Assets ────────────────────────────────────────────────────────────────────
const assets = [
  {
    id: A.twd, userId: U,
    name: '活存（TWD）', assetClass: 'asset', category: 'liquid',
    subKind: 'bank_account', symbol: null, market: null,
    currencyCode: 'TWD', pricingMode: 'fixed', unit: 'unit',
  },
  {
    id: A.usd, userId: U,
    name: '活存（USD）', assetClass: 'asset', category: 'liquid',
    subKind: 'bank_account', symbol: null, market: null,
    currencyCode: 'USD', pricingMode: 'fixed', unit: 'unit',
  },
  {
    id: A.aapl, userId: U,
    name: 'Apple Inc.', assetClass: 'asset', category: 'investment',
    subKind: 'stock', symbol: 'AAPL', market: 'NASDAQ',
    currencyCode: 'USD', pricingMode: 'market', unit: 'shares',
  },
  {
    id: A.etf00878, userId: U,
    name: '國泰永續高股息', assetClass: 'asset', category: 'investment',
    subKind: 'etf', symbol: '00878', market: 'TWSE',
    currencyCode: 'TWD', pricingMode: 'market', unit: 'shares',
  },
  {
    id: A.btc, userId: U,
    name: 'Bitcoin', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', symbol: 'BTC', market: null,
    currencyCode: 'USD', pricingMode: 'market', unit: 'unit',
  },
  {
    id: A.eth, userId: U,
    name: 'Ethereum', assetClass: 'asset', category: 'investment',
    subKind: 'crypto', symbol: 'ETH', market: null,
    currencyCode: 'USD', pricingMode: 'market', unit: 'unit',
  },
]

// ── Accounts ──────────────────────────────────────────────────────────────────
const accounts = [
  {
    id: ACC.esun, userId: U,
    name: '玉山銀行', institution: '玉山銀行',
    accountType: 'bank', note: null,
  },
  {
    id: ACC.yuanta, userId: U,
    name: '元大證券', institution: '元大金控',
    accountType: 'broker', note: null,
  },
  {
    id: ACC.binance, userId: U,
    name: 'Binance', institution: 'Binance',
    accountType: 'crypto_exchange', note: null,
  },
]

// ── Holdings ──────────────────────────────────────────────────────────────────
const holdings = [
  { assetId: A.twd, accountId: ACC.esun, userId: U, quantity: '520000' },
  { assetId: A.usd, accountId: ACC.esun, userId: U, quantity: '12500' },
  { assetId: A.aapl, accountId: ACC.yuanta, userId: U, quantity: '50' },
  { assetId: A.etf00878, accountId: ACC.yuanta, userId: U, quantity: '15000' },
  { assetId: A.btc, accountId: ACC.binance, userId: U, quantity: '0.48' },
  { assetId: A.eth, accountId: ACC.binance, userId: U, quantity: '6.2' },
]

// ── Transactions ──────────────────────────────────────────────────────────────
let txnIdx = 1
function txn(assetId, accountId, txnType, quantity, txnDate, note = null) {
  return {
    id: `txn-${String(txnIdx++).padStart(4, '0')}`,
    userId: U, assetId, accountId, txnType, quantity, txnDate, note,
  }
}

const transactions = [
  // TWD cash deposits
  txn(A.twd, ACC.esun, 'deposit', '200000', '2024-01-15', '初始存款'),
  txn(A.twd, ACC.esun, 'deposit', '150000', '2024-04-01', '薪資存入'),
  txn(A.twd, ACC.esun, 'deposit', '100000', '2024-07-01', '薪資存入'),
  txn(A.twd, ACC.esun, 'deposit', '70000', '2024-10-01', '薪資存入'),
  // USD deposits
  txn(A.usd, ACC.esun, 'deposit', '10000', '2024-02-10', '換匯'),
  txn(A.usd, ACC.esun, 'deposit', '2500', '2024-08-20', '換匯'),
  // AAPL purchases
  txn(A.aapl, ACC.yuanta, 'buy', '20', '2024-02-20', '初始買入'),
  txn(A.aapl, ACC.yuanta, 'buy', '15', '2024-05-15', '加倉'),
  txn(A.aapl, ACC.yuanta, 'buy', '15', '2024-09-10', '加倉'),
  // 00878 purchases
  txn(A.etf00878, ACC.yuanta, 'buy', '5000', '2024-01-20', '定期定額'),
  txn(A.etf00878, ACC.yuanta, 'buy', '5000', '2024-04-20', '定期定額'),
  txn(A.etf00878, ACC.yuanta, 'buy', '5000', '2024-07-20', '定期定額'),
  // BTC
  txn(A.btc, ACC.binance, 'buy', '0.3', '2024-03-01', '初始買入'),
  txn(A.btc, ACC.binance, 'buy', '0.18', '2024-10-15', '加倉'),
  // ETH
  txn(A.eth, ACC.binance, 'buy', '4', '2024-03-01', '初始買入'),
  txn(A.eth, ACC.binance, 'buy', '2.2', '2024-11-01', '加倉'),
]

// ── Prices ────────────────────────────────────────────────────────────────────
// Historical prices for market assets
function price(assetId, priceDate, p, source = 'yahoo') {
  return { assetId, priceDate, price: String(p), source }
}

// AAPL price history (USD)
const aaplPrices = [
  ['2024-01-31', 184.4], ['2024-02-29', 181.0], ['2024-03-28', 171.2],
  ['2024-04-30', 170.3], ['2024-05-31', 192.4], ['2024-06-28', 210.6],
  ['2024-07-31', 218.5], ['2024-08-30', 226.8], ['2024-09-30', 233.0],
  ['2024-10-31', 225.9], ['2024-11-29', 237.3], ['2024-12-31', 250.1],
  ['2025-01-31', 247.6], ['2025-02-28', 241.8], ['2025-03-21', 238.5],
].map(([d, p]) => price(A.aapl, d, p))

// 00878 price history (TWD)
const etfPrices = [
  ['2024-01-31', 19.8], ['2024-02-29', 20.1], ['2024-03-28', 21.2],
  ['2024-04-30', 20.8], ['2024-05-31', 21.5], ['2024-06-28', 22.0],
  ['2024-07-31', 21.8], ['2024-08-30', 22.3], ['2024-09-30', 22.1],
  ['2024-10-31', 22.5], ['2024-11-29', 23.0], ['2024-12-31', 22.8],
  ['2025-01-31', 23.2], ['2025-02-28', 23.5], ['2025-03-21', 23.8],
].map(([d, p]) => price(A.etf00878, d, p))

// BTC price history (USD)
const btcPrices = [
  ['2024-01-31', 43500], ['2024-02-29', 61200], ['2024-03-28', 71000],
  ['2024-04-30', 60400], ['2024-05-31', 67800], ['2024-06-28', 62000],
  ['2024-07-31', 65400], ['2024-08-30', 58800], ['2024-09-30', 63500],
  ['2024-10-31', 70200], ['2024-11-29', 96200], ['2024-12-31', 94100],
  ['2025-01-31', 103000], ['2025-02-28', 86000], ['2025-03-21', 84500],
].map(([d, p]) => price(A.btc, d, p))

// ETH price history (USD)
const ethPrices = [
  ['2024-01-31', 2380], ['2024-02-29', 3380], ['2024-03-28', 3650],
  ['2024-04-30', 2960], ['2024-05-31', 3720], ['2024-06-28', 3400],
  ['2024-07-31', 3260], ['2024-08-30', 2570], ['2024-09-30', 2600],
  ['2024-10-31', 2640], ['2024-11-29', 3620], ['2024-12-31', 3380],
  ['2025-01-31', 3180], ['2025-02-28', 2150], ['2025-03-21', 1980],
].map(([d, p]) => price(A.eth, d, p))

const prices = [...aaplPrices, ...etfPrices, ...btcPrices, ...ethPrices]

// ── FX Rates ──────────────────────────────────────────────────────────────────
function fx(from, to, rateDate, rate) {
  return { fromCurrency: from, toCurrency: to, rateDate, rate: String(rate), source: 'yahoo' }
}

const fxDates = [
  ['2024-01-31', 31.2], ['2024-02-29', 31.5], ['2024-03-28', 31.8],
  ['2024-04-30', 32.2], ['2024-05-31', 32.4], ['2024-06-28', 32.8],
  ['2024-07-31', 32.5], ['2024-08-30', 31.9], ['2024-09-30', 31.5],
  ['2024-10-31', 32.1], ['2024-11-29', 32.6], ['2024-12-31', 32.8],
  ['2025-01-31', 33.0], ['2025-02-28', 32.7], ['2025-03-21', 32.4],
]
const fxRates = fxDates.map(([d, r]) => fx('USD', 'TWD', d, r))

// ── Snapshot Items ────────────────────────────────────────────────────────────
function snap(snapshotDate, assetId, accountId, quantity, assetPrice, fxRate, valueInBase) {
  return {
    snapshotDate, assetId, accountId, userId: U,
    quantity: String(quantity),
    price: String(assetPrice),
    fxRate: String(fxRate),
    valueInBase: String(Math.round(valueInBase)),
  }
}

// Monthly snapshots: Jan 2024 → Mar 2025
const snapMonths = [
  { date: '2024-01-31', aaplP: 184.4, etfP: 19.8, btcP: 43500, ethP: 2380, usdTwd: 31.2 },
  { date: '2024-02-29', aaplP: 181.0, etfP: 20.1, btcP: 61200, ethP: 3380, usdTwd: 31.5 },
  { date: '2024-03-28', aaplP: 171.2, etfP: 21.2, btcP: 71000, ethP: 3650, usdTwd: 31.8 },
  { date: '2024-04-30', aaplP: 170.3, etfP: 20.8, btcP: 60400, ethP: 2960, usdTwd: 32.2 },
  { date: '2024-05-31', aaplP: 192.4, etfP: 21.5, btcP: 67800, ethP: 3720, usdTwd: 32.4 },
  { date: '2024-06-28', aaplP: 210.6, etfP: 22.0, btcP: 62000, ethP: 3400, usdTwd: 32.8 },
  { date: '2024-07-31', aaplP: 218.5, etfP: 21.8, btcP: 65400, ethP: 3260, usdTwd: 32.5 },
  { date: '2024-08-30', aaplP: 226.8, etfP: 22.3, btcP: 58800, ethP: 2570, usdTwd: 31.9 },
  { date: '2024-09-30', aaplP: 233.0, etfP: 22.1, btcP: 63500, ethP: 2600, usdTwd: 31.5 },
  { date: '2024-10-31', aaplP: 225.9, etfP: 22.5, btcP: 70200, ethP: 2640, usdTwd: 32.1 },
  { date: '2024-11-29', aaplP: 237.3, etfP: 23.0, btcP: 96200, ethP: 3620, usdTwd: 32.6 },
  { date: '2024-12-31', aaplP: 250.1, etfP: 22.8, btcP: 94100, ethP: 3380, usdTwd: 32.8 },
  { date: '2025-01-31', aaplP: 247.6, etfP: 23.2, btcP: 103000, ethP: 3180, usdTwd: 33.0 },
  { date: '2025-02-28', aaplP: 241.8, etfP: 23.5, btcP: 86000, ethP: 2150, usdTwd: 32.7 },
  { date: '2025-03-21', aaplP: 238.5, etfP: 23.8, btcP: 84500, ethP: 1980, usdTwd: 32.4 },
]

const snapshotItems = snapMonths.flatMap(({ date, aaplP, etfP, btcP, ethP, usdTwd }) => [
  snap(date, A.twd, ACC.esun, 520000, 1, 1, 520000),
  snap(date, A.usd, ACC.esun, 12500, 1, usdTwd, 12500 * usdTwd),
  snap(date, A.aapl, ACC.yuanta, 50, aaplP, usdTwd, 50 * aaplP * usdTwd),
  snap(date, A.etf00878, ACC.yuanta, 15000, etfP, 1, 15000 * etfP),
  snap(date, A.btc, ACC.binance, 0.48, btcP, usdTwd, 0.48 * btcP * usdTwd),
  snap(date, A.eth, ACC.binance, 6.2, ethP, usdTwd, 6.2 * ethP * usdTwd),
])

// ── Assemble & Zip ────────────────────────────────────────────────────────────
const payload = {
  version: '2',
  exportedAt: '2025-03-24T00:00:00.000Z',
  data: {
    assets,
    accounts,
    holdings,
    transactions,
    prices,
    fxRates,
    snapshotItems,
    recurringEntries: [],
  },
}

const jsonStr = JSON.stringify(payload, null, 2)
const filename = 'atomfortune-demo-backup-2025-03-24.json'
const zipped = zipSync({ [filename]: strToU8(jsonStr) })

const outPath = join(__dirname, '..', 'atomfortune-demo-backup.zip')
writeFileSync(outPath, zipped)
console.log(`Created: ${outPath}`)
console.log(`Assets: ${assets.length}, Accounts: ${accounts.length}, Holdings: ${holdings.length}`)
console.log(`Transactions: ${transactions.length}, Snapshots: ${snapshotItems.length}`)
