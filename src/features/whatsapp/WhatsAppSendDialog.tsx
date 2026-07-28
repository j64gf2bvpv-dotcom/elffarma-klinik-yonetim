import * as React from 'react'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useWhatsAppTemplates } from './hooks'
import { renderTemplate, buildWhatsAppUrl, openWhatsApp, type TemplateContext } from './renderTemplate'
import { normalizeTrPhone } from './normalizePhone'

interface WhatsAppSendDialogProps {
  customerName: string
  customerPhone: string
  context?: TemplateContext
  trigger?: React.ReactNode
  markSentLabel?: string
  onMarkSent?: () => void | Promise<void>
}

export function WhatsAppSendDialog({
  customerName,
  customerPhone,
  context,
  trigger,
  markSentLabel,
  onMarkSent,
}: WhatsAppSendDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [templateId, setTemplateId] = React.useState<string>('custom')
  const [message, setMessage] = React.useState('')
  const [markSent, setMarkSent] = React.useState(true)
  const { data: templates = [] } = useWhatsAppTemplates()

  const phoneResult = React.useMemo(() => normalizeTrPhone(customerPhone), [customerPhone])
  const firstName = customerName.trim().split(/\s+/)[0] ?? customerName

  React.useEffect(() => {
    if (!open) return
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setMessage(renderTemplate(template.body, { ad: firstName, ...context }))
    } else if (templates.length > 0 && templateId === 'custom' && message === '') {
      setTemplateId(templates[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId, templates])

  function handleTemplateChange(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) {
      setMessage(renderTemplate(template.body, { ad: firstName, ...context }))
    }
  }

  async function handleSend() {
    if (!phoneResult) {
      toast.error('Geçersiz telefon numarası', {
        description: 'Doktorun telefon numarasını kontrol edin (10 haneli olmalı).',
      })
      return
    }
    const url = buildWhatsAppUrl(phoneResult.waDigits, message)
    await openWhatsApp(url)
    if (markSent && onMarkSent) {
      await onMarkSent()
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <MessageCircle /> WhatsApp Gönder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>WhatsApp Mesajı Gönder</DialogTitle>
          <DialogDescription>
            {customerName} · {phoneResult ? phoneResult.canonical : 'Geçersiz numara'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Şablon</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Şablon seçin" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Serbest metin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Mesaj Önizleme</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Mesajınızı yazın..."
            />
          </div>

          {onMarkSent && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={markSent} onCheckedChange={(v) => setMarkSent(v === true)} />
              {markSentLabel ?? 'Gönderildi olarak işaretle'}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button onClick={handleSend} disabled={!message.trim()}>
            <MessageCircle /> WhatsApp'ta Aç
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
