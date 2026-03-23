import { TickersRepository } from './tickers.repository'

const US_EXCHANGES = new Set(['NMS', 'NYQ', 'PCX', 'BATS', 'ASE', 'NCM', 'NIM', 'NGM'])

// Taiwan stock code patterns
// Stock: 4-digit numeric starting with 1-9 (e.g. 2330, 1101)
// ETF:   4-5 digit numeric starting with 0 (e.g. 0050, 00878)
function classifyTW(code: string): 'stock' | 'etf' | null {
  if (!/^\d+$/.test(code)) return null          // has letters → warrant/right, skip
  if (/^[1-9]\d{3}$/.test(code)) return 'stock' // 4-digit 1xxx-9xxx
  if (/^0\d{3,4}$/.test(code)) return 'etf'     // 4-5 digit starting with 0
  return null                                    // 6-digit warrants, etc. → skip
}

export class TickersService {
  constructor(private repo: TickersRepository) {}

  async search(q: string, country?: string) {
    if (!q) return []
    if (country === 'US') return this.searchYahoo(q)
    if (country === 'TW') return this.searchTWSE(q)
    if (country === 'Crypto') return this.searchCrypto(q)
    // Both: run in parallel
    const [tw, us] = await Promise.all([this.searchTWSE(q), this.searchYahoo(q)])
    return [...tw, ...us].slice(0, 20)
  }

  private async searchTWSE(q: string) {
    try {
      const url = `https://www.twse.com.tw/rwd/zh/api/codeQuery?query=${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.twse.com.tw' },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) return []
      const data = await res.json() as { suggestions?: string[] }
      return (data.suggestions ?? [])
        .map(s => {
          const [code, ...nameParts] = s.split('\t')
          const name = nameParts.join('\t')
          const type = classifyTW(code)
          if (!type) return null
          return { symbol: `${code}.TW`, name, type, exchange: 'TWSE', country: 'TW' }
        })
        .filter(Boolean) as { symbol: string; name: string; type: string; exchange: string; country: string }[]
    } catch {
      return []
    }
  }

  private async searchYahoo(q: string) {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) return []
      const data = await res.json() as any
      return (data.quotes ?? [])
        .filter((r: any) => US_EXCHANGES.has(r.exchange) && ['EQUITY', 'ETF'].includes(r.quoteType))
        .map((r: any) => ({
          symbol: r.symbol as string,
          name: (r.longname || r.shortname || r.symbol) as string,
          type: r.quoteType === 'ETF' ? 'etf' : 'stock',
          exchange: (r.exchDisp || r.exchange) as string,
          country: 'US',
        }))
    } catch {
      return []
    }
  }

  private async searchCrypto(q: string) {
    try {
      const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return []
      const data = await res.json() as { coins?: { id: string; name: string; symbol: string; market_cap_rank: number | null }[] }
      return (data.coins ?? [])
        .slice(0, 20)
        .map(c => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          type: 'crypto' as const,
          exchange: 'Crypto',
          country: null,
        }))
    } catch {
      return []
    }
  }

  // No-op: TW tickers are now fetched real-time from TWSE API
  async seedTaiwanStocks() {
    console.log('TW tickers: using real-time TWSE search (no seeding needed)')
  }
}
