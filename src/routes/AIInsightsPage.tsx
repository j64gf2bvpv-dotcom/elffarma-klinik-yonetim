import * as React from 'react'
import { Sparkles, Loader2, FileDown, Upload, Lightbulb, Search } from 'lucide-react'
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
import { readExcelFile } from '@/lib/importData'
import { exportTextReportToWord } from '@/lib/exportData'

type ReportPeriod = 'gunluk' | 'haftalik' | 'aylik'

const periodLabels: Record<ReportPeriod, string> = {
  gunluk: 'Günlük',
  haftalik: 'Haftalık',
  aylik: 'Aylık',
}

export function AIInsightsPage() {
  const aiService = useAIService()
  const snapshot = useBusinessSnapshot()

  const [question, setQuestion] = React.useState('')
  const [answer, setAnswer] = React.useState('')
  const [askLoading, setAskLoading] = React.useState(false)

  const [period, setPeriod] = React.useState<ReportPeriod>('gunluk')
  const [report, setReport] = React.useState('')
  const [reportLoading, setReportLoading] = React.useState(false)

  const [suggestions, setSuggestions] = React.useState('')
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false)

  const [excelSummary, setExcelSummary] = React.useState('')
  const [excelLoading, setExcelLoading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  async function handleExcelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setExcelLoading(true)
    setExcelSummary('')
    try {
      const rows = await readExcelFile(file)
      const preview = rows.slice(0, 50)
      const result = await aiService.chat([
        {
          role: 'system',
          content:
            'Sen bir veri analistisin. Kullanıcının yüklediği Excel dosyasından okunan satırların bir örneğini ' +
            'göreceksin (en fazla ilk 50 satır). Kısa bir özet çıkar: kaç satır/sütun var, hangi alanlar ' +
            'göze çarpıyor, dikkat çekici örüntü/anormallik var mı. SADECE TÜRKÇE yaz — başka bir dilde tek kelime bile yazma.',
        },
        {
          role: 'user',
          content: `Dosya: ${file.name}\nToplam satır (bu örnekte): ${rows.length}\n\nÖrnek veri (JSON):\n${JSON.stringify(preview, null, 2)}`,
        },
      ])
      setExcelSummary(result.content)
    } catch (err) {
      toast.error('Dosya özetlenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setExcelLoading(false)
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
            <CardTitle className="text-base">Excel Dosyası Özetle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={excelLoading} className="w-fit">
              {excelLoading ? <Loader2 className="animate-spin" /> : <Upload />}
              Excel Yükle
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelFile} />
            <p className="text-muted-foreground text-xs">
              PDF/Word okuma bu sürümde yok — yalnızca Excel/CSV desteklenir.
            </p>
            {excelSummary && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{excelSummary}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
