import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, FileDown, Upload, Lightbulb, Search, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAIService } from '@/features/ai/useAIService'
import { useBusinessSnapshot } from '@/features/ai/useBusinessSnapshot'
import { snapshotSystemMessage } from '@/features/ai/snapshotSystemMessage'
import { AIServiceError } from '@/features/ai/types'
import { extractFileContent, type ExtractedContent } from '@/features/smartImport/extractFileContent'
import { extractRowsWithAI } from '@/features/smartImport/aiExtractRows'
import { parseAiJsonObject } from '@/features/smartImport/parseAiJsonArray'
import { useProducts } from '@/features/stock/hooks'
import { importProductRows, PRODUCT_IMPORT_HEADERS, PRODUCT_IMPORT_FIELD_HINTS } from '@/features/stock/importProducts'
import {
  importStockCardRows,
  STOCK_CARD_IMPORT_HEADERS,
  STOCK_CARD_IMPORT_FIELD_HINTS,
} from '@/features/stock/importStockCard'
import { useCustomers } from '@/features/customers/hooks'
import { importCustomerRows, CUSTOMER_IMPORT_HEADERS, CUSTOMER_IMPORT_FIELD_HINTS } from '@/features/customers/importCustomers'
import { usePayments } from '@/features/payments/hooks'
import { importPaymentRows, PAYMENT_IMPORT_HEADERS, PAYMENT_IMPORT_FIELD_HINTS } from '@/features/payments/importPayments'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useSales } from '@/features/sales/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { exportTextReportToWord } from '@/lib/exportData'
import type { ImportSummary } from '@/lib/importData'

type ReportPeriod = 'gunluk' | 'haftalik' | 'aylik'

const periodLabels: Record<ReportPeriod, string> = {
  gunluk: 'Günlük',
  haftalik: 'Haftalık',
  aylik: 'Aylık',
}

type FileCategory = 'urun' | 'doktor' | 'tahsilat' | 'stok_hareket' | 'bilinmiyor'

const CATEGORY_VALUES: readonly FileCategory[] = ['urun', 'doktor', 'tahsilat', 'stok_hareket', 'bilinmiyor']

const CATEGORY_LABELS: Record<FileCategory, string> = {
  urun: 'Stok / Ürünler',
  doktor: 'Doktor / Cari',
  tahsilat: 'Tahsilat',
  stok_hareket: 'Stok Kartı (Satış/Numune Geçmişi)',
  bilinmiyor: 'Bilinmiyor',
}

export function AIInsightsPage() {
  const aiService = useAIService()
  const snapshot = useBusinessSnapshot()
  const queryClient = useQueryClient()

  const [question, setQuestion] = React.useState('')
  const [answer, setAnswer] = React.useState('')
  const [askLoading, setAskLoading] = React.useState(false)

  const [period, setPeriod] = React.useState<ReportPeriod>('gunluk')
  const [report, setReport] = React.useState('')
  const [reportLoading, setReportLoading] = React.useState(false)

  const [suggestions, setSuggestions] = React.useState('')
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false)

  const [fileName, setFileName] = React.useState('')
  const [fileContent, setFileContent] = React.useState<ExtractedContent | null>(null)
  const [fileSummary, setFileSummary] = React.useState('')
  const [fileCategory, setFileCategory] = React.useState<FileCategory | null>(null)
  // AI'ın tespiti yanlış çıkarsa ya da dosya örnek şablona benzemediği için
  // "bilinmiyor" dönerse, kullanıcı hedef bölümü elle seçip yine de
  // aktarabilsin diye — akış hiçbir zaman çıkmaz sokağa girmesin.
  const [manualCategory, setManualCategory] = React.useState<Exclude<FileCategory, 'bilinmiyor'> | ''>('')
  const [fileLoading, setFileLoading] = React.useState(false)
  const [routing, setRouting] = React.useState(false)
  const [routeResult, setRouteResult] = React.useState<{ category: FileCategory; summary: ImportSummary } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // "İlgili bölüme aktar" adımında hangi hedefe yazılacağını belirlemek için
  // gereken veriler — hepsi burada, tek yerde toplandı.
  const { data: allProducts = [] } = useProducts('')
  const { data: allCustomers = [] } = useCustomers('')
  const { data: allPayments = [] } = usePayments({})
  const { data: salesReps = [] } = useSalesReps()
  const { data: sales = [] } = useSales()
  const { data: sampleRequests = [] } = useSampleRequests()

  async function handleAsk() {
    if (!question.trim()) return
    setAskLoading(true)
    setAnswer('')
    try {
      const result = await aiService.chat([
        snapshotSystemMessage(snapshot),
        { role: 'user', content: question.trim() },
      ])
      setAnswer(result.content)
    } catch (err) {
      toast.error('Yanıt alınamadı', { description: err instanceof AIServiceError ? err.message : undefined })
    } finally {
      setAskLoading(false)
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true)
    setReport('')
    try {
      const result = await aiService.chat([
        snapshotSystemMessage(snapshot),
        {
          role: 'user',
          content: `Bu verilere dayanarak ${periodLabels[period].toLowerCase()} bir yönetim raporu yaz. Kritik stok/SKT riskleri, satış-tahsilat durumu, prim, numune dönüşümü, tahsilat riski ve açık CRM fırsatlarını kısa paragraflar halinde özetle. Sayısal verideki önemli noktaları vurgula.`,
        },
      ])
      setReport(result.content)
    } catch (err) {
      toast.error('Rapor oluşturulamadı', { description: err instanceof AIServiceError ? err.message : undefined })
    } finally {
      setReportLoading(false)
    }
  }

  async function handleSuggestions() {
    setSuggestionsLoading(true)
    setSuggestions('')
    try {
      const result = await aiService.chat([
        snapshotSystemMessage(snapshot),
        {
          role: 'user',
          content:
            'Bu verilere bakarak öncelik sırasına göre 5-8 maddelik somut aksiyon/görev önerisi listesi çıkar ' +
            '(örn. hangi doktorla iletişime geçilmeli, hangi ürün acil sipariş edilmeli, hangi taksit takip edilmeli). ' +
            'Ayrıca varsa normal dışı görünen bir durumu (anormallik) ayrıca belirt. Madde madde, kısa yaz.',
        },
      ])
      setSuggestions(result.content)
    } catch (err) {
      toast.error('Öneriler alınamadı', { description: err instanceof AIServiceError ? err.message : undefined })
    } finally {
      setSuggestionsLoading(false)
    }
  }

  /**
   * Excel/CSV, PDF, Word (.docx), resim veya .txt — hepsini aynı çıkarma
   * mantığıyla (bkz. Akıllı İçe Aktar / AI Asistan'ın da kullandığı
   * extractFileContent) okuyup AI'a özetletir. Taranmış/görsel PDF'lerde
   * metin katmanı yoksa otomatik olarak sayfa görsellerine düşülüp vision
   * ile okunuyor. Özetle birlikte AI'dan verinin programın hangi bölümüne
   * ait olduğunu da (kategori) belirlemesi istenir — tanınırsa aşağıda
   * "İlgili bölüme aktar" butonu çıkar (bkz. handleRouteToTarget).
   */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileLoading(true)
    setFileSummary('')
    setFileCategory(null)
    setManualCategory('')
    setRouteResult(null)
    setFileContent(null)
    setFileName(file.name)
    try {
      const content = await extractFileContent(file)
      setFileContent(content)

      const systemMessage =
        'Sen bu klinik yönetim programının bir parçasısın. Kullanıcının yüklediği belgeyi dikkatlice, EKSİKSİZ tara. ' +
        'İki şeyi belirle:\n' +
        '(1) "kategori": Bu veri programın hangi bölümüne ait — TAM OLARAK şu seçeneklerden biri: ' +
        '"urun" (stok/ürün kataloğu: ürün adı, kod, fiyat, stok miktarı gibi bilgiler), ' +
        '"doktor" (doktor/cari kart: isim, telefon, klinik/hastane, adres gibi), ' +
        '"tahsilat" (ödeme/tahsilat kaydı: doktor, tutar, tarih, ödeme yöntemi), ' +
        '"stok_hareket" (geçmiş satış/numune dökümü: hangi doktora hangi üründen kaç adet, ne zaman verildiği), ' +
        '"bilinmiyor" (yukarıdakilerden hiçbiri değilse ya da emin değilsen).\n' +
        '(2) "ozet": Kısa ama isabetli bir özet — belge ne içeriyor, kaç satır/kayıt/sayfa var, hangi alanlar ' +
        'göze çarpıyor, dikkat çekici bir örüntü/anormallik/hata var mı.\n' +
        'SADECE şu JSON objesini döndür (başka açıklama/metin ekleme): { "kategori": "...", "ozet": "..." }. ' +
        'SADECE TÜRKÇE yaz — başka bir dilde tek kelime bile yazma.'

      let result
      if (content.kind === 'table') {
        const preview = content.rows.slice(0, 50)
        result = await aiService.chat([
          { role: 'system', content: systemMessage },
          {
            role: 'user',
            content: `Dosya: ${file.name}\nToplam satır (bu örnekte): ${content.rows.length}\n\nÖrnek veri (JSON):\n${JSON.stringify(preview, null, 2)}`,
          },
        ])
      } else if (content.kind === 'image') {
        result = await aiService.chat([
          { role: 'system', content: systemMessage },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Dosya: ${file.name} — sayfa görselleri ekte, dikkatlice oku.` },
              ...content.dataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
            ],
          },
        ])
      } else {
        result = await aiService.chat([
          { role: 'system', content: systemMessage },
          { role: 'user', content: `Dosya: ${file.name}\n\nBelge içeriği:\n${content.text}` },
        ])
      }

      const parsed = parseAiJsonObject(result.content)
      const kategoriRaw = typeof parsed.kategori === 'string' ? parsed.kategori : 'bilinmiyor'
      const kategori = (CATEGORY_VALUES as string[]).includes(kategoriRaw) ? (kategoriRaw as FileCategory) : 'bilinmiyor'
      const ozet = typeof parsed.ozet === 'string' && parsed.ozet ? parsed.ozet : 'Özet oluşturulamadı.'

      setFileCategory(kategori)
      setManualCategory(kategori !== 'bilinmiyor' ? kategori : '')
      setFileSummary(ozet)
    } catch (err) {
      toast.error('Dosya özetlenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setFileLoading(false)
    }
  }

  /**
   * Tespit edilen kategoriye göre dosyayı ilgili bölümün AI çıkarım
   * şemasıyla (StockPage/CustomersPage/PaymentsPage/StockCardPanel'in
   * "Akıllı İçe Aktar"ıyla AYNI standalone fonksiyonlar — tekrar yazılmadı)
   * yeniden AI'a okutup kayıtları oluşturur. Sonuçta hangi bölüme kaç kayıt
   * eklendiği/atlandığı/hata verdiği açıkça gösterilir.
   */
  async function handleRouteToTarget() {
    const targetCategory = manualCategory
    if (!fileContent || !targetCategory) return
    setRouting(true)
    try {
      let summary: ImportSummary
      switch (targetCategory) {
        case 'urun': {
          const rows = await extractRowsWithAI(aiService, fileContent, 'stok/ürün', PRODUCT_IMPORT_HEADERS, PRODUCT_IMPORT_FIELD_HINTS)
          summary = await importProductRows(rows, allProducts)
          if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['products'] })
          break
        }
        case 'doktor': {
          const rows = await extractRowsWithAI(aiService, fileContent, 'doktor/cari kart', CUSTOMER_IMPORT_HEADERS, CUSTOMER_IMPORT_FIELD_HINTS)
          summary = await importCustomerRows(rows, allCustomers)
          if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['customers'] })
          break
        }
        case 'tahsilat': {
          const rows = await extractRowsWithAI(aiService, fileContent, 'tahsilat/ödeme', PAYMENT_IMPORT_HEADERS, PAYMENT_IMPORT_FIELD_HINTS)
          summary = await importPaymentRows(rows, allPayments, allCustomers, salesReps)
          if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['payments'] })
          break
        }
        case 'stok_hareket': {
          const rows = await extractRowsWithAI(
            aiService,
            fileContent,
            'stok kartı satış/numune',
            STOCK_CARD_IMPORT_HEADERS,
            STOCK_CARD_IMPORT_FIELD_HINTS,
          )
          summary = await importStockCardRows(rows, allProducts, allCustomers, sales, sampleRequests)
          if (summary.added > 0) {
            await queryClient.invalidateQueries({ queryKey: ['sales'] })
            await queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
          }
          break
        }
      }
      setRouteResult({ category: targetCategory, summary })
      if (summary.added > 0) {
        toast.success(`${summary.added} kayıt "${CATEGORY_LABELS[targetCategory]}" bölümüne eklendi`)
      } else {
        toast.info('Eklenecek yeni kayıt bulunamadı')
      }
    } catch (err) {
      toast.error('Aktarılamadı', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setRouting(false)
    }
  }

  async function handleExportReport() {
    if (!report) return
    await exportTextReportToWord(`${periodLabels[period]} Yönetim Raporu`, `yonetim-raporu-${period}`, report)
  }

  return (
    <div>
      <PageHeader
        title="Yapay Zeka Analiz"
        description="Mevcut AIService üzerine kurulu: gerçek verilere dayanan soru-cevap, yönetim raporu ve öneriler"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4 text-primary" /> Doğal Dil Soru-Cevap
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea
              rows={2}
              placeholder="Örn. Bu ay hangi temsilci en çok prim kazandı?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Button onClick={handleAsk} disabled={askLoading || !question.trim()} className="w-fit">
              {askLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Sor
            </Button>
            {answer && <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{answer}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-primary" /> Akıllı Öneriler / Anormallik Tespiti
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button onClick={handleSuggestions} disabled={suggestionsLoading} className="w-fit">
              {suggestionsLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Önerileri Getir
            </Button>
            {suggestions && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{suggestions}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Otomatik Yönetim Raporu</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateReport} disabled={reportLoading}>
                {reportLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Rapor Oluştur
              </Button>
              {report && (
                <Button variant="outline" onClick={handleExportReport}>
                  <FileDown /> Word'e Aktar
                </Button>
              )}
            </div>
            {report && <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{report}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dosya Özetle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={fileLoading} className="w-fit">
              {fileLoading ? <Loader2 className="animate-spin" /> : <Upload />}
              Dosya Yükle
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.xlsx,.xls,.csv,.pdf,.docx,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <p className="text-muted-foreground text-xs">
              Excel, CSV, PDF, Word (.docx), resim veya .txt yükleyin — taranmış PDF'ler de görsel olarak okunur.
              Stok/ürün, doktor/cari, tahsilat ya da geçmiş satış/numune verisi olduğu sürece, dosya örnek bir
              şablona benzemese bile, hedef bölümü kendiniz seçip içeri aktarabilirsiniz.
            </p>
            {fileName && fileLoading && (
              <p className="text-muted-foreground text-sm">{fileName} taranıyor...</p>
            )}
            {fileSummary && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{fileSummary}</p>
            )}
            {fileCategory && !routeResult && (
              <div className="grid gap-2 rounded-lg border bg-primary/5 p-3">
                <p className="text-sm">
                  {fileCategory === 'bilinmiyor'
                    ? 'Yapay zeka bu dosyanın hangi bölüme ait olduğundan emin olamadı — örnek şablona benzemiyor olabilir. Aşağıdan hedef bölümü siz seçebilirsiniz, veri yine de doğru içeri aktarılır.'
                    : `Bu dosya ${CATEGORY_LABELS[fileCategory]} bölümüne ait görünüyor — gerekirse aşağıdan değiştirebilirsiniz.`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={manualCategory}
                    onValueChange={(v) => setManualCategory(v as Exclude<FileCategory, 'bilinmiyor'>)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Hedef bölüm seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_VALUES.filter((c) => c !== 'bilinmiyor').map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleRouteToTarget} disabled={routing || !manualCategory}>
                    {routing ? <Loader2 className="animate-spin" /> : <ArrowRight className="size-3.5" />}
                    Bölüme Aktar
                  </Button>
                </div>
              </div>
            )}
            {routeResult && (
              <div className="rounded-lg border bg-success/10 p-3 text-sm">
                <p>
                  <strong>{fileName}</strong> dosyası <strong>{CATEGORY_LABELS[routeResult.category]}</strong> bölümüne
                  aktarıldı: <strong>{routeResult.summary.added}</strong> kayıt eklendi
                  {routeResult.summary.skipped > 0 ? `, ${routeResult.summary.skipped} atlandı (zaten kayıtlı)` : ''}
                  {routeResult.summary.errors.length > 0 ? `, ${routeResult.summary.errors.length} hata` : ''}.
                </p>
                {routeResult.summary.errors.length > 0 && (
                  <ul className="text-destructive mt-1.5 list-inside list-disc text-xs">
                    {routeResult.summary.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {routeResult.summary.errors.length > 5 && <li>...ve {routeResult.summary.errors.length - 5} tane daha</li>}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
