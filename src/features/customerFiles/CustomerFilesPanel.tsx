import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Upload, Eye, Trash2, FileIcon, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InvoicePdfViewer } from '@/components/InvoicePdfViewer'
import { getCustomerFileUrl } from './api'
import { useCustomerFiles, useDeleteCustomerFile, useUploadCustomerFile } from './hooks'
import type { CustomerFile } from '@/types/database'

export function CustomerFilesPanel({ customerId }: { customerId: string }) {
  const { data: files = [], isLoading } = useCustomerFiles(customerId)
  const uploadMutation = useUploadCustomerFile(customerId)
  const deleteMutation = useDeleteCustomerFile(customerId)
  const [viewingFile, setViewingFile] = React.useState<CustomerFile | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await uploadMutation.mutateAsync(file)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Dosyalar</h2>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
          Dosya Yükle
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
      <Card>
        <CardContent className={files.length === 0 ? '' : 'grid gap-1.5 p-4'}>
          {isLoading && <p className="text-muted-foreground p-4 text-sm">Yükleniyor...</p>}
          {!isLoading && files.length === 0 && (
            <p className="text-muted-foreground p-4 text-sm">Henüz dosya yüklenmedi.</p>
          )}
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{f.file_name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {format(new Date(f.created_at), 'd MMM yyyy', { locale: trLocale })}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setViewingFile(f)}>
                  <Eye className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate({ id: f.id, filePath: f.file_path })}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {viewingFile && (
        <InvoicePdfViewer
          open={!!viewingFile}
          onOpenChange={(o) => !o && setViewingFile(null)}
          title={viewingFile.file_name}
          getUrl={() => getCustomerFileUrl(viewingFile.file_path)}
        />
      )}
    </div>
  )
}
