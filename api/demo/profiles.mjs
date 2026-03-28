/**
 * Shared demo data factory.
 * Exports buildAllProfiles() → [{ name, backup }] where backup is a v2 payload
 * ready to POST as JSON to /backup/import.
 *
 * Used by: scripts/seed-demo.mjs
 */

// ── Date helpers ────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function firstOfMonth(monthEnd) {
  return monthEnd.slice(0, 8) + '01'
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000)
}

function dateRange(start, end) {
  const dates = []
  let cur = start
  while (cur <= end) { dates.push(cur); cur = addDays(cur, 1) }
  return dates
}

let _uid = 0
function uid() { return `demo-${String(++_uid).padStart(6, '0')}` }

// ── Monthly anchors ─────────────────────────────────────────────────────────

const MONTHS = [
  '2024-12-31', '2025-01-31', '2025-02-28', '2025-03-31',
  '2025-04-30', '2025-05-31', '2025-06-30', '2025-07-31',
  '2025-08-31', '2025-09-30', '2025-10-31', '2025-11-30',
  '2025-12-31', '2026-01-31',
]

// ── Market prices (monthly anchors) ─────────────────────────────────────────

const P = {
  '0050':  [157, 151, 153, 148, 145, 150, 155, 158, 156, 162, 165, 168, 171, 173],
  '00878': [23.5, 22.8, 23.1, 22.5, 22.0, 22.8, 23.3, 23.8, 23.5, 24.2, 24.5, 24.9, 25.2, 25.5],
  VOO:     [548, 538, 525, 510, 480, 495, 510, 525, 520, 535, 548, 555, 562, 568],
  QQQ:     [522, 508, 495, 480, 450, 470, 488, 503, 497, 515, 528, 537, 545, 552],
  SPY:     [592, 578, 565, 548, 515, 532, 548, 562, 557, 572, 585, 593, 600, 607],
  ETH:     [3500, 3200, 2800, 2500, 2200, 2400, 2600, 2700, 2500, 2800, 3000, 3200, 3400, 3300],
  GOLD:    [2640, 2750, 2900, 3050, 3300, 3350, 3250, 3400, 3500, 3650, 3700, 3600, 3550, 3600],
}

// FX monthly anchors (→ TWD)
const FX_USD = [32.5, 32.8, 32.6, 32.2, 31.8, 31.5, 31.2, 31.0, 31.5, 31.8, 32.0, 32.3, 32.5, 32.0]

// ── Daily price interpolation ───────────────────────────────────────────────

function generateDailyPrices(monthlyPrices, dailyVol = 0.008) {
  const entries = []  // [{ date, price }]
  let prevPrice = monthlyPrices[0]

  for (let i = 0; i < MONTHS.length; i++) {
    const monthEnd = MONTHS[i]
    const monthStart = i === 0 ? firstOfMonth(monthEnd) : addDays(MONTHS[i - 1], 1)
    const target = monthlyPrices[i]
    const days = dateRange(monthStart, monthEnd)

    for (let d = 0; d < days.length; d++) {
      const progress = days.length > 1 ? d / (days.length - 1) : 1
      const trend = prevPrice + (target - prevPrice) * progress
      const noise = 1 + (Math.random() * 2 - 1) * dailyVol
      entries.push({ date: days[d], price: Math.round(trend * noise * 10000) / 10000 })
    }
    prevPrice = target
  }
  return entries
}

function generateDailyFx(monthlyRates) {
  const entries = []
  let prev = monthlyRates[0]
  for (let i = 0; i < MONTHS.length; i++) {
    const monthEnd = MONTHS[i]
    const monthStart = i === 0 ? firstOfMonth(monthEnd) : addDays(MONTHS[i - 1], 1)
    const target = monthlyRates[i]
    const days = dateRange(monthStart, monthEnd)
    for (let d = 0; d < days.length; d++) {
      const progress = days.length > 1 ? d / (days.length - 1) : 1
      const rate = prev + (target - prev) * progress
      entries.push({ date: days[d], rate: Math.round(rate * 10000) / 10000 })
    }
    prev = target
  }
  return entries
}

// Fill from last monthly anchor to today
function extendToToday(entries) {
  const last = entries[entries.length - 1]
  const today = new Date().toISOString().slice(0, 10)
  let cur = addDays(last.date, 1)
  while (cur <= today) {
    entries.push({ date: cur, price: last.price, rate: last.rate })
    cur = addDays(cur, 1)
  }
  return entries
}

// ── Quantity step function ──────────────────────────────────────────────────

function qtyOn(steps, date) {
  let qty = 0
  for (const [d, q] of steps) { if (d <= date) qty = q; else break }
  return qty
}

// ── Profile definitions ─────────────────────────────────────────────────────

function defineProfiles() {
  // Shared daily data (generated once)
  const dailyPrices = {}
  for (const [key, anchors] of Object.entries(P)) {
    dailyPrices[key] = extendToToday(generateDailyPrices(anchors))
  }
  const dailyFxUsd = extendToToday(generateDailyFx(FX_USD))

  // All calendar dates covered
  const allDates = dailyFxUsd.map(e => e.date)
  const fxMap = new Map(dailyFxUsd.map(e => [e.date, e.rate ?? e.price]))

  // Helper: build price rows for an asset
  function priceRows(assetId, key) {
    return dailyPrices[key].map(e => ({
      assetId, priceDate: e.date, price: String(e.price), source: 'demo-seed',
    }))
  }

  // Helper: FX rate rows
  function fxRows() {
    return dailyFxUsd.map(e => ({
      fromCurrency: 'USD', toCurrency: 'TWD',
      rateDate: e.date, rate: String(e.rate ?? e.price), source: 'demo-seed',
    }))
  }

  // Helper: compute snapshot items for a profile
  function computeSnapshots(assets, accountMap, qtySteps, priceFn, fxFn) {
    const items = []
    for (const date of allDates) {
      for (const asset of assets) {
        const steps = qtySteps[asset.id]
        if (!steps) continue
        const qty = qtyOn(steps, date)
        if (qty === 0) continue
        const price = priceFn(asset, date)
        const fx = fxFn(asset, date)
        const value = qty * price * fx
        items.push({
          snapshotDate: date, assetId: asset.id, accountId: accountMap[asset.id],
          userId: 'demo-user', quantity: String(qty), price: String(price),
          fxRate: String(fx), valueInBase: String(Math.round(value)),
        })
      }
    }
    return items
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Profile 1: 雅婷 (Ya-Ting) — 台灣職場新鮮人, 28歲
  // ════════════════════════════════════════════════════════════════════════════
  function yaT() {
    const accBank = uid(), accBrok = uid()
    const aCash = uid(), a0050 = uid()

    const accounts = [
      { id: accBank, name: '玉山銀行活存', institution: '玉山銀行', accountType: 'bank', note: null },
      { id: accBrok, name: '元大證券', institution: '元大', accountType: 'broker', note: null },
    ]
    const assets = [
      { id: aCash, assetClass: 'asset', category: 'liquid', subKind: 'bank_account', name: '台幣活存', currencyCode: 'TWD', pricingMode: 'fixed', symbol: null, market: null, unit: 'TWD' },
      { id: a0050, assetClass: 'asset', category: 'investment', subKind: 'etf', name: '元大台灣50 ETF', symbol: '0050', market: 'TWSE', currencyCode: 'TWD', pricingMode: 'market', unit: 'shares' },
    ]
    const accountMap = { [aCash]: accBank, [a0050]: accBrok }

    // Monthly quantities (Events: Feb失業, Mar換工作52K, Jun日本旅遊-35K)
    const BANK = [110000,140000,128000,165000,202000,239000,241000,278000,315000,352000,389000,426000,463000,500000]
    const E0050 = [37, 56, 56, 75, 94, 113, 132, 151, 170, 189, 208, 227, 246, 265]

    // Convert monthly arrays to step functions
    const qtySteps = {
      [aCash]: MONTHS.map((d, i) => [d, BANK[i]]),
      [a0050]: MONTHS.map((d, i) => [d, E0050[i]]),
    }

    const holdings = [
      { assetId: aCash, accountId: accBank, userId: 'demo-user', quantity: String(BANK.at(-1)) },
      { assetId: a0050, accountId: accBrok, userId: 'demo-user', quantity: String(E0050.at(-1)) },
    ]

    // Transactions
    let txn = 0
    const transactions = []
    function tx(assetId, accountId, txnType, quantity, txnDate, note) {
      transactions.push({ id: uid(), userId: 'demo-user', assetId, accountId, txnType, quantity: String(quantity), txnDate, note })
    }
    for (let i = 0; i < MONTHS.length; i++) {
      const d = MONTHS[i]
      const d1 = d.slice(0, 8) + '01', d5 = d.slice(0, 8) + '05', d15 = d.slice(0, 8) + '15'
      tx(aCash, accBank, 'transfer_out', 12000, d1, '房租')
      if (i === 2) {
        tx(aCash, accBank, 'transfer_out', 3500, d.slice(0, 8) + '18', '求職費用')
      } else {
        const salary = i >= 3 ? 52000 : 45000
        tx(aCash, accBank, 'transfer_in', salary, d5, i === 3 ? '薪資入帳（新工作）' : '薪資入帳')
        tx(aCash, accBank, 'transfer_out', 3000, d15, '定期定額 0050')
        tx(a0050, accBrok, 'buy', 19, d15, '定期定額')
      }
      if (i === 6) tx(aCash, accBank, 'transfer_out', 35000, d.slice(0, 8) + '08', '日本旅遊')
    }

    const prices = priceRows(a0050, '0050')
    const priceFn = (a, date) => {
      if (a.id === a0050) { const e = dailyPrices['0050'].find(p => p.date === date); return e?.price ?? 1 }
      return 1
    }
    const fxFn = () => 1  // all TWD

    const snapshotItems = computeSnapshots(assets, accountMap, qtySteps, priceFn, fxFn)

    const recurringEntries = [
      { id: uid(), userId: 'demo-user', type: 'income', amount: '45000', currencyCode: 'TWD', dayOfMonth: 5, label: '每月薪資', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '12000', currencyCode: 'TWD', dayOfMonth: 1, label: '房租', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
    ]

    return { version: '2', exportedAt: new Date().toISOString(), data: { assets: assets.map(a => ({ ...a, userId: 'demo-user' })), accounts: accounts.map(a => ({ ...a, userId: 'demo-user' })), holdings, transactions, prices, fxRates: [], snapshotItems, recurringEntries } }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Profile 2: 建宏 (Chien-Hung) — 台灣房貸族, 38歲
  // ════════════════════════════════════════════════════════════════════════════
  function chienHung() {
    const accBank = uid(), accBrok = uid(), accProp = uid()
    const aCash = uid(), a878 = uid(), aHome = uid(), aCar = uid(), aMort = uid(), aCLoan = uid()

    const accounts = [
      { id: accBank, name: '玉山銀行薪轉帳戶', institution: '玉山銀行', accountType: 'bank', note: null },
      { id: accBrok, name: '元大證券', institution: '元大', accountType: 'broker', note: null },
      { id: accProp, name: '資產負債帳戶', institution: null, accountType: 'other', note: null },
    ]
    const assets = [
      { id: aCash, assetClass: 'asset', category: 'liquid', subKind: 'bank_account', name: '台幣薪轉活存', currencyCode: 'TWD', pricingMode: 'fixed', symbol: null, market: null, unit: 'TWD' },
      { id: a878, assetClass: 'asset', category: 'investment', subKind: 'etf', name: '國泰永豐高股息ETF (00878)', symbol: '00878', market: 'TWSE', currencyCode: 'TWD', pricingMode: 'market', unit: 'shares' },
      { id: aHome, assetClass: 'asset', category: 'fixed', subKind: 'real_estate', name: '永和自住房產', currencyCode: 'TWD', pricingMode: 'manual', symbol: null, market: null, unit: '戶' },
      { id: aCar, assetClass: 'asset', category: 'fixed', subKind: 'vehicle', name: '個人車輛', currencyCode: 'TWD', pricingMode: 'manual', symbol: null, market: null, unit: '輛' },
      { id: aMort, assetClass: 'liability', category: 'debt', subKind: 'mortgage', name: '玉山房貸', currencyCode: 'TWD', pricingMode: 'fixed', symbol: null, market: null, unit: 'TWD' },
      { id: aCLoan, assetClass: 'liability', category: 'debt', subKind: 'personal_loan', name: '中信車貸', currencyCode: 'TWD', pricingMode: 'fixed', symbol: null, market: null, unit: 'TWD' },
    ]
    const accountMap = { [aCash]: accBank, [a878]: accBrok, [aHome]: accProp, [aCar]: accProp, [aMort]: accProp, [aCLoan]: accProp }

    const BANK = [200000,243000,286000,329000,372000,412000,452000,492000,532000,492000,532000,572000,612000,652000]
    const E878 = [7500,7713,7926,8139,8352,8565,8778,8991,9204,9417,9630,9843,10056,10269]
    const MORT = [4500000,4480000,4460000,4440000,4420000,4400000,4380000,4360000,4340000,4320000,4300000,4280000,4260000,4240000]
    const CLOAN = [245000,236125,227250,218375,209500,420000,408000,396000,384000,372000,360000,348000,336000,324000]

    const qtySteps = {
      [aCash]: MONTHS.map((d, i) => [d, BANK[i]]),
      [a878]: MONTHS.map((d, i) => [d, E878[i]]),
      [aHome]: MONTHS.map((d, i) => [d, 1]),
      [aCar]: MONTHS.map((d, i) => [d, 1]),
      [aMort]: MONTHS.map((d, i) => [d, MORT[i]]),
      [aCLoan]: MONTHS.map((d, i) => [d, CLOAN[i]]),
    }

    const holdings = [
      { assetId: aCash, accountId: accBank, userId: 'demo-user', quantity: String(BANK.at(-1)) },
      { assetId: a878, accountId: accBrok, userId: 'demo-user', quantity: String(E878.at(-1)) },
      { assetId: aHome, accountId: accProp, userId: 'demo-user', quantity: '1' },
      { assetId: aCar, accountId: accProp, userId: 'demo-user', quantity: '1' },
      { assetId: aMort, accountId: accProp, userId: 'demo-user', quantity: String(MORT.at(-1)) },
      { assetId: aCLoan, accountId: accProp, userId: 'demo-user', quantity: String(CLOAN.at(-1)) },
    ]

    const transactions = []
    function tx(assetId, accountId, txnType, quantity, txnDate, note) {
      transactions.push({ id: uid(), userId: 'demo-user', assetId, accountId, txnType, quantity: String(quantity), txnDate, note })
    }
    for (let i = 0; i < MONTHS.length; i++) {
      const d = MONTHS[i]
      const d1 = d.slice(0, 8) + '01', d5 = d.slice(0, 8) + '05', d15 = d.slice(0, 8) + '15'
      tx(aCash, accBank, 'transfer_out', 28000, d1, '玉山房貸月繳')
      tx(aCash, accBank, 'transfer_out', i >= 5 ? 12000 : 8875, d1, '中信車貸月繳')
      tx(aCash, accBank, 'transfer_in', 85000, d5, '薪資入帳')
      tx(aCash, accBank, 'transfer_out', 5000, d15, '定期定額 00878')
      tx(a878, accBrok, 'buy', 213, d15, '定期定額')
      if (i === 5) {
        tx(aCar, accProp, 'buy', 1, d.slice(0, 8) + '12', '購入新車')
        tx(aCLoan, accProp, 'transfer_in', 420000, d.slice(0, 8) + '12', '中信車貸')
      }
      if (i === 9) tx(aCash, accBank, 'transfer_out', 80000, d.slice(0, 8) + '08', '颱風災損修繕費')
    }

    // Manual prices for real estate and vehicle
    const prices = [
      ...priceRows(a878, '00878'),
      { assetId: aHome, priceDate: '2020-03-01', price: '8000000', source: 'manual' },
      { assetId: aCar, priceDate: '2022-06-01', price: '800000', source: 'manual' },
      { assetId: aCar, priceDate: '2025-05-01', price: '1200000', source: 'manual' },
    ]

    // Price lookup: manual assets use latest manual price ≤ date
    const manualPrices = { [aHome]: [['2020-03-01', 8000000]], [aCar]: [['2022-06-01', 800000], ['2025-05-01', 1200000]] }
    const priceFn = (a, date) => {
      if (a.id === a878) { const e = dailyPrices['00878'].find(p => p.date === date); return e?.price ?? 1 }
      if (manualPrices[a.id]) { let p = 0; for (const [d, v] of manualPrices[a.id]) { if (d <= date) p = v }; return p || 1 }
      return 1
    }
    const fxFn = () => 1

    const snapshotItems = computeSnapshots(assets, accountMap, qtySteps, priceFn, fxFn)

    const recurringEntries = [
      { id: uid(), userId: 'demo-user', type: 'income', amount: '85000', currencyCode: 'TWD', dayOfMonth: 5, label: '每月薪資', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '28000', currencyCode: 'TWD', dayOfMonth: 1, label: '玉山房貸月繳', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
    ]

    return { version: '2', exportedAt: new Date().toISOString(), data: { assets: assets.map(a => ({ ...a, userId: 'demo-user' })), accounts: accounts.map(a => ({ ...a, userId: 'demo-user' })), holdings, transactions, prices, fxRates: [], snapshotItems, recurringEntries } }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Profile 3: Sarah Mitchell — 美國上班族, 32歲
  // ════════════════════════════════════════════════════════════════════════════
  function sarah() {
    const accBank = uid(), accBrok = uid(), accCryp = uid()
    const aCash = uid(), aVOO = uid(), aETH = uid(), aLoan = uid()

    const accounts = [
      { id: accBank, name: 'Chase Checking', institution: 'Chase Bank', accountType: 'bank', note: null },
      { id: accBrok, name: 'Fidelity', institution: 'Fidelity', accountType: 'broker', note: null },
      { id: accCryp, name: 'Coinbase', institution: 'Coinbase', accountType: 'crypto_exchange', note: null },
    ]
    const assets = [
      { id: aCash, assetClass: 'asset', category: 'liquid', subKind: 'bank_account', name: 'USD Checking', currencyCode: 'USD', pricingMode: 'fixed', symbol: null, market: null, unit: 'USD' },
      { id: aVOO, assetClass: 'asset', category: 'investment', subKind: 'etf', name: 'Vanguard S&P 500 ETF (VOO)', symbol: 'VOO', currencyCode: 'USD', pricingMode: 'market', market: null, unit: 'shares' },
      { id: aETH, assetClass: 'asset', category: 'investment', subKind: 'crypto', name: 'Ethereum (ETH)', symbol: 'ETH', currencyCode: 'USD', pricingMode: 'market', market: null, unit: 'ETH' },
      { id: aLoan, assetClass: 'liability', category: 'debt', subKind: 'personal_loan', name: 'Federal Student Loan', currencyCode: 'USD', pricingMode: 'fixed', symbol: null, market: null, unit: 'USD' },
    ]
    const accountMap = { [aCash]: accBank, [aVOO]: accBrok, [aETH]: accCryp, [aLoan]: accBank }

    const BANK = [15820,19640,23460,27280,32200,36020,39840,45160,50480,55800,61120,66440,71760,77080]
    const VOO_Q = [18.91,19.84,20.79,21.77,22.81,23.82,24.80,25.75,26.71,27.64,28.55,29.45,30.34,31.22]
    const ETH_Q = [2.5,2.5,2.5,2.5,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0,2.0]
    const LOAN = [18500,18200,17900,17600,17300,17000,16700,16400,16100,15800,15500,15200,14900,14600]

    const qtySteps = {
      [aCash]: MONTHS.map((d, i) => [d, BANK[i]]),
      [aVOO]: MONTHS.map((d, i) => [d, VOO_Q[i]]),
      [aETH]: MONTHS.map((d, i) => [d, ETH_Q[i]]),
      [aLoan]: MONTHS.map((d, i) => [d, LOAN[i]]),
    }

    const holdings = [
      { assetId: aCash, accountId: accBank, userId: 'demo-user', quantity: String(BANK.at(-1)) },
      { assetId: aVOO, accountId: accBrok, userId: 'demo-user', quantity: String(VOO_Q.at(-1)) },
      { assetId: aETH, accountId: accCryp, userId: 'demo-user', quantity: String(ETH_Q.at(-1)) },
      { assetId: aLoan, accountId: accBank, userId: 'demo-user', quantity: String(LOAN.at(-1)) },
    ]

    const transactions = []
    function tx(assetId, accountId, txnType, quantity, txnDate, note) {
      transactions.push({ id: uid(), userId: 'demo-user', assetId, accountId, txnType, quantity: String(quantity), txnDate, note })
    }
    for (let i = 0; i < MONTHS.length; i++) {
      const d = MONTHS[i]
      const d1 = d.slice(0, 8) + '01', d10 = d.slice(0, 8) + '10', d15 = d.slice(0, 8) + '15', d20 = d.slice(0, 8) + '20'
      tx(aCash, accBank, 'transfer_out', 1800, d1, 'Rent')
      tx(aCash, accBank, 'transfer_out', 380, d10, 'Student loan payment')
      tx(aCash, accBank, 'transfer_in', i >= 7 ? 8000 : 6500, d15, i === 7 ? 'Salary (new job)' : 'Salary')
      if (i === 4) {
        tx(aETH, accCryp, 'sell', 0.5, d.slice(0, 8) + '22', 'Stop-loss: ETH sold 0.5')
        tx(aCash, accBank, 'transfer_in', +(0.5 * P.ETH[4]).toFixed(2), d.slice(0, 8) + '22', 'ETH sale proceeds')
      }
      tx(aCash, accBank, 'transfer_out', 500, d20, 'VOO DCA')
      tx(aVOO, accBrok, 'buy', +(500 / P.VOO[i]).toFixed(4), d20, 'DCA')
    }

    const prices = [...priceRows(aVOO, 'VOO'), ...priceRows(aETH, 'ETH')]

    const priceFn = (a, date) => {
      if (a.id === aVOO) { const e = dailyPrices['VOO'].find(p => p.date === date); return e?.price ?? 1 }
      if (a.id === aETH) { const e = dailyPrices['ETH'].find(p => p.date === date); return e?.price ?? 1 }
      return 1
    }
    const fxFn = (a, date) => {
      if ([aCash, aVOO, aETH, aLoan].includes(a.id)) return fxMap.get(date) ?? 32
      return 1
    }

    const snapshotItems = computeSnapshots(assets, accountMap, qtySteps, priceFn, fxFn)

    const recurringEntries = [
      { id: uid(), userId: 'demo-user', type: 'income', amount: '6500', currencyCode: 'USD', dayOfMonth: 15, label: 'Monthly salary', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '1800', currencyCode: 'USD', dayOfMonth: 1, label: 'Apartment rent', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '500', currencyCode: 'USD', dayOfMonth: 20, label: 'VOO DCA', assetId: aVOO, accountId: accBrok, effectiveFrom: '2024-12-01', effectiveTo: null },
    ]

    return { version: '2', exportedAt: new Date().toISOString(), data: { assets: assets.map(a => ({ ...a, userId: 'demo-user' })), accounts: accounts.map(a => ({ ...a, userId: 'demo-user' })), holdings, transactions, prices, fxRates: fxRows(), snapshotItems, recurringEntries } }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Profile 4: Michael Torres — 美國成功人士, 45歲
  // ════════════════════════════════════════════════════════════════════════════
  function michael() {
    const accBank = uid(), accBrok = uid(), accProp = uid(), accLoans = uid()
    const aCash = uid(), aQQQ = uid(), aSPY = uid(), aGold = uid()
    const aHome = uid(), aRent = uid(), aPMort = uid(), aRMort = uid()

    const accounts = [
      { id: accBank, name: 'Chase Checking', institution: 'Chase Bank', accountType: 'bank', note: null },
      { id: accBrok, name: 'Schwab Brokerage', institution: 'Charles Schwab', accountType: 'broker', note: null },
      { id: accProp, name: 'Real Estate Portfolio', institution: null, accountType: 'other', note: null },
      { id: accLoans, name: 'Loan Accounts', institution: null, accountType: 'other', note: null },
    ]
    const assets = [
      { id: aCash, assetClass: 'asset', category: 'liquid', subKind: 'bank_account', name: 'USD Checking', currencyCode: 'USD', pricingMode: 'fixed', symbol: null, market: null, unit: 'USD' },
      { id: aQQQ, assetClass: 'asset', category: 'investment', subKind: 'etf', name: 'Invesco QQQ Trust (QQQ)', symbol: 'QQQ', currencyCode: 'USD', pricingMode: 'market', market: null, unit: 'shares' },
      { id: aSPY, assetClass: 'asset', category: 'investment', subKind: 'etf', name: 'SPDR S&P 500 ETF (SPY)', symbol: 'SPY', currencyCode: 'USD', pricingMode: 'market', market: null, unit: 'shares' },
      { id: aGold, assetClass: 'asset', category: 'investment', subKind: 'precious_metal', name: 'Gold Bullion', currencyCode: 'USD', pricingMode: 'market', symbol: null, market: null, unit: 'oz' },
      { id: aHome, assetClass: 'asset', category: 'fixed', subKind: 'real_estate', name: 'Primary Residence', currencyCode: 'USD', pricingMode: 'manual', symbol: null, market: null, unit: 'unit' },
      { id: aRent, assetClass: 'asset', category: 'fixed', subKind: 'real_estate', name: 'Rental Property', currencyCode: 'USD', pricingMode: 'manual', symbol: null, market: null, unit: 'unit' },
      { id: aPMort, assetClass: 'liability', category: 'debt', subKind: 'mortgage', name: 'Primary Home Mortgage', currencyCode: 'USD', pricingMode: 'fixed', symbol: null, market: null, unit: 'USD' },
      { id: aRMort, assetClass: 'liability', category: 'debt', subKind: 'mortgage', name: 'Rental Property Mortgage', currencyCode: 'USD', pricingMode: 'fixed', symbol: null, market: null, unit: 'USD' },
    ]
    const accountMap = { [aCash]: accBank, [aQQQ]: accBrok, [aSPY]: accBrok, [aGold]: accBrok, [aHome]: accProp, [aRent]: accProp, [aPMort]: accLoans, [aRMort]: accLoans }

    const BANK = [42221,49442,56663,63884,77855,85076,92297,99518,106739,113960,121181,128402,367000,373000]
    const QQQ_Q = [151.92,153.89,155.91,157.99,145.21,147.34,149.39,151.38,153.39,155.33,157.22,159.08,160.91,162.72]
    const SPY_Q = [101.69,103.42,105.19,107.01,108.95,110.83,112.65,114.43,116.23,117.98,119.69,121.38,123.05,124.70]
    const GOLD_Q = 30
    const PMORT = [658000,656000,654000,652000,650000,648000,646000,644000,642000,640000,638000,636000,634000,632000]
    const RMORT = [316500,316000,315500,315000,314500,314000,313500,313000,312500,312000,311500,311000,0,0]
    const RENT_H = [1,1,1,1,1,1,1,1,1,1,1,1,0,0]

    const qtySteps = {
      [aCash]: MONTHS.map((d, i) => [d, BANK[i]]),
      [aQQQ]: MONTHS.map((d, i) => [d, QQQ_Q[i]]),
      [aSPY]: MONTHS.map((d, i) => [d, SPY_Q[i]]),
      [aGold]: MONTHS.map((d, i) => [d, GOLD_Q]),
      [aHome]: MONTHS.map((d, i) => [d, 1]),
      [aRent]: MONTHS.map((d, i) => [d, RENT_H[i]]),
      [aPMort]: MONTHS.map((d, i) => [d, PMORT[i]]),
      [aRMort]: MONTHS.map((d, i) => [d, RMORT[i]]),
    }

    const holdings = [
      { assetId: aCash, accountId: accBank, userId: 'demo-user', quantity: String(BANK.at(-1)) },
      { assetId: aQQQ, accountId: accBrok, userId: 'demo-user', quantity: String(QQQ_Q.at(-1)) },
      { assetId: aSPY, accountId: accBrok, userId: 'demo-user', quantity: String(SPY_Q.at(-1)) },
      { assetId: aGold, accountId: accBrok, userId: 'demo-user', quantity: String(GOLD_Q) },
      { assetId: aHome, accountId: accProp, userId: 'demo-user', quantity: '1' },
      { assetId: aPMort, accountId: accLoans, userId: 'demo-user', quantity: String(PMORT.at(-1)) },
    ]

    const transactions = []
    function tx(assetId, accountId, txnType, quantity, txnDate, note) {
      transactions.push({ id: uid(), userId: 'demo-user', assetId, accountId, txnType, quantity: String(quantity), txnDate, note })
    }
    for (let i = 0; i < MONTHS.length; i++) {
      const d = MONTHS[i]
      const d1 = d.slice(0, 8) + '01', d5 = d.slice(0, 8) + '05', d15 = d.slice(0, 8) + '15', d20 = d.slice(0, 8) + '20'
      tx(aCash, accBank, 'transfer_out', 3367, d1, 'Primary mortgage payment')
      if (i < 12) tx(aCash, accBank, 'transfer_out', 1612, d1, 'Rental mortgage payment')
      tx(aCash, accBank, 'transfer_in', 12000, d5, 'Salary')
      if (i < 12) tx(aCash, accBank, 'transfer_in', 2200, d15, 'Rental income')
      if (i === 4) {
        tx(aQQQ, accBrok, 'sell', 15, d.slice(0, 8) + '07', 'Stop-loss: Nasdaq sell-off')
        tx(aCash, accBank, 'transfer_in', +(15 * P.QQQ[4]).toFixed(2), d.slice(0, 8) + '07', 'QQQ sale proceeds')
      }
      if (i === 12) {
        tx(aRent, accProp, 'sell', 1, d.slice(0, 8) + '18', 'Sold rental property')
        tx(aCash, accBank, 'transfer_in', 550000, d.slice(0, 8) + '18', 'Sale proceeds')
        tx(aRMort, accLoans, 'transfer_out', 311000, d.slice(0, 8) + '18', 'Mortgage payoff')
        tx(aCash, accBank, 'transfer_out', 318000, d.slice(0, 8) + '18', 'Mortgage + closing costs')
      }
      tx(aCash, accBank, 'transfer_out', 1000, d20, 'QQQ DCA')
      tx(aCash, accBank, 'transfer_out', 1000, d20, 'SPY DCA')
      tx(aQQQ, accBrok, 'buy', +(1000 / P.QQQ[i]).toFixed(4), d20, 'DCA')
      tx(aSPY, accBrok, 'buy', +(1000 / P.SPY[i]).toFixed(4), d20, 'DCA')
    }

    // Gold prices: convert from USD/oz to daily
    const goldDaily = dailyPrices['GOLD']

    const prices = [
      ...priceRows(aQQQ, 'QQQ'),
      ...priceRows(aSPY, 'SPY'),
      ...goldDaily.map(e => ({ assetId: aGold, priceDate: e.date, price: String(e.price), source: 'demo-seed' })),
      { assetId: aHome, priceDate: '2019-04-01', price: '950000', source: 'manual' },
      { assetId: aRent, priceDate: '2021-08-01', price: '450000', source: 'manual' },
      { assetId: aRent, priceDate: '2025-12-01', price: '550000', source: 'manual' },
    ]

    const manualPrices = { [aHome]: [['2019-04-01', 950000]], [aRent]: [['2021-08-01', 450000], ['2025-12-01', 550000]] }
    const priceFn = (a, date) => {
      if (a.id === aQQQ) { const e = dailyPrices['QQQ'].find(p => p.date === date); return e?.price ?? 1 }
      if (a.id === aSPY) { const e = dailyPrices['SPY'].find(p => p.date === date); return e?.price ?? 1 }
      if (a.id === aGold) { const e = dailyPrices['GOLD'].find(p => p.date === date); return e?.price ?? 1 }
      if (manualPrices[a.id]) { let p = 0; for (const [d, v] of manualPrices[a.id]) { if (d <= date) p = v }; return p || 1 }
      return 1
    }
    const fxFn = (a, date) => {
      if ([aCash, aQQQ, aSPY, aGold, aHome, aRent, aPMort, aRMort].includes(a.id)) return fxMap.get(date) ?? 32
      return 1
    }

    const snapshotItems = computeSnapshots(assets, accountMap, qtySteps, priceFn, fxFn)

    const recurringEntries = [
      { id: uid(), userId: 'demo-user', type: 'income', amount: '12000', currencyCode: 'USD', dayOfMonth: 5, label: 'Monthly salary', assetId: aCash, accountId: accBank, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '3367', currencyCode: 'USD', dayOfMonth: 1, label: 'Primary mortgage', assetId: aCash, accountId: accBank, effectiveFrom: '2019-04-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '1000', currencyCode: 'USD', dayOfMonth: 20, label: 'QQQ DCA', assetId: aQQQ, accountId: accBrok, effectiveFrom: '2024-12-01', effectiveTo: null },
      { id: uid(), userId: 'demo-user', type: 'expense', amount: '1000', currencyCode: 'USD', dayOfMonth: 20, label: 'SPY DCA', assetId: aSPY, accountId: accBrok, effectiveFrom: '2024-12-01', effectiveTo: null },
    ]

    return { version: '2', exportedAt: new Date().toISOString(), data: { assets: assets.map(a => ({ ...a, userId: 'demo-user' })), accounts: accounts.map(a => ({ ...a, userId: 'demo-user' })), holdings, transactions, prices, fxRates: fxRows(), snapshotItems, recurringEntries } }
  }

  return [
    { name: 'demo-雅婷', backup: yaT() },
    { name: 'demo-建宏', backup: chienHung() },
    { name: 'demo-Sarah', backup: sarah() },
    { name: 'demo-Michael', backup: michael() },
  ]
}

export function buildAllProfiles() {
  return defineProfiles()
}
