import * as React from 'react'
import { format } from 'date-fns'
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Coins, DollarSign } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useExchangeRates } from './hooks'

/**
 * Ana ekranda dolar / euro kuru + TL çevirici (kullanıcı isteği, 2026-10-21).
 * İlk istek "saniyelik"ti; aynı gün "10 dakikada bir güncellensin" olarak
 * değişti — kur 10 dakikada bir (ve sekme/pencere tekrar öne gelince) yüklenir.
 * Kaynak: Binance herkese açık piyasa verisi (anahtar gerektirmez) —
 * USD/TL = USDT/TRY, EUR/TL = USDT/TRY × EUR/USDT. Piyasa kuru olduğu için
 * resmi (Merkez Bankası / ECB) kurdan küçük fark olabilir — kartta günlük resmi
 * kur da referans olarak yazar.
 */

interface Quote {
  price: number
  /** 24 saatlik değişim, yüzde */
  changePct: number
}

interface LiveRates {
  usd: Quote | null
  eur: Quote | null
  updatedAt: Date | null
  live: boolean
}

const REST_URL = 'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22USDTTRY%22,%22EURUSDT%22%5D'

function combine(usdTry: Quote | null, eurUsd: Quote | null): Quote | null {
  if (!usdTry || !eurUsd) return null
  return {
    price: usdTry.price * eurUsd.price,
    changePct: ((1 + usdTry.changePct / 100) * (1 + eurUsd.changePct / 100) - 1) * 100,
  }
}

/** Kur yenileme aralığı — 10 dakika (kullanıcı isteği, 2026-10-21). */
const REFRESH_MS = 10 * 60 * 1000

function useLiveRates(): LiveRates {
  const [state, setState] = React.useState<LiveRates>({ usd: null, eur: null, updatedAt: null, live: false })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(REST_URL)
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string }[]
        let usdTry: Quote | null = null
        let eurUsd: Quote | null = null
        for (const t of data) {
          const q = { price: Number(t.lastPrice), changePct: Number(t.priceChangePercent) }
          if (t.symbol === 'USDTTRY') usdTry = q
          if (t.symbol === 'EURUSDT') eurUsd = q
        }
        if (!cancelled) setState({ usd: usdTry, eur: combine(usdTry, eurUsd), updatedAt: new Date(), live: true })
      } catch {
        if (!cancelled) setState((s) => ({ ...s, live: false }))
      }
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    // Bilgisayar uykudan / pencere arka plandan dönünce bekletmeden tazele
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return state
}

const fmt = (n: number, digits = 4) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: digits })

/** Fiyat değiştikçe yeşil (artış) / kırmızı (düşüş) kısa bir parlama. */
function RateTile({ label, flag, quote }: { label: string; flag: string; quote: Quote | null }) {
  const prev = React.useRef<number | null>(null)
  const [flash, setFlash] = React.useState<'up' | 'down' | null>(null)
  React.useEffect(() => {
    if (!quote) return
    if (prev.current != null && quote.price !== prev.current) {
      setFlash(quote.price > prev.current ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 700)
      prev.current = quote.price
      return () => clearTimeout(t)
    }
    prev.current = quote.price
  }, [quote])

  const up = (quote?.changePct ?? 0) >= 0
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors duration-500',
        flash === 'up' && 'border-success/50 bg-success/10',
        flash === 'down' && 'border-destructive/50 bg-destructive/10',
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {flag} {label}
      </p>
      <p
        className={cn(
          'text-2xl font-bold tabular-nums transition-colors duration-500',
          flash === 'up' && 'text-success',
          flash === 'down' && 'text-destructive',
        )}
      >
        {quote ? fmt(quote.price) : '—'} <span className="text-sm font-medium text-muted-foreground">TL</span>
      </p>
      {quote && (
        <p className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-success' : 'text-destructive')}>
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {up ? '+' : ''}
          {quote.changePct.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}% <span className="text-muted-foreground">(24 saat)</span>
        </p>
      )}
    </div>
  )
}

type Cur = 'USD' | 'EUR' | 'TRY'

export function LiveRatesCard({ className }: { className?: string }) {
  const rates = useLiveRates()
  const { data: official = [] } = useExchangeRates()
  // "x sn önce" yazısı canlı kalsın
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secondsAgo = rates.updatedAt ? Math.max(0, Math.round((now - rates.updatedAt.getTime()) / 1000)) : null

  return (
    <Card className={cn('@container', className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4 text-primary" /> Döviz Kuru
        </CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', rates.live ? 'animate-pulse bg-success' : 'bg-warning')} />
          {rates.live ? 'Güncel' : 'Bağlanıyor'}
          {secondsAgo != null && ` · ${secondsAgo < 60 ? 'az önce' : `${Math.floor(secondsAgo / 60)} dk önce`}`}
        </span>
      </CardHeader>
      <CardContent className="grid gap-3 @lg:grid-cols-[1fr_1fr_1.4fr]">
        <RateTile label="Dolar / TL" flag="🇺🇸" quote={rates.usd} />
        <RateTile label="Euro / TL" flag="🇪🇺" quote={rates.eur} />
        <RatesConverter rates={rates} className="rounded-xl border bg-muted/30 p-3" />
        <p className="text-[11px] text-muted-foreground @lg:col-span-3">
          Piyasa kuru (10 dakikada bir güncellenir). Resmi kurdan küçük fark olabilir
          {official.length > 0 &&
            ` — günlük resmi kur: ${official.map((o) => `${o.currency} ${fmt(o.rate, 3)}`).join(', ')} (${official[0].date})`}
          .
        </p>
      </CardContent>
    </Card>
  )
}

/** Döviz → TL (ve tersi) çevirici — kartta ve küçük kur satırının açılır penceresinde. */
function RatesConverter({ rates, className }: { rates: LiveRates; className?: string }) {
  const [amount, setAmount] = React.useState('100')
  const [from, setFrom] = React.useState<Cur>('USD')
  const toTry = (cur: Cur) => (cur === 'TRY' ? 1 : cur === 'USD' ? rates.usd?.price : rates.eur?.price) ?? null
  const n = Number(amount.replace(/\./g, '').replace(',', '.'))
  const valid = Number.isFinite(n) && amount.trim() !== ''
  const fromRate = toTry(from)
  const tl = valid && fromRate ? n * fromRate : null
  const targets: Cur[] = (['TRY', 'USD', 'EUR'] as Cur[]).filter((c) => c !== from)
  return (
    <div className={className}>
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeftRight className="size-3.5" /> Çevir
      </p>
      <div className="flex gap-2">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} className="h-9 flex-1 text-right tabular-nums" />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value as Cur)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Para birimi"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="TRY">TL</option>
        </select>
      </div>
      <div className="mt-2 grid gap-0.5 text-sm">
        {targets.map((c) => {
          const r = toTry(c)
          const v = tl != null && r ? tl / r : null
          return (
            <p key={c} className="flex justify-between gap-2">
              <span className="text-muted-foreground">= {c === 'TRY' ? 'TL' : c}</span>
              <span className={cn('font-semibold tabular-nums', c === 'TRY' && 'text-base text-primary')}>
                {v != null ? v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—'} {c === 'TRY' ? 'TL' : c}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}

/** Kur değişince kısa yeşil / kırmızı renk. */
function useFlash(price: number | undefined) {
  const prev = React.useRef<number | undefined>(undefined)
  const [flash, setFlash] = React.useState<'up' | 'down' | null>(null)
  React.useEffect(() => {
    if (price == null) return
    if (prev.current != null && price !== prev.current) {
      setFlash(price > prev.current ? 'up' : 'down')
      prev.current = price
      const t = setTimeout(() => setFlash(null), 700)
      return () => clearTimeout(t)
    }
    prev.current = price
  }, [price])
  return flash
}

function InlineQuote({ code, quote }: { code: string; quote: Quote | null }) {
  const flash = useFlash(quote?.price)
  const up = (quote?.changePct ?? 0) >= 0
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="font-medium">{code}</span>
      <span className={cn('transition-colors duration-500', flash === 'up' && 'text-success', flash === 'down' && 'text-destructive')}>
        {quote ? fmt(quote.price) : '—'}
      </span>
      {quote && (
        <span className={cn('inline-flex items-center', up ? 'text-success' : 'text-destructive')}>
          {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {quote.changePct.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%
        </span>
      )}
    </span>
  )
}

/**
 * Ana ekran başlığında saat / hava durumunun altında, aynı küçük yazıyla kur
 * satırı (kullanıcı isteği, 2026-10-21: "döviz kuru saat ve hava durumu kısmı
 * gibi küçük, aynı fontta olsun, altında olsun"). "TL çevir" küçük bir pencere açar.
 */
export function LiveRatesInline() {
  const rates = useLiveRates()
  return (
    <span className="flex flex-wrap items-center gap-3">
      <span className="flex shrink-0 items-center gap-1.5">
        <DollarSign className="size-3.5" />
        <InlineQuote code="USD" quote={rates.usd} />
      </span>
      <span className="text-border">|</span>
      <InlineQuote code="EUR" quote={rates.eur} />
      <span className="text-border">|</span>
      <span
        className="flex items-center gap-1"
        title={rates.live ? 'Piyasa kuru — 10 dakikada bir güncellenir' : 'Kur alınamadı, tekrar denenecek'}
      >
        <span className={cn('size-1.5 rounded-full', rates.live ? 'bg-success' : 'bg-warning')} />
        {rates.updatedAt ? format(rates.updatedAt, 'HH:mm') : 'yükleniyor'}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeftRight className="size-3.5" /> TL çevir
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <RatesConverter rates={rates} />
          <p className="mt-2 text-[11px] text-muted-foreground">Piyasa kuru, 10 dakikada bir güncellenir; resmi kurdan küçük fark olabilir.</p>
        </PopoverContent>
      </Popover>
    </span>
  )
}
