#!/usr/bin/env node
// scripts/generate-demo-data.mjs
// Usage: node scripts/generate-demo-data.mjs

const API = 'http://localhost:8001/api/v1'

// ─── Date helpers ─────────────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function firstOfMonth(endOfMonthStr) {
  // '2025-01-31' → '2025-01-01'
  return endOfMonthStr.slice(0, 8) + '01'
}

// ─── Monthly snapshot end-dates ──────────────────────────────────────────────
const MONTHS = [
  '2024-12-31', '2025-01-31', '2025-02-28', '2025-03-31',
  '2025-04-30', '2025-05-31', '2025-06-30', '2025-07-31',
  '2025-08-31', '2025-09-30', '2025-10-31', '2025-11-30',
  '2025-12-31', '2026-01-31',
]

// ─── Historical asset prices ─────────────────────────────────────────────────
const P_0050  = [157, 151, 153, 148, 145, 150, 155, 158, 156, 162, 165, 168, 171, 173]
const P_00878 = [23.5, 22.8, 23.1, 22.5, 22.0, 22.8, 23.3, 23.8, 23.5, 24.2, 24.5, 24.9, 25.2, 25.5]
const P_VOO   = [548, 538, 525, 510, 480, 495, 510, 525, 520, 535, 548, 555, 562, 568]
const P_QQQ   = [522, 508, 495, 480, 450, 470, 488, 503, 497, 515, 528, 537, 545, 552]
const P_SPY   = [592, 578, 565, 548, 515, 532, 548, 562, 557, 572, 585, 593, 600, 607]
const P_ETH   = [3500, 3200, 2800, 2500, 2200, 2400, 2600, 2700, 2500, 2800, 3000, 3200, 3400, 3300]
const P_GOLD  = [2640, 2750, 2900, 3050, 3300, 3350, 3250, 3400, 3500, 3650, 3700, 3600, 3550, 3600]

// ─── Monthly FX rates (USD → TWD, JPY → TWD) ─────────────────────────────────
const FX_USD  = [32.5, 32.8, 32.6, 32.2, 31.8, 31.5, 31.2, 31.0, 31.5, 31.8, 32.0, 32.3, 32.5, 32.0]
const FX_JPY  = [0.215, 0.218, 0.220, 0.217, 0.214, 0.212, 0.210, 0.208, 0.212, 0.215, 0.217, 0.219, 0.221, 0.220]

// ─── User 1: 雅婷 (Lin Ya-Ting) — 台灣職場新鮮人, 28歲 ────────────────────────
// Net: +45K salary - 12K rent - 3K ETF = +30K/month to bank; +19 shares 0050/month
const YT_BANK = [110000,140000,170000,200000,230000,260000,290000,320000,350000,380000,410000,440000,470000,500000]
const YT_0050 = [37, 56, 75, 94, 113, 132, 151, 170, 189, 208, 227, 246, 265, 284]

// ─── User 2: 建宏 (Chen Chien-Hung) — 台灣房貸族, 38歲 ──────────────────────
// Net: +85K salary - 28K mortgage - 8.875K car - 5K ETF = +43K/month
const CH_BANK  = [200000,243000,286000,329000,372000,415000,458000,501000,544000,587000,630000,673000,716000,759000]
const CH_00878 = [7500,7713,7926,8139,8352,8565,8778,8991,9204,9417,9630,9843,10056,10269]
const CH_MORTG = [4500000,4480000,4460000,4440000,4420000,4400000,4380000,4360000,4340000,4320000,4300000,4280000,4260000,4240000]
const CH_CLOAM = [245000,236125,227250,218375,209500,200625,191750,182875,174000,165125,156250,147375,138500,129625]

// ─── User 3: Sarah Mitchell — 美國上班族, 32歲 ──────────────────────────────
// Net: +$6500 salary - $1800 rent - $380 loan - $500 ETF = +$3820/month
const SA_BANK = [15820,19640,23460,27280,31100,34920,38740,42560,46380,50200,54020,57840,61660,65480]
const SA_VOO  = [18.91,19.84,20.79,21.77,22.81,23.82,24.80,25.75,26.71,27.64,28.55,29.45,30.34,31.22]
const SA_ETH  = 2.5  // constant
const SA_LOAN = [18500,18200,17900,17600,17300,17000,16700,16400,16100,15800,15500,15200,14900,14600]

// ─── User 4: Michael Torres — 美國成功人士, 45歲 ─────────────────────────────
// Net: +$12K salary + $2.2K rent income - $3.367K + $1.612K mortgages - $2K ETF = +$7.221K/month
const MI_BANK   = [42221,49442,56663,63884,71105,78326,85547,92768,99989,107210,114431,121652,128873,136094]
const MI_QQQ    = [151.92,153.89,155.91,157.99,160.21,162.34,164.39,166.38,168.39,170.33,172.22,174.08,175.91,177.72]
const MI_SPY    = [101.69,103.42,105.19,107.01,108.95,110.83,112.65,114.43,116.23,117.98,119.69,121.38,123.05,124.70]
const MI_GOLD   = 30  // oz, constant
const MI_PMORT  = [658000,656000,654000,652000,650000,648000,646000,644000,642000,640000,638000,636000,634000,632000]
const MI_RMORT  = [316500,316000,315500,315000,314500,314000,313500,313000,312500,312000,311500,311000,310500,310000]

// ─── Synthetic daily price generator ─────────────────────────────────────────
// Generates daily prices by linear interpolation between monthly anchors + noise.
// Returns [{ assetId, priceDate, price }] for every calendar day in MONTHS range.
function generateDailyPrices(assetId, monthlyPrices, months, dailyVol = 0.008) {
  const entries = []
  let prevPrice = monthlyPrices[0]

  for (let i = 0; i < months.length; i++) {
    const monthEnd = months[i]
    const monthStart = i === 0 ? firstOfMonth(monthEnd) : addDays(months[i - 1], 1)
    const targetPrice = monthlyPrices[i]

    // Count calendar days in this segment
    const msPerDay = 86400000
    const startMs = new Date(monthStart + 'T00:00:00Z').getTime()
    const endMs   = new Date(monthEnd   + 'T00:00:00Z').getTime()
    const totalDays = Math.round((endMs - startMs) / msPerDay) + 1

    let current = monthStart
    for (let d = 0; d < totalDays; d++) {
      const progress = totalDays > 1 ? d / (totalDays - 1) : 1
      const trend = prevPrice + (targetPrice - prevPrice) * progress
      // Small ±dailyVol noise for realistic daily variation
      const noise = 1 + (Math.random() * 2 - 1) * dailyVol
      const price = Math.round(trend * noise * 10000) / 10000
      entries.push({ assetId, priceDate: current, price })
      current = addDays(current, 1)
    }

    prevPrice = targetPrice
  }

  return entries
}

// ─── API helpers ─────────────────────────────────────────────────────────────
async function call(method, path, body, userId) {
  const headers = { 'Content-Type': 'application/json' }
  if (userId) headers['x-user-id'] = userId
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return null
  return res.json()
}
const post = (path, body, uid) => call('POST', path, body, uid)
const put  = (path, body, uid) => call('PUT',  path, body, uid)

function ym(dateStr) {
  // '2024-12-31' → '2024-12'
  return dateStr.slice(0, 7)
}
function txnDate(monthEnd, day) {
  // e.g. '2024-12-31', 5 → '2024-12-05'
  const [y, m] = monthEnd.split('-')
  return `${y}-${m}-${String(day).padStart(2, '0')}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Atom Fortune Demo Data Generator ===\n')

  // ── 1. Create users ────────────────────────────────────────────────────────
  console.log('Creating users...')
  const yt = await post('/users', { name: '雅婷 Lin Ya-Ting' })
  const ch = await post('/users', { name: '建宏 Chen Chien-Hung' })
  const sa = await post('/users', { name: 'Sarah Mitchell' })
  const mi = await post('/users', { name: 'Michael Torres' })
  console.log(`  ✓ Ya-Ting:  ${yt.id}`)
  console.log(`  ✓ Chien-Hung: ${ch.id}`)
  console.log(`  ✓ Sarah:    ${sa.id}`)
  console.log(`  ✓ Michael:  ${mi.id}`)

  // ── 2. Setup: 雅婷 ─────────────────────────────────────────────────────────
  console.log('\nSetting up 雅婷...')
  const ytBank  = await post('/accounts', { name: '玉山銀行活存', institution: '玉山銀行', accountType: 'bank' }, yt.id)
  const ytBrok  = await post('/accounts', { name: '元大證券', institution: '元大', accountType: 'broker' }, yt.id)

  const ytCash  = await post('/assets', { name: '台幣活存', assetClass: 'asset', category: 'liquid', subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed' }, yt.id)
  const yt0050  = await post('/assets', { name: '元大台灣50 ETF', assetClass: 'asset', category: 'investment', subKind: 'etf', symbol: '0050', market: 'TWSE', currencyCode: 'TWD', pricingMode: 'market', unit: 'shares' }, yt.id)
  console.log('  ✓ accounts + assets created')

  // ── 3. Setup: 建宏 ─────────────────────────────────────────────────────────
  console.log('Setting up 建宏...')
  const chBank  = await post('/accounts', { name: '玉山銀行薪轉帳戶', institution: '玉山銀行', accountType: 'bank' }, ch.id)
  const chBrok  = await post('/accounts', { name: '元大證券', institution: '元大', accountType: 'broker' }, ch.id)
  const chProp  = await post('/accounts', { name: '資產負債帳戶', accountType: 'other' }, ch.id)

  const chCash  = await post('/assets', { name: '台幣薪轉活存', assetClass: 'asset', category: 'liquid', subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed' }, ch.id)
  const ch878   = await post('/assets', { name: '國泰永豐高股息ETF (00878)', assetClass: 'asset', category: 'investment', subKind: 'etf', symbol: '00878', market: 'TWSE', currencyCode: 'TWD', pricingMode: 'market', unit: 'shares' }, ch.id)
  const chHome  = await post('/assets', { name: '永和自住房產', assetClass: 'asset', category: 'fixed', subKind: 'real_estate', currencyCode: 'TWD', pricingMode: 'manual', unit: '戶' }, ch.id)
  const chCar   = await post('/assets', { name: '個人車輛', assetClass: 'asset', category: 'fixed', subKind: 'vehicle', currencyCode: 'TWD', pricingMode: 'manual', unit: '輛' }, ch.id)
  const chMort  = await post('/assets', { name: '玉山房貸', assetClass: 'liability', category: 'debt', subKind: 'mortgage', currencyCode: 'TWD', pricingMode: 'fixed' }, ch.id)
  const chCLoan = await post('/assets', { name: '中信車貸', assetClass: 'liability', category: 'debt', subKind: 'personal_loan', currencyCode: 'TWD', pricingMode: 'fixed' }, ch.id)
  console.log('  ✓ accounts + assets created')

  // ── 4. Setup: Sarah ────────────────────────────────────────────────────────
  console.log('Setting up Sarah...')
  const saBank  = await post('/accounts', { name: 'Chase Checking', institution: 'Chase Bank', accountType: 'bank' }, sa.id)
  const saBrok  = await post('/accounts', { name: 'Fidelity', institution: 'Fidelity', accountType: 'broker' }, sa.id)
  const saCryp  = await post('/accounts', { name: 'Coinbase', institution: 'Coinbase', accountType: 'crypto_exchange' }, sa.id)

  const saCash  = await post('/assets', { name: 'USD Checking', assetClass: 'asset', category: 'liquid', subKind: 'bank_account', currencyCode: 'USD', pricingMode: 'fixed' }, sa.id)
  const saVOO   = await post('/assets', { name: 'Vanguard S&P 500 ETF (VOO)', assetClass: 'asset', category: 'investment', subKind: 'etf', symbol: 'VOO', currencyCode: 'USD', pricingMode: 'market', unit: 'shares' }, sa.id)
  const saETH   = await post('/assets', { name: 'Ethereum (ETH)', assetClass: 'asset', category: 'investment', subKind: 'crypto', symbol: 'ETH', currencyCode: 'USD', pricingMode: 'market', unit: 'ETH' }, sa.id)
  const saLoan  = await post('/assets', { name: 'Federal Student Loan', assetClass: 'liability', category: 'debt', subKind: 'personal_loan', currencyCode: 'USD', pricingMode: 'fixed' }, sa.id)
  console.log('  ✓ accounts + assets created')

  // ── 5. Setup: Michael ──────────────────────────────────────────────────────
  console.log('Setting up Michael...')
  const miBank  = await post('/accounts', { name: 'Chase Checking', institution: 'Chase Bank', accountType: 'bank' }, mi.id)
  const miBrok  = await post('/accounts', { name: 'Schwab Brokerage', institution: 'Charles Schwab', accountType: 'broker' }, mi.id)
  const miProp  = await post('/accounts', { name: 'Real Estate Portfolio', accountType: 'other' }, mi.id)
  const miLoans = await post('/accounts', { name: 'Loan Accounts', accountType: 'other' }, mi.id)

  const miCash  = await post('/assets', { name: 'USD Checking', assetClass: 'asset', category: 'liquid', subKind: 'bank_account', currencyCode: 'USD', pricingMode: 'fixed' }, mi.id)
  const miQQQ   = await post('/assets', { name: 'Invesco QQQ Trust (QQQ)', assetClass: 'asset', category: 'investment', subKind: 'etf', symbol: 'QQQ', currencyCode: 'USD', pricingMode: 'market', unit: 'shares' }, mi.id)
  const miSPY   = await post('/assets', { name: 'SPDR S&P 500 ETF (SPY)', assetClass: 'asset', category: 'investment', subKind: 'etf', symbol: 'SPY', currencyCode: 'USD', pricingMode: 'market', unit: 'shares' }, mi.id)
  const miGold  = await post('/assets', { name: 'Gold Bullion', assetClass: 'asset', category: 'investment', subKind: 'precious_metal', currencyCode: 'USD', pricingMode: 'manual', unit: 'ounce' }, mi.id)
  const miHome  = await post('/assets', { name: 'Primary Residence', assetClass: 'asset', category: 'fixed', subKind: 'real_estate', currencyCode: 'USD', pricingMode: 'manual', unit: 'unit' }, mi.id)
  const miRent  = await post('/assets', { name: 'Rental Property', assetClass: 'asset', category: 'fixed', subKind: 'real_estate', currencyCode: 'USD', pricingMode: 'manual', unit: 'unit' }, mi.id)
  const miPMort = await post('/assets', { name: 'Primary Home Mortgage', assetClass: 'liability', category: 'debt', subKind: 'mortgage', currencyCode: 'USD', pricingMode: 'fixed' }, mi.id)
  const miRMort = await post('/assets', { name: 'Rental Property Mortgage', assetClass: 'liability', category: 'debt', subKind: 'mortgage', currencyCode: 'USD', pricingMode: 'fixed' }, mi.id)
  console.log('  ✓ accounts + assets created')

  // ── 6. Insert manual prices (manual/fixed assets only) ────────────────────
  console.log('\nInserting manual asset prices...')
  // Gold: monthly historical prices (pricingMode: manual)
  for (let i = 0; i < MONTHS.length; i++) {
    const d = MONTHS[i]
    await post('/prices/manual', { assetId: miGold.id,  priceDate: d, price: P_GOLD[i]  }, mi.id)
  }
  // Fixed-price real estate / vehicles (one entry, carries forward indefinitely)
  await post('/prices/manual', { assetId: chHome.id,  priceDate: '2020-03-01', price: 8000000 }, ch.id)
  await post('/prices/manual', { assetId: chCar.id,   priceDate: '2022-06-01', price: 800000  }, ch.id)
  await post('/prices/manual', { assetId: miHome.id,  priceDate: '2019-04-01', price: 950000  }, mi.id)
  await post('/prices/manual', { assetId: miRent.id,  priceDate: '2021-08-01', price: 450000  }, mi.id)
  console.log('  ✓ manual prices inserted')

  // ── 7. Insert FX rates for all months ─────────────────────────────────────
  console.log('Inserting FX rates...')
  for (let i = 0; i < MONTHS.length; i++) {
    const d = MONTHS[i]
    await post('/fx-rates/manual', { fromCurrency: 'USD', toCurrency: 'TWD', rateDate: d, rate: FX_USD[i] })
    await post('/fx-rates/manual', { fromCurrency: 'JPY', toCurrency: 'TWD', rateDate: d, rate: FX_JPY[i] })
  }
  console.log('  ✓ FX rates inserted')

  // ── 7.5. Seed synthetic daily prices for all market assets ───────────────
  // Yahoo Finance historical API returns flat prices; we generate realistic
  // daily variation via linear interpolation between monthly anchors + noise.
  // Must happen BEFORE the monthly snapshot rebuild loop.
  console.log('\nSeeding synthetic daily market prices...')
  const marketPriceMap = [
    [yt0050.id,  P_0050 ],
    [ch878.id,   P_00878],
    [saVOO.id,   P_VOO  ],
    [saETH.id,   P_ETH  ],
    [miQQQ.id,   P_QQQ  ],
    [miSPY.id,   P_SPY  ],
  ]
  for (const [assetId, prices] of marketPriceMap) {
    const entries = generateDailyPrices(assetId, prices, MONTHS)
    process.stdout.write(`  seeding ${entries.length} daily prices for asset ${assetId.slice(0, 8)}...`)
    await post('/prices/seed', entries)
    console.log(' ✓')
  }

  // ── 8. Monthly iteration: holdings → transactions → snapshot ───────────────
  console.log('\nGenerating 14 months of history...')

  for (let i = 0; i < MONTHS.length; i++) {
    const d = MONTHS[i]
    const [yr, mo] = d.split('-')
    console.log(`\n  [${i+1}/14] ${d}`)

    // ── Update holdings for each user ──────────────────────────────────────
    // Ya-Ting
    await put(`/holdings/${ytCash.id}/${ytBank.id}`,  { quantity: YT_BANK[i] }, yt.id)
    await put(`/holdings/${yt0050.id}/${ytBrok.id}`,  { quantity: YT_0050[i] }, yt.id)

    // 建宏
    await put(`/holdings/${chCash.id}/${chBank.id}`,  { quantity: CH_BANK[i]  }, ch.id)
    await put(`/holdings/${ch878.id}/${chBrok.id}`,   { quantity: CH_00878[i] }, ch.id)
    await put(`/holdings/${chHome.id}/${chProp.id}`,  { quantity: 1           }, ch.id)
    await put(`/holdings/${chCar.id}/${chProp.id}`,   { quantity: 1           }, ch.id)
    await put(`/holdings/${chMort.id}/${chProp.id}`,  { quantity: CH_MORTG[i] }, ch.id)
    await put(`/holdings/${chCLoan.id}/${chProp.id}`, { quantity: CH_CLOAM[i] }, ch.id)

    // Sarah
    await put(`/holdings/${saCash.id}/${saBank.id}`,  { quantity: SA_BANK[i] }, sa.id)
    await put(`/holdings/${saVOO.id}/${saBrok.id}`,   { quantity: SA_VOO[i]  }, sa.id)
    await put(`/holdings/${saETH.id}/${saCryp.id}`,   { quantity: SA_ETH     }, sa.id)
    await put(`/holdings/${saLoan.id}/${saBank.id}`,  { quantity: SA_LOAN[i] }, sa.id)

    // Michael
    await put(`/holdings/${miCash.id}/${miBank.id}`,   { quantity: MI_BANK[i]  }, mi.id)
    await put(`/holdings/${miQQQ.id}/${miBrok.id}`,    { quantity: MI_QQQ[i]   }, mi.id)
    await put(`/holdings/${miSPY.id}/${miBrok.id}`,    { quantity: MI_SPY[i]   }, mi.id)
    await put(`/holdings/${miGold.id}/${miBrok.id}`,   { quantity: MI_GOLD     }, mi.id)
    await put(`/holdings/${miHome.id}/${miProp.id}`,   { quantity: 1           }, mi.id)
    await put(`/holdings/${miRent.id}/${miProp.id}`,   { quantity: 1           }, mi.id)
    await put(`/holdings/${miPMort.id}/${miLoans.id}`, { quantity: MI_PMORT[i] }, mi.id)
    await put(`/holdings/${miRMort.id}/${miLoans.id}`, { quantity: MI_RMORT[i] }, mi.id)

    // ── Transactions (records only, don't affect snapshot state) ───────────
    const d1  = txnDate(d, 1)
    const d5  = txnDate(d, 5)
    const d10 = txnDate(d, 10)
    const d15 = txnDate(d, 15)
    const d20 = txnDate(d, 20)

    // Ya-Ting
    await post('/transactions', { assetId: ytCash.id, accountId: ytBank.id, txnType: 'transfer_out', quantity: 12000,  txnDate: d1,  note: '房租' }, yt.id)
    await post('/transactions', { assetId: ytCash.id, accountId: ytBank.id, txnType: 'transfer_in',  quantity: 45000,  txnDate: d5,  note: '薪資入帳' }, yt.id)
    await post('/transactions', { assetId: ytCash.id, accountId: ytBank.id, txnType: 'transfer_out', quantity: 3000,   txnDate: d15, note: '定期定額 0050' }, yt.id)
    await post('/transactions', { assetId: yt0050.id, accountId: ytBrok.id, txnType: 'buy',          quantity: 19,     txnDate: d15, note: '定期定額' }, yt.id)

    // 建宏
    await post('/transactions', { assetId: chCash.id, accountId: chBank.id, txnType: 'transfer_out', quantity: 28000,  txnDate: d1,  note: '玉山房貸月繳' }, ch.id)
    await post('/transactions', { assetId: chCash.id, accountId: chBank.id, txnType: 'transfer_out', quantity: 8875,   txnDate: d1,  note: '中信車貸月繳' }, ch.id)
    await post('/transactions', { assetId: chCash.id, accountId: chBank.id, txnType: 'transfer_in',  quantity: 85000,  txnDate: d5,  note: '薪資入帳' }, ch.id)
    await post('/transactions', { assetId: chCash.id, accountId: chBank.id, txnType: 'transfer_out', quantity: 5000,   txnDate: d15, note: '定期定額 00878' }, ch.id)
    await post('/transactions', { assetId: ch878.id,  accountId: chBrok.id, txnType: 'buy',          quantity: 213,    txnDate: d15, note: '定期定額' }, ch.id)

    // Sarah
    await post('/transactions', { assetId: saCash.id, accountId: saBank.id, txnType: 'transfer_out', quantity: 1800, txnDate: d1,  note: 'Rent' }, sa.id)
    await post('/transactions', { assetId: saCash.id, accountId: saBank.id, txnType: 'transfer_out', quantity: 380,  txnDate: d10, note: 'Student loan payment' }, sa.id)
    await post('/transactions', { assetId: saCash.id, accountId: saBank.id, txnType: 'transfer_in',  quantity: 6500, txnDate: d15, note: 'Salary' }, sa.id)
    await post('/transactions', { assetId: saCash.id, accountId: saBank.id, txnType: 'transfer_out', quantity: 500,  txnDate: d20, note: 'VOO DCA' }, sa.id)
    const vooBuy = +(500 / P_VOO[i]).toFixed(4)
    await post('/transactions', { assetId: saVOO.id,  accountId: saBrok.id, txnType: 'buy',          quantity: vooBuy, txnDate: d20, note: 'DCA' }, sa.id)

    // Michael
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_out', quantity: 3367, txnDate: d1,  note: 'Primary mortgage payment' }, mi.id)
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_out', quantity: 1612, txnDate: d1,  note: 'Rental mortgage payment' }, mi.id)
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_in',  quantity: 12000, txnDate: d5, note: 'Salary' }, mi.id)
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_in',  quantity: 2200, txnDate: d15, note: 'Rental income' }, mi.id)
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_out', quantity: 1000, txnDate: d20, note: 'QQQ DCA' }, mi.id)
    await post('/transactions', { assetId: miCash.id, accountId: miBank.id, txnType: 'transfer_out', quantity: 1000, txnDate: d20, note: 'SPY DCA' }, mi.id)
    const qqqBuy = +(1000 / P_QQQ[i]).toFixed(4)
    const spyBuy = +(1000 / P_SPY[i]).toFixed(4)
    await post('/transactions', { assetId: miQQQ.id, accountId: miBrok.id, txnType: 'buy', quantity: qqqBuy, txnDate: d20, note: 'DCA' }, mi.id)
    await post('/transactions', { assetId: miSPY.id, accountId: miBrok.id, txnType: 'buy', quantity: spyBuy, txnDate: d20, note: 'DCA' }, mi.id)

    // ── Rebuild daily snapshots for this month with current holdings ───────
    // Holdings are set to month[i] values above, so all daily snapshots for
    // this month will correctly use the historically accurate quantities.
    const monthFrom = i === 0 ? firstOfMonth(d) : addDays(MONTHS[i - 1], 1)
    process.stdout.write(`    rebuilding snapshots ${monthFrom} → ${d}...`)
    await post('/snapshots/rebuild-range', { from: monthFrom, to: d }, yt.id)
    console.log(' ✓')
  }

  // ── 9. Recurring entries ───────────────────────────────────────────────────
  console.log('\nCreating recurring entries...')

  // Ya-Ting
  await post('/recurring-entries', { type: 'income',  amount: 45000, currencyCode: 'TWD', dayOfMonth: 5,  label: '每月薪資', assetId: ytCash.id, accountId: ytBank.id, effectiveFrom: '2024-12-01' }, yt.id)
  await post('/recurring-entries', { type: 'expense', amount: 12000, currencyCode: 'TWD', dayOfMonth: 1,  label: '房租', assetId: ytCash.id, accountId: ytBank.id, effectiveFrom: '2024-12-01' }, yt.id)
  await post('/recurring-entries', { type: 'income',  amount: 0, quantity: 19,  currencyCode: 'TWD', dayOfMonth: 15, label: '定期定額', assetId: yt0050.id, accountId: ytBrok.id, effectiveFrom: '2024-12-01' }, yt.id)

  // 建宏
  await post('/recurring-entries', { type: 'income',  amount: 85000, currencyCode: 'TWD', dayOfMonth: 5,  label: '每月薪資', assetId: chCash.id, accountId: chBank.id, effectiveFrom: '2024-12-01' }, ch.id)
  await post('/recurring-entries', { type: 'expense', amount: 28000, currencyCode: 'TWD', dayOfMonth: 1,  label: '玉山房貸月繳', assetId: chCash.id, accountId: chBank.id, effectiveFrom: '2024-12-01' }, ch.id)
  await post('/recurring-entries', { type: 'expense', amount: 8875,  currencyCode: 'TWD', dayOfMonth: 1,  label: '中信車貸月繳', assetId: chCash.id, accountId: chBank.id, effectiveFrom: '2024-12-01' }, ch.id)
  await post('/recurring-entries', { type: 'income',  amount: 0, quantity: 213, currencyCode: 'TWD', dayOfMonth: 15, label: '定期定額', assetId: ch878.id, accountId: chBrok.id, effectiveFrom: '2024-12-01' }, ch.id)

  // Sarah
  await post('/recurring-entries', { type: 'income',  amount: 6500, currencyCode: 'USD', dayOfMonth: 15, label: 'Monthly salary', assetId: saCash.id, accountId: saBank.id, effectiveFrom: '2024-12-01' }, sa.id)
  await post('/recurring-entries', { type: 'expense', amount: 1800, currencyCode: 'USD', dayOfMonth: 1,  label: 'Apartment rent', assetId: saCash.id, accountId: saBank.id, effectiveFrom: '2024-12-01' }, sa.id)
  await post('/recurring-entries', { type: 'expense', amount: 380,  currencyCode: 'USD', dayOfMonth: 10, label: 'Federal student loan', assetId: saCash.id, accountId: saBank.id, effectiveFrom: '2024-12-01' }, sa.id)
  await post('/recurring-entries', { type: 'expense', amount: 500,  currencyCode: 'USD', dayOfMonth: 20, label: 'VOO DCA', assetId: saVOO.id, accountId: saBrok.id, effectiveFrom: '2024-12-01' }, sa.id)

  // Michael
  await post('/recurring-entries', { type: 'income',  amount: 12000, currencyCode: 'USD', dayOfMonth: 5,  label: 'Monthly salary', assetId: miCash.id, accountId: miBank.id, effectiveFrom: '2024-12-01' }, mi.id)
  await post('/recurring-entries', { type: 'income',  amount: 2200,  currencyCode: 'USD', dayOfMonth: 15, label: 'Rental income', assetId: miCash.id, accountId: miBank.id, effectiveFrom: '2024-12-01' }, mi.id)
  await post('/recurring-entries', { type: 'expense', amount: 3367,  currencyCode: 'USD', dayOfMonth: 1,  label: 'Primary home mortgage', assetId: miCash.id, accountId: miBank.id, effectiveFrom: '2019-04-01' }, mi.id)
  await post('/recurring-entries', { type: 'expense', amount: 1612,  currencyCode: 'USD', dayOfMonth: 1,  label: 'Rental property mortgage', assetId: miCash.id, accountId: miBank.id, effectiveFrom: '2021-08-01' }, mi.id)
  await post('/recurring-entries', { type: 'expense', amount: 1000,  currencyCode: 'USD', dayOfMonth: 20, label: 'QQQ DCA', assetId: miQQQ.id, accountId: miBrok.id, effectiveFrom: '2024-12-01' }, mi.id)
  await post('/recurring-entries', { type: 'expense', amount: 1000,  currencyCode: 'USD', dayOfMonth: 20, label: 'SPY DCA', assetId: miSPY.id, accountId: miBrok.id, effectiveFrom: '2024-12-01' }, mi.id)

  console.log('  ✓ recurring entries created')

  // ── 10. Rebuild snapshots with Yahoo Finance prices ───────────────────────
  // Now that Yahoo Finance daily prices are in the DB (step 7.5), rebuild all
  // snapshots again so daily price variation shows up in the charts. Holdings
  // are still at final (month-13) values at this point, but the per-month
  // snapshots created in step 8 already captured historical quantities.
  // This step only fills in any remaining gaps in the snapshot price resolution.
  console.log('\nAll done — snapshots built with historical holdings + Yahoo Finance prices.')

  console.log('\n=== Done! ===')
  console.log(`Created 4 demo users with 14 months of daily history each.`)
  console.log(`\nUser IDs:`)
  console.log(`  雅婷:   ${yt.id}`)
  console.log(`  建宏:   ${ch.id}`)
  console.log(`  Sarah:  ${sa.id}`)
  console.log(`  Michael:${mi.id}`)
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
