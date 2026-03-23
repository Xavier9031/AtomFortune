import { FxRatesRepository } from './fx-rates.repository'
import { FxRateManualCreateInput } from './fx-rates.schema'

export class FxRatesService {
  constructor(private repo: FxRatesRepository) {}

  findAll(filters: { from?: string; to?: string; fromDate?: string; toDate?: string }) {
    return this.repo.findAll(filters)
  }

  createManual(data: FxRateManualCreateInput) {
    return this.repo.upsert(
      data.fromCurrency, data.toCurrency, data.rateDate, String(data.rate), 'manual'
    )
  }
}
