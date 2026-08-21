import * as React from 'react'
import { Search, Phone, Mail, MapPin, AtSign, Trash2, StickyNote } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { InstagramLeadForm } from '@/features/instagramLeads/InstagramLeadForm'
import { useInstagramLeads, useDeleteInstagramLead } from '@/features/instagramLeads/hooks'
import type { InstagramLead } from '@/types/database'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

export function InstagramLeadsPage() {
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { data: leads = [], isLoading } = useInstagramLeads()
  const deleteMutation = useDeleteInstagramLead()
  const { confirm, dialog } = useConfirmDialog()

  const filtered = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return leads
    return leads.filter((l) =>
      [l.full_name, l.phone, l.email, l.address, l.instagram_username]
        .filter(Boolean)
        .some((v) => String(v).toLocaleLowerCase('tr').includes(q)),
    )
  }, [leads, search])

  async function handleDelete(lead: InstagramLead) {
    if (!(await confirm(`${lead.full_name} silinsin mi?`))) return
    deleteMutation.mutate(lead.id)
  }

  return (
    <div>
      <PageHeader
        title="Instagram Doktor Listesi"
        description="Instagram'da bulduğunuz doktorları elle kaydedin — otomatik toplama/kazıma yapılmaz (KVKK)"
        actions={
          <div className="flex gap-2">
            <ExportMenu<InstagramLead>
              title="Instagram Doktor Listesi"
              filename="instagram-doktor-listesi"
              rows={filtered}
              columns={[
                { header: 'İsim', value: (l) => l.full_name },
                { header: 'Instagram', value: (l) => l.instagram_username ?? '' },
                { header: 'Telefon', value: (l) => l.phone ?? '' },
                { header: 'E-posta', value: (l) => l.email ?? '' },
                { header: 'Adres', value: (l) => l.address ?? '' },
                { header: 'Not', value: (l) => l.notes ?? '' },
              ]}
            />
            <InstagramLeadForm />
          </div>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="İsim, telefon, e-posta, Instagram ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İsim</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Henüz kayıt yok — Instagram'da bulduğunuz bir doktoru "Doktor Ekle" ile ekleyin.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((lead) => (
                <TableRow key={lead.id} onClick={() => setSelectedId(lead.id)} selected={lead.id === selectedId}>
                  <TableCell className="font-medium">
                    <InstagramLeadForm
                      lead={lead}
                      trigger={
                        <button type="button" className="text-left hover:underline">
                          {lead.full_name}
                        </button>
                      }
                    />
                    {lead.notes && (
                      <div className="text-muted-foreground mt-0.5 flex items-start gap-1 text-xs">
                        <StickyNote className="mt-0.5 size-3 shrink-0" /> {lead.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.instagram_username ? (
                      <span className="inline-flex items-center gap-1">
                        <AtSign className="size-3.5" /> {lead.instagram_username}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3.5" /> {lead.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" /> {lead.email}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.address ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" /> {lead.address}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(lead)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {dialog}
    </div>
  )
}
