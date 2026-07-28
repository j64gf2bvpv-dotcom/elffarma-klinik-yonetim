export interface ExchangeRate {
  currency: 'USD' | 'EUR'
  rate: number
  date: string
}

async function fetchRate(currency: 'USD' | 'EUR'): Promise<ExchangeRate> {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${currency}&to=TRY`)
  if (!res.ok) throw new Error('Kur bilgisi alınamadı')
  const data = (await res.json()) as { date: string; rates: Record<string, number> }
  return { currency, rate: data.rates.TRY, date: data.date }
}

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  return Promise.all([fetchRate('USD'), fetchRate('EUR')])
}
