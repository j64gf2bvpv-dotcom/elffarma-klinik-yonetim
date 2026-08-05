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
import { extractFileContent } from '@/features/smartImport/extractFileContent'
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

  const [fileSummary, setFileSummary] = React.useState('')
  const [fileLoading, setFileLoading] = React.useState(false)
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

  /**
   * Excel/CSV, PDF, Word (.docx), resim veya .txt — hepsini aynı çıkarma
   * mantığıyla (bkz. Akıllı İçe Aktar / AI Asistan'ın da kullandığı
   * extractFileContent) okuyup AI'a özetletir. Taranmış/görsel PDF'lerde
   * metin katmanı yoksa otomatik olarak sayfa görsellerine düşülüp vision
   * ile okunuyor — "ne verirsem vereyim detaylı taransın" beklentisi böyle
   * karşılanıyor. Salt özet: hiçbir kayıt oluşturmaz/içe aktarmaz.
   */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileLoading(true)
    setFileSummary('')
    try {
      const content = await extractFileContent(file)
      const systemMessage =
        'Sen bir veri analistisin. Kullanıcının yüklediği belgeyi dikkatlice, EKSİKSİZ tara. Kısa ama isabetli ' +
        'bir özet çıkar: belge ne içeriyor, kaç satır/kayıt/sayfa var, hangi alanlar göze çarpıyor, dikkat çekici ' +
        'bir örüntü/anormallik/hata var mı. SADECE TÜRKÇE yaz — başka bir dilde tek kelime bile yazma.'

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
      setFileSummary(result.content)
    } catch (err) {
      toast.error('Dosya özetlenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setFileLoading(false)
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
            </p>
            {fileSummary && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{fileSummary}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
