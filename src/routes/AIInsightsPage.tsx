import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, FileDown, Upload, Lightbulb, Search, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
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

type RoutableCategory = Exclude<FileCategory, 'bilinmiyor'>

/** Her kategori için AI çıkarım şeması — hem ilk aktarımda hem hatalı
 * satırları düzeltip tekrar denerken (bkz. handleRetrySection) kullanılır. */
const CATEGORY_IMPORT_CONFIG: Record<
  RoutableCategory,
  { label: string; headers: string[]; hints?: Record<string, string> }
> = {
  urun: { label: 'stok/ürün', headers: PRODUCT_IMPORT_HEADERS, hints: PRODUCT_IMPORT_FIELD_HINTS },
  doktor: { label: 'doktor/cari kart', headers: CUSTOMER_IMPORT_HEADERS, hints: CUSTOMER_IMPORT_FIELD_HINTS },
  tahsilat: { label: 'tahsilat/ödeme', headers: PAYMENT_IMPORT_HEADERS, hints: PAYMENT_IMPORT_FIELD_HINTS },
  stok_hareket: {
    label: 'stok kartı satış/numune',
    headers: STOCK_CARD_IMPORT_HEADERS,
    hints: STOCK_CARD_IMPORT_FIELD_HINTS,
  },
}

/** Yüklenen dosyanın bir "bölümü" — tek sayfalık bir dosyada bu tektir, çok
 * sekmeli bir Excel'de her sekme kendi FileSection'ıdır (bkz. `sections`). */
interface FileSection {
  /** Çok sekmeli bir dosyada sekme adı; tek bölümlü dosyalarda dosya adı. */
  name: string
  content: ExtractedContent
  summary: string
  category: FileCategory
  manualCategory: RoutableCategory | ''
  routing: boolean
  routeResult: { category: RoutableCategory; summary: ImportSummary } | null
  // AI'dan çıkarılan ham satırlar — hata veren satırları elle düzeltip TEK
  // TEK "tekrar dene" yapabilmek için saklanıyor (bkz. handleRetrySection).
  extractedRows: Record<string, unknown>[] | null
  // Kullanıcının hatalı satırlarda yaptığı düzeltmeler — satır indeksine göre.
  correctionDrafts: Record<number, Record<string, unknown>>
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
  const [fileLoading, setFileLoading] = React.useState(false)
  // Yüklenen dosya tek sayfalık (PDF/Word/resim/tek sekmeli Excel) ise TEK
  // elemanlı, çok sekmeli bir Excel çalışma kitabıysa (ör. bir sekmede
  // doktorlar, başka bir sekmede ürünler) sekme SAYISI kadar elemanlıdır —
  // her biri kendi özetini/kategorisini/aktarım durumunu bağımsız tutar.
  const [sections, setSections] = React.useState<FileSection[]>([])
  const [bulkRouting, setBulkRouting] = React.useState(false)
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

  const systemCategorizeMessage =
    'Sen bu klinik yönetim programının bir parçasısın. Kullanıcının yüklediği belgeyi/sayfayı dikkatlice, EKSİKSİZ tara. ' +
    'İki şeyi belirle:\n' +
    '(1) "kategori": Bu veri programın hangi bölümüne ait — TAM OLARAK şu seçeneklerden biri: ' +
    '"urun" (stok/ürün kataloğu: ürün adı, kod, fiyat, stok miktarı gibi bilgiler), ' +
    '"doktor" (doktor/cari kart: isim, telefon, klinik/hastane, adres gibi), ' +
    '"tahsilat" (ödeme/tahsilat kaydı: doktor, tutar, tarih, ödeme yöntemi), ' +
    '"stok_hareket" (geçmiş satış/numune dökümü: hangi doktora hangi üründen kaç adet, ne zaman verildiği), ' +
    '"bilinmiyor" (yukarıdakilerden hiçbiri değilse ya da emin değilsen).\n' +
    '(2) "ozet": Kısa ama isabetli bir özet — bu bölüm ne içeriyor, kaç satır/kayıt var, hangi alanlar ' +
    'göze çarpıyor, dikkat çekici bir örüntü/anormallik/hata var mı.\n' +
    'SADECE şu JSON objesini döndür (başka açıklama/metin ekleme): { "kategori": "...", "ozet": "..." }. ' +
    'SADECE TÜRKÇE yaz — başka bir dilde tek kelime bile yazma.'

  /** Tek bir bölümü (tam dosya ya da bir Excel sekmesi) AI'a kategori+özet
   * için sorar — çok sekmeli dosyalarda handleFileUpload bunu her sekme için
   * ayrı ayrı çağırır. */
  async function categorizeSection(
    displayLabel: string,
    content: ExtractedContent,
  ): Promise<{ kategori: FileCategory; ozet: string }> {
    let result
    if (content.kind === 'table') {
      const rows = content.sheets[0]?.rows ?? []
      const preview = rows.slice(0, 50)
      result = await aiService.chat([
        { role: 'system', content: systemCategorizeMessage },
        {
          role: 'user',
          content: `Dosya/sayfa: ${displayLabel}\nToplam satır (bu örnekte): ${rows.length}\n\nÖrnek veri (JSON):\n${JSON.stringify(preview, null, 2)}`,
        },
      ])
    } else if (content.kind === 'image') {
      result = await aiService.chat([
        { role: 'system', content: systemCategorizeMessage },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Dosya: ${displayLabel} — sayfa görselleri ekte, dikkatlice oku.` },
            ...content.dataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ],
        },
      ])
    } else {
      result = await aiService.chat([
        { role: 'system', content: systemCategorizeMessage },
        { role: 'user', content: `Dosya: ${displayLabel}\n\nBelge içeriği:\n${content.text}` },
      ])
    }

    const parsed = parseAiJsonObject(result.content)
    const kategoriRaw = typeof parsed.kategori === 'string' ? parsed.kategori : 'bilinmiyor'
    const kategori = (CATEGORY_VALUES as string[]).includes(kategoriRaw) ? (kategoriRaw as FileCategory) : 'bilinmiyor'
    const ozet = typeof parsed.ozet === 'string' && parsed.ozet ? parsed.ozet : 'Özet oluşturulamadı.'
    return { kategori, ozet }
  }

  /**
   * Excel/CSV, PDF, Word (.docx), resim veya .txt — hepsini aynı çıkarma
   * mantığıyla (bkz. Akıllı İçe Aktar / AI Asistan'ın da kullandığı
   * extractFileContent) okuyup AI'a özetletir. Taranmış/görsel PDF'lerde
   * metin katmanı yoksa otomatik olarak sayfa görsellerine düşülüp vision
   * ile okunuyor. Bir Excel dosyasında BİRDEN FAZLA sekme varsa (ör. bir
   * sekmede doktorlar, başka bir sekmede ürünler) her sekme AYRI bir "bölüm"
   * (FileSection) olarak ele alınır ve TEK TEK kategori+özet için AI'a
   * sorulur — böylece karışık/çok bölümlü bir dosyanın tamamı, her sekme
   * kendi doğru hedefine yönlendirilerek içeri aktarılabilir (bkz.
   * handleRouteSection / handleRouteAllSections).
   */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileLoading(true)
    setSections([])
    setFileName(file.name)
    try {
      const content = await extractFileContent(file)
      const rawSections: { name: string; content: ExtractedContent }[] =
        content.kind === 'table'
          ? content.sheets
              .filter((sheet) => sheet.rows.length > 0)
              .map((sheet) => ({ name: sheet.name, content: { kind: 'table', sheets: [sheet] } as ExtractedContent }))
          : [{ name: file.name, content }]

      if (rawSections.length === 0) throw new Error('Dosyada okunacak veri bulunamadı')

      const newSections: FileSection[] = []
      for (const raw of rawSections) {
        const displayLabel = rawSections.length > 1 ? `${file.name} — sayfa: ${raw.name}` : file.name
        const { kategori, ozet } = await categorizeSection(displayLabel, raw.content)
        newSections.push({
          name: raw.name,
          content: raw.content,
          summary: ozet,
          category: kategori,
          manualCategory: kategori !== 'bilinmiyor' ? kategori : '',
          routing: false,
          routeResult: null,
          extractedRows: null,
          correctionDrafts: {},
        })
      }
      setSections(newSections)
    } catch (err) {
      toast.error('Dosya özetlenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setFileLoading(false)
    }
  }

  /** Belirli bir kategori için satırları ilgili bölümün import fonksiyonuna
   * yazdırır (StockPage/CustomersPage/PaymentsPage/StockCardPanel'in "Akıllı
   * İçe Aktar"ıyla AYNI standalone fonksiyonlar) — hem ilk aktarımda hem
   * hatalı satırlar düzeltilip tekrar denenirken bu TEK fonksiyon kullanılır. */
  async function importRowsForCategory(
    category: RoutableCategory,
    rows: Record<string, unknown>[],
  ): Promise<ImportSummary> {
    switch (category) {
      case 'urun': {
        const summary = await importProductRows(rows, allProducts)
        if (summary.added > 0 || (summary.updated ?? 0) > 0) {
          await queryClient.invalidateQueries({ queryKey: ['products'] })
        }
        return summary
      }
      case 'doktor': {
        const summary = await importCustomerRows(rows, allCustomers)
        if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['customers'] })
        return summary
      }
      case 'tahsilat': {
        const summary = await importPaymentRows(rows, allPayments, allCustomers, salesReps)
        if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['payments'] })
        return summary
      }
      case 'stok_hareket': {
        const summary = await importStockCardRows(rows, allProducts, allCustomers, sales, sampleRequests)
        if (summary.added > 0) {
          await queryClient.invalidateQueries({ queryKey: ['sales'] })
          await queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
        }
        return summary
      }
    }
  }

  function updateSection(index: number, patch: Partial<FileSection> | ((s: FileSection) => Partial<FileSection>)) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)),
    )
  }

  /**
   * Bir bölümü (dosyanın tamamı ya da tek bir Excel sekmesi), tespit edilen
   * (ya da elle seçilen) kategoriye göre ilgili bölümün AI çıkarım
   * şemasıyla yeniden AI'a okutup kayıtları oluşturur. Çıkarılan ham
   * satırlar `section.extractedRows`'a saklanır ki hata veren satırlar
   * varsa kullanıcı bunları elle düzeltip tekrar deneyebilsin (bkz.
   * handleRetrySection) — dosyayı düzeltip yeniden yüklemek zorunda
   * kalmadan. `handleRouteAllSections` çok sekmeli dosyalarda bunu her
   * sekme için sırayla çağırır.
   */
  async function handleRouteSection(index: number, section: FileSection) {
    const targetCategory = section.manualCategory
    if (!targetCategory) return
    updateSection(index, { routing: true })
    try {
      const cfg = CATEGORY_IMPORT_CONFIG[targetCategory]
      const rows = await extractRowsWithAI(aiService, section.content, cfg.label, cfg.headers, cfg.hints)
      const summary = await importRowsForCategory(targetCategory, rows)
      updateSection(index, {
        routing: false,
        extractedRows: rows,
        correctionDrafts: {},
        routeResult: { category: targetCategory, summary },
      })
      const suffix = sections.length > 1 ? ` (${section.name})` : ''
      const updatedCount = summary.updated ?? 0
      if (summary.added > 0 || updatedCount > 0) {
        const parts = [
          summary.added > 0 ? `${summary.added} eklendi` : '',
          updatedCount > 0 ? `${updatedCount} güncellendi` : '',
        ].filter(Boolean)
        toast.success(`"${CATEGORY_LABELS[targetCategory]}" bölümü${suffix}: ${parts.join(', ')}`)
      } else {
        toast.info(`Eklenecek/güncellenecek kayıt bulunamadı${suffix}`)
      }
    } catch (err) {
      updateSection(index, { routing: false })
      toast.error('Aktarılamadı', { description: err instanceof Error ? err.message : undefined })
    }
  }

  /** Çok sekmeli bir dosyada, hedef bölümü seçilmiş (ve henüz aktarılmamış)
   * TÜM sekmeleri sırayla aktarır — kullanıcı her sekmeye ayrı ayrı
   * tıklamak zorunda kalmasın diye. */
  async function handleRouteAllSections() {
    setBulkRouting(true)
    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        if (section.manualCategory && !section.routeResult) {
          await handleRouteSection(i, section)
        }
      }
    } finally {
      setBulkRouting(false)
    }
  }

  /** `summary.errors`'daki her mesaj "Satır N: ..." ile başlar (bkz. import*Rows
   * fonksiyonları) — N'den `section.extractedRows` içindeki satır indeksini
   * geri çıkarıp hatalı satırları elle düzenlenebilir hale getiriyoruz. */
  function getFailedRowRefs(section: FileSection) {
    if (!section.routeResult || !section.extractedRows) return []
    const refs: { index: number; rowLabel: string; message: string }[] = []
    for (const err of section.routeResult.summary.errors) {
      const m = err.match(/^Satır (\d+):\s*(.*)$/)
      if (!m) continue
      const index = Number(m[1]) - 2
      if (index >= 0 && index < section.extractedRows.length) refs.push({ index, rowLabel: m[1], message: m[2] })
    }
    return refs
  }

  /** Hatalı satırları kullanıcının düzelttiği değerlerle birleştirip TÜM
   * satırları (sadece hatalılar değil) aynı import fonksiyonuna yeniden
   * gönderir — daha önce başarıyla eklenenler artık veritabanında var
   * olduğu için "zaten kayıtlı" olarak atlanır, sadece düzeltilenler
   * gerçekten eklenir. Böylece satır numaralandırması hep dosyadaki gerçek
   * sırayla tutarlı kalır. */
  async function handleRetrySection(index: number, section: FileSection) {
    if (!section.routeResult || !section.extractedRows) return
    const mergedRows = section.extractedRows.map((row, i) => section.correctionDrafts[i] ?? row)
    updateSection(index, { routing: true })
    try {
      const retrySummary = await importRowsForCategory(section.routeResult.category, mergedRows)
      updateSection(index, {
        routing: false,
        routeResult: { category: section.routeResult.category, summary: retrySummary },
        correctionDrafts: {},
      })
      if (retrySummary.errors.length === 0) {
        toast.success('Düzeltilen satırlar da eklendi, hata kalmadı')
      } else if (retrySummary.added > 0) {
        toast.success(`${retrySummary.added} kayıt daha eklendi, ${retrySummary.errors.length} satır hâlâ düzeltilmeli`)
      } else {
        toast.error(`${retrySummary.errors.length} satır hâlâ düzeltilmeli`)
      }
    } catch (err) {
      updateSection(index, { routing: false })
      toast.error('Tekrar denenemedi', { description: err instanceof Error ? err.message : undefined })
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
              Bir Excel dosyasında birden fazla sayfa/sekme varsa (ör. bir sekmede doktorlar, başka bir sekmede
              ürünler) her sekme ayrı ayrı okunup kendi bölümüne aktarılabilir. Stok/ürün, doktor/cari, tahsilat ya
              da geçmiş satış/numune verisi olduğu sürece, dosya örnek bir şablona benzemese bile, hedef bölümü
              kendiniz seçip içeri aktarabilirsiniz.
            </p>
            {fileName && fileLoading && (
              <p className="text-muted-foreground text-sm">{fileName} taranıyor...</p>
            )}
            {sections.length > 1 && !fileLoading && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2">
                <p className="text-sm">
                  <strong>{fileName}</strong> — {sections.length} sayfa bulundu
                </p>
                <Button
                  size="sm"
                  onClick={handleRouteAllSections}
                  disabled={bulkRouting || sections.every((s) => !s.manualCategory || s.routeResult)}
                >
                  {bulkRouting ? <Loader2 className="animate-spin" /> : <ArrowRight className="size-3.5" />}
                  Tümünü İlgili Bölümlere Aktar
                </Button>
              </div>
            )}
            {sections.map((section, idx) => {
              const failedRowRefs = getFailedRowRefs(section)
              return (
                <div key={idx} className="grid gap-2.5 rounded-lg border p-3">
                  {sections.length > 1 && <p className="text-sm font-semibold">{section.name}</p>}
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{section.summary}</p>
                  {!section.routeResult && (
                    <div className="grid gap-2 rounded-lg border bg-primary/5 p-3">
                      <p className="text-sm">
                        {section.category === 'bilinmiyor'
                          ? `Yapay zeka bu ${sections.length > 1 ? 'sayfanın' : 'dosyanın'} hangi bölüme ait olduğundan emin olamadı — örnek şablona benzemiyor olabilir. Aşağıdan hedef bölümü siz seçebilirsiniz, veri yine de doğru içeri aktarılır.`
                          : `Bu ${sections.length > 1 ? 'sayfa' : 'dosya'} ${CATEGORY_LABELS[section.category]} bölümüne ait görünüyor — gerekirse aşağıdan değiştirebilirsiniz.`}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={section.manualCategory}
                          onValueChange={(v) => updateSection(idx, { manualCategory: v as RoutableCategory })}
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
                        <Button
                          size="sm"
                          onClick={() => handleRouteSection(idx, section)}
                          disabled={section.routing || bulkRouting || !section.manualCategory}
                        >
                          {section.routing ? <Loader2 className="animate-spin" /> : <ArrowRight className="size-3.5" />}
                          Bölüme Aktar
                        </Button>
                      </div>
                    </div>
                  )}
                  {section.routeResult && (
                    <div className="rounded-lg border bg-success/10 p-3 text-sm">
                      <p>
                        {sections.length > 1 ? (
                          <>Bu sayfa</>
                        ) : (
                          <>
                            <strong>{fileName}</strong> dosyası
                          </>
                        )}{' '}
                        <strong>{CATEGORY_LABELS[section.routeResult.category]}</strong> bölümüne aktarıldı:{' '}
                        <strong>{section.routeResult.summary.added}</strong> kayıt eklendi
                        {(section.routeResult.summary.updated ?? 0) > 0
                          ? `, ${section.routeResult.summary.updated} kayıt güncellendi`
                          : ''}
                        {section.routeResult.summary.skipped > 0
                          ? `, ${section.routeResult.summary.skipped} atlandı (değişiklik yok)`
                          : ''}
                        {section.routeResult.summary.errors.length > 0
                          ? `, ${section.routeResult.summary.errors.length} hata`
                          : ''}
                        .
                      </p>
                      {section.routeResult.summary.errors.length > 0 && (
                        <ul className="text-destructive mt-1.5 list-inside list-disc text-xs">
                          {section.routeResult.summary.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {section.routeResult.summary.errors.length > 5 && (
                            <li>...ve {section.routeResult.summary.errors.length - 5} tane daha</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  {section.routeResult && failedRowRefs.length > 0 && section.extractedRows && (
                    <div className="grid gap-2.5 rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        Hatalı {failedRowRefs.length} satırı aşağıdan düzenleyip tekrar deneyebilirsiniz — dosyayı
                        yeniden yüklemeniz gerekmez.
                      </p>
                      <div className="grid gap-2">
                        {failedRowRefs.map(({ index, rowLabel, message }) => {
                          const headers = CATEGORY_IMPORT_CONFIG[section.routeResult!.category].headers
                          const draft = section.correctionDrafts[index] ?? section.extractedRows![index]
                          return (
                            <div key={index} className="bg-muted/20 rounded-md border p-2">
                              <p className="text-destructive mb-1.5 text-xs">
                                Satır {rowLabel}: {message}
                              </p>
                              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {headers.map((h) => (
                                  <div key={h} className="grid gap-0.5">
                                    <label className="text-muted-foreground text-[11px]">{h}</label>
                                    <Input
                                      value={String(draft[h] ?? '')}
                                      onChange={(e) =>
                                        updateSection(idx, (s) => ({
                                          correctionDrafts: {
                                            ...s.correctionDrafts,
                                            [index]: { ...(s.correctionDrafts[index] ?? s.extractedRows![index]), [h]: e.target.value },
                                          },
                                        }))
                                      }
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <Button
                        size="sm"
                        className="w-fit"
                        onClick={() => handleRetrySection(idx, section)}
                        disabled={section.routing}
                      >
                        {section.routing ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
                        Düzeltilenleri Tekrar Dene
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
