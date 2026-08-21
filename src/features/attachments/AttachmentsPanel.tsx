import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { FileText, Upload, Trash2, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { getAttachmentUrl } from './api'
import { useAttachments, useDeleteAttachment, useUploadAttachment } from './hooks'
import type { AttachmentOwnerType } from '@/types/database'

interface AttachmentsPanelProps {
  ownerType: AttachmentOwnerType
  ownerId: string
}

export function AttachmentsPanel({ ownerType, ownerId }: AttachmentsPanelProps) {
  const { staff } = useAuth()
  // "product" ve "product_catalog" belgeleri sadece yönetici ekleyip/silebiliyor
  // (bkz. attachments RLS politikaları) — personelde deneme, RLS'in sessizce
  // reddedip yükleme butonunun görünüşte çalışmıyormuş gibi durmasına yol
  // açıyordu; en baştan gizlemek daha net.
  const canManage = (ownerType !== 'product' && ownerType !== 'product_catalog') || staff?.role === 'admin'
  const { data: attachments = [], isLoading } = useAttachments(ownerType, ownerId)
  const uploadMutation = useUploadAttachment(ownerType, ownerId)
  const deleteMutation = useDeleteAttachment(ownerType, ownerId)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  async function handleDownload(id: string, path: string) {
    setDownloadingId(id)
    try {
      const url = await getAttachmentUrl(path)
      window.open(url, '_blank')
    } catch (error) {
      toast.error('Belge açılamadı', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Belgeler</h3>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            Belge Yükle
          </Button>
        )}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
      <Card>
        <CardContent className={attachments.length === 0 ? '' : 'grid gap-1.5 p-4'}>
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Yükleniyor...</p>}
          {!isLoading && attachments.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Henüz belge yok.</p>
          )}
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{att.file_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(att.created_at), 'd MMM yyyy', { locale: trLocale })}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(att.id, att.file_path)}
                  disabled={downloadingId === att.id}
                >
                  {downloadingId === att.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                </Button>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(att)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
